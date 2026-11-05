import { deleteApp, initializeApp } from "firebase/app";
import { createUserWithEmailAndPassword, getAuth, sendPasswordResetEmail, signOut } from "firebase/auth";
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  getFirestore,
  increment,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

import { CHANGES_MAX, REASON_MAX, type AuditKind } from "./auditLog";
import { FIREBASE_CONFIG, firebase } from "./firebase";

import type { AppRole, EventKind, InventoryChanges, SessionEndReason, SitePhoto, SiteStatus } from "../types/domain";
import {
  allocationProblem,
  availableAtSite,
  availableToAllocate,
  canAttachSiteToProject,
  projectNameProblem,
  siteNameProblem,
  usageProblem,
} from "./projectInventory";

/**
 * Everything the dashboard writes. Each function is one admin action; the
 * live store's listeners pick the result up, so nothing here returns data to
 * merge. firestore.rules only lets an owner do these.
 */

export interface NewSiteInput {
  name: string;
  projectId?: string;
  manager: string;
  status: SiteStatus;
  color: string;
  crewIds: string[];
}

export interface NewProjectSiteInput {
  name: string;
  manager?: string;
  status?: SiteStatus;
  color?: string;
}

export interface NewProjectInput {
  /** Existing unassigned site ids to attach to this project. */
  existingSiteIds?: string[];
  /** Brand-new sites to create directly under this project. */
  newSites?: NewProjectSiteInput[];
  name: string;
  manager: string;
  status: SiteStatus;
  color: string;
}

export interface ProjectStockInput {
  projectId: string;
  name: string;
  unit: string;
  quantity: number;
  note?: string;
}

export interface SiteAllocationInput {
  projectItemId: string;
  siteId: string;
  quantity: number;
}

export interface InventoryUsageInput {
  allocationId: string;
  quantity: number;
  note?: string;
  proofPhotoIds?: string[];
}

export interface NewCrewInput {
  name: string;
  email: string;
  phone: string;
  jobTitle: string;
  team: string;
  appRole: AppRole;
  color: string;
  siteIds: string[];
}

/** Appends to the activity feed in the same shape the phone writes. */
async function logEvent(text: string, type: EventKind, details: { personId?: string; siteId?: string } = {}) {
  const present = Object.fromEntries(Object.entries(details).filter(([, value]) => value != null));
  await addDoc(collection(firebase().db, "events"), { text, kind: "info", type, ...present, at: serverTimestamp() });
}

/** "NOI-62B" style short code from the initials of the name. */
function siteCode(name: string): string {
  return (
    name
      .replace(/[^a-zA-Z0-9 ]/g, "")
      .split(" ")
      .filter(Boolean)
      .map(word => word[0])
      .join("")
      .slice(0, 4)
      .toUpperCase() || "SITE"
  );
}

const SITE_PALETTE = ["#1c4ff0", "#0f9d58", "#a142f4", "#e2670f", "#12b5cb", "#d93025"];

export async function createSite(input: NewSiteInput): Promise<string> {
  const existingSnap = await getDocs(collection(firebase().db, "sites"));
  const existingSites = existingSnap.docs
    .filter(d => d.id !== "default")
    .map(d => ({ id: d.id, name: String(d.data().name ?? "") }));
  const nameErr = siteNameProblem(input.name, existingSites);
  if (nameErr) throw new Error(nameErr);
  input = { ...input, name: input.name.trim(), manager: input.manager.trim() };
  const { db } = firebase();
  const ref = await addDoc(collection(db, "sites"), {
    name: input.name,
    code: siteCode(input.name),
    status: input.status,
    manager: input.manager,
    color: input.color,
    ...(input.projectId ? { projectId: input.projectId } : {}),
    startedAt: Date.now(),
    createdAt: serverTimestamp(),
  });
  if (input.crewIds.length) await setSiteCrew(ref.id, input.crewIds, []);
  await logEvent(`Site created — ${input.name}`, "site", { siteId: ref.id });
  return ref.id;
}

/** Creates the parent record that groups several working sites. */
export async function createProject(input: NewProjectInput): Promise<string> {
  const { db } = firebase();
  const [projectSnap, siteSnap] = await Promise.all([
    getDocs(collection(db, "projects")),
    getDocs(collection(db, "sites")),
  ]);

  const existingProjects = projectSnap.docs.map(d => ({ id: d.id, name: String(d.data().name ?? "") }));
  const nameErr = projectNameProblem(input.name, existingProjects);
  if (nameErr) throw new Error(nameErr);

  const existingSites = siteSnap.docs
    .filter(d => d.id !== "default")
    .map(d => ({ id: d.id, name: String(d.data().name ?? ""), projectId: d.data().projectId ? String(d.data().projectId) : undefined }));

  const existingSiteMap = new Map(existingSites.map(s => [s.id, s]));
  const existingSiteIds = input.existingSiteIds ?? [];
  for (const sId of existingSiteIds) {
    const found = existingSiteMap.get(sId);
    if (!found) throw new Error(`Site with id "${sId}" does not exist.`);
    if (!canAttachSiteToProject(found)) {
      throw new Error(`Site "${found.name}" is already assigned to another project.`);
    }
  }

  const newSites = input.newSites ?? [];
  const pendingNames: string[] = [];
  for (const ns of newSites) {
    const sErr = siteNameProblem(ns.name, existingSites, pendingNames);
    if (sErr) throw new Error(sErr);
    pendingNames.push(ns.name.trim());
  }

  const batch = writeBatch(db);
  const projectRef = doc(collection(db, "projects"));
  const cleanName = input.name.trim();

  batch.set(projectRef, {
    name: cleanName,
    code: siteCode(cleanName),
    status: input.status,
    manager: input.manager.trim(),
    color: input.color,
    startedAt: Date.now(),
    createdAt: serverTimestamp(),
  });

  for (const sId of existingSiteIds) {
    batch.update(doc(db, "sites", sId), { projectId: projectRef.id });
  }

  const createdSiteRefs: { ref: ReturnType<typeof doc>; name: string }[] = [];
  newSites.forEach((ns, idx) => {
    const siteRef = doc(collection(db, "sites"));
    const trimmedSiteName = ns.name.trim();
    batch.set(siteRef, {
      name: trimmedSiteName,
      code: siteCode(trimmedSiteName),
      status: ns.status ?? "planning",
      manager: ns.manager?.trim() ?? "",
      color: ns.color ?? SITE_PALETTE[(existingSites.length + idx) % SITE_PALETTE.length],
      projectId: projectRef.id,
      startedAt: Date.now(),
      createdAt: serverTimestamp(),
    });
    createdSiteRefs.push({ ref: siteRef, name: trimmedSiteName });
  });

  await batch.commit();

  await logEvent(`Project created — ${cleanName}`, "site");
  for (const s of createdSiteRefs) {
    await logEvent(`Site created — ${s.name}`, "site", { siteId: s.ref.id });
  }

  return projectRef.id;
}

export async function addProjectStock(input: ProjectStockInput): Promise<string> {
  const ref = await addDoc(collection(firebase().db, "projectInventory"), {
    projectId: input.projectId,
    name: input.name.trim().replace(/\s+/g, " "),
    unit: input.unit.trim(),
    quantity: input.quantity,
    allocatedQuantity: 0,
    usedQuantity: 0,
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
    receivedAt: Date.now(),
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Reserves project stock at a site. The transaction prevents an owner from
 * allocating more than the project has remaining when two edits overlap.
 */
export async function allocateProjectStock(input: SiteAllocationInput): Promise<string> {
  const { db } = firebase();
  const allocationRef = doc(collection(db, "siteInventory"));
  await runTransaction(db, async transaction => {
    const itemRef = doc(db, "projectInventory", input.projectItemId);
    const itemSnap = await transaction.get(itemRef);
    if (!itemSnap.exists()) throw new Error("That project item no longer exists.");
    const item = itemSnap.data();
    const available = availableToAllocate({ quantity: Number(item.quantity ?? 0), allocatedQuantity: Number(item.allocatedQuantity ?? 0) });
    const problem = allocationProblem(available, input.quantity);
    if (problem) throw new Error(problem);
    transaction.update(itemRef, { allocatedQuantity: increment(input.quantity) });
    transaction.set(allocationRef, {
      projectId: String(item.projectId ?? ""),
      projectItemId: input.projectItemId,
      siteId: input.siteId,
      name: String(item.name ?? ""),
      unit: String(item.unit ?? ""),
      quantity: input.quantity,
      usedQuantity: 0,
      allocatedAt: Date.now(),
      createdAt: serverTimestamp(),
    });
  });
  return allocationRef.id;
}

/**
 * Records consumption at a site. This is the authoritative no-overdraw gate:
 * it increments both the site allocation and project roll-up in one atomic
 * transaction, and writes an append-only record with any proof photo ids.
 */
export async function recordInventoryUsage(input: InventoryUsageInput, actor: { id: string; name: string; role: "crew" | "admin" }): Promise<string> {
  const { db } = firebase();
  const usageRef = doc(collection(db, "inventoryUsage"));
  await runTransaction(db, async transaction => {
    const allocationRef = doc(db, "siteInventory", input.allocationId);
    const allocationSnap = await transaction.get(allocationRef);
    if (!allocationSnap.exists()) throw new Error("That site allocation no longer exists.");
    const allocation = allocationSnap.data();
    const available = availableAtSite({ quantity: Number(allocation.quantity ?? 0), usedQuantity: Number(allocation.usedQuantity ?? 0) });
    const problem = usageProblem(available, input.quantity);
    if (problem) throw new Error(problem);
    const projectItemRef = doc(db, "projectInventory", String(allocation.projectItemId ?? ""));
    transaction.update(allocationRef, { usedQuantity: increment(input.quantity) });
    transaction.update(projectItemRef, { usedQuantity: increment(input.quantity) });
    transaction.set(usageRef, {
      projectId: String(allocation.projectId ?? ""),
      projectItemId: String(allocation.projectItemId ?? ""),
      allocationId: input.allocationId,
      siteId: String(allocation.siteId ?? ""),
      name: String(allocation.name ?? ""),
      unit: String(allocation.unit ?? ""),
      quantity: input.quantity,
      ...(input.note?.trim() ? { note: input.note.trim() } : {}),
      proofPhotoIds: input.proofPhotoIds ?? [],
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      at: Date.now(),
      createdAt: serverTimestamp(),
    });
  });
  return usageRef.id;
}

export async function setSiteStatus(siteId: string, status: SiteStatus): Promise<void> {
  await updateDoc(doc(firebase().db, "sites", siteId), { status });
}

/** Moves an unallocated site to a project, or clears its project for legacy sites. */
export async function setSiteProject(siteId: string, projectId?: string): Promise<void> {
  await updateDoc(doc(firebase().db, "sites", siteId), { projectId: projectId || deleteField() });
}

/** Adds and removes a site on several people at once. */
export async function setSiteCrew(siteId: string, addIds: string[], removeIds: string[]): Promise<void> {
  const { db } = firebase();
  const batch = writeBatch(db);
  for (const id of addIds) batch.update(doc(db, "people", id), { siteIds: arrayUnion(siteId) });
  for (const id of removeIds) batch.update(doc(db, "people", id), { siteIds: arrayRemove(siteId) });
  await batch.commit();
}

export async function setPersonSites(personId: string, siteIds: string[]): Promise<void> {
  await updateDoc(doc(firebase().db, "people", personId), { siteIds });
}

export async function setCrewActive(personId: string, name: string, active: boolean): Promise<void> {
  await updateDoc(doc(firebase().db, "people", personId), { active });
  await logEvent(`${name} ${active ? "reactivated" : "deactivated"}`, "crew", { personId });
}

export interface PersonDetailsInput {
  role?: string;
  team?: string;
  email?: string;
  phone?: string;
}

export async function updatePersonDetails(personId: string, changes: PersonDetailsInput): Promise<void> {
  const updates: Record<string, string> = {};
  if (changes.role !== undefined) updates.role = changes.role.trim();
  if (changes.team !== undefined) updates.team = changes.team.trim();
  if (changes.email !== undefined) updates.email = changes.email.trim();
  if (changes.phone !== undefined) updates.phone = changes.phone.trim();
  await updateDoc(doc(firebase().db, "people", personId), updates);
}

/** 20 random characters. The person never sees it — they set their own through the reset email. */
function throwawayPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return Array.from(bytes, b => "abcdefghijkmnpqrstuvwxyz23456789"[b % 32]).join("");
}

/**
 * Creates a crew account and sends the "set your password" email.
 *
 * A second Firebase app instance creates the Auth user, so the admin's own
 * session is untouched; that new user then writes their own `people/{uid}`
 * (the only create the rules allow, and only as a worker). The admin then adds
 * the fields only an owner may set — sites, contact details, role — and sends
 * the reset email, which is how the person picks a password.
 *
 * Limit: if the profile write fails after the Auth user exists, that email is
 * left registered with no profile; clean it up in the Firebase console.
 */
export async function inviteCrew(input: NewCrewInput): Promise<string> {
  const { auth, db } = firebase();
  const secondary = initializeApp(FIREBASE_CONFIG, `invite-${Date.now()}`);
  let uid: string;
  try {
    const secondaryAuth = getAuth(secondary);
    const credential = await createUserWithEmailAndPassword(secondaryAuth, input.email, throwawayPassword());
    uid = credential.user.uid;
    await setDoc(doc(getFirestore(secondary), "people", uid), {
      name: input.name,
      role: input.jobTitle,
      appRole: "worker",
      color: input.color,
    });
    await signOut(secondaryAuth);
  } finally {
    await deleteApp(secondary);
  }

  await updateDoc(doc(db, "people", uid), {
    siteIds: input.siteIds,
    email: input.email,
    phone: input.phone,
    team: input.team,
    invitedAt: Date.now(),
  });
  await sendPasswordResetEmail(auth, input.email);
  await logEvent(`Invite sent to ${input.name}`, "crew", { personId: uid, siteId: input.siteIds[0] });
  // Last, and on its own: the rules let only a superadmin grant owner, touching appRole alone.
  // If it fails the person still has a working worker account.
  if (input.appRole === "owner") await setAppRole(uid, "owner");
  return uid;
}

/** Grant / revoke admin. Superadmin only (firestore.rules); writes appRole and nothing else. */
export async function setAppRole(personId: string, appRole: "owner" | "worker"): Promise<void> {
  await updateDoc(doc(firebase().db, "people", personId), { appRole });
}

export interface SessionChanges {
  start: number;
  /** Absent = still open. */
  end?: number;
  siteId: string;
}

/**
 * Corrects a check-in/check-out. Only marks it `editedAt`: who did it and why go
 * to the audit log via attempt(), because every owner can read sessions.
 * `storedEndReason` is the session's current reason; a check-out the admin adds
 * where there was none is recorded as "admin".
 */
export async function updateSession(id: string, changes: SessionChanges, storedEndReason?: SessionEndReason): Promise<void> {
  const closed = changes.end != null;
  const keepReason = storedEndReason && storedEndReason !== "timeout" ? storedEndReason : undefined;
  await updateDoc(doc(firebase().db, "sessions", id), {
    start: changes.start,
    siteId: changes.siteId,
    end: closed ? changes.end : deleteField(),
    endReason: closed ? (keepReason ?? "admin") : deleteField(),
    editedAt: Date.now(),
  });
}

/** Reset links expire (about an hour) and work once, so an unaccepted invite needs a fresh one. */
export async function resendInvite(email: string): Promise<void> {
  await sendPasswordResetEmail(firebase().auth, email);
}

export interface PhotoDeleteResult {
  deleted: string[];
  failed: { id: string; reason: string }[];
}

/**
 * 🚨 Removes photos completely: the original file, its thumbnail AND the
 * Firestore record. A browser can't be trusted with the file store's delete key,
 * so this asks the dashboard's own server route (/api/photos/delete), which
 * checks you are an owner, deletes the files first and the record last, and
 * reports each photo separately. See docs/READ-BEFORE-BUILDING-PHOTO-DELETION.md
 * in the app repo.
 */
export async function deletePhotos(photos: Pick<SitePhoto, "id">[]): Promise<PhotoDeleteResult> {
  const user = firebase().auth.currentUser;
  if (!user) throw new Error("Sign in again.");
  const response = await fetch("/api/photos/delete", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${await user.getIdToken()}` },
    body: JSON.stringify({ ids: photos.map(photo => photo.id) }),
  });
  const data = (await response.json().catch(() => ({}))) as Partial<PhotoDeleteResult> & { error?: string };
  if (!response.ok) throw new Error(data.error ?? `Deleting failed (${response.status}).`);
  return { deleted: data.deleted ?? [], failed: data.failed ?? [] };
}

/** Asks one of the dashboard's superadmin-only delete routes to remove a person or a site. */
async function postDelete(route: string, id: string): Promise<void> {
  const user = firebase().auth.currentUser;
  if (!user) throw new Error("Sign in again.");
  const response = await fetch(route, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${await user.getIdToken()}` },
    body: JSON.stringify({ id }),
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `Deleting failed (${response.status}).`);
  }
}

/**
 * 🚨 Superadmin only. Deletes a crew member for good: login account, photos
 * (files, thumbnails AND records), live position and profile. Their check-in
 * history, inventory entries and activity events stay. Done on the server
 * (/api/people/delete) because a browser can't delete another person's login.
 */
export const deletePerson = (id: string): Promise<void> => postDelete("/api/people/delete", id);

/**
 * 🚨 Superadmin only. Deletes a site for good with its photos (files,
 * thumbnails AND records), inventory entries, check-in sessions and events.
 * Done on the server (/api/sites/delete).
 */
export const deleteSite = (id: string): Promise<void> => postDelete("/api/sites/delete", id);

/**
 * Corrects an entry the crew logged. Stamps who changed it and when, which the
 * app shows the crew as "Corrected by admin".
 */
export async function updateInventoryEntry(id: string, changes: InventoryChanges): Promise<void> {
  const note = changes.note?.trim();
  await updateDoc(doc(firebase().db, "inventory", id), {
    siteId: changes.siteId,
    name: changes.name.trim().replace(/\s+/g, " "),
    quantity: changes.quantity,
    unit: changes.unit.trim(),
    note: note ? note : deleteField(),
    ...(changes.usedQuantity != null ? { usedQuantity: changes.usedQuantity } : {}),
    // A changed total no longer matches its pieces, so the dialog leaves them out and they are dropped.
    packCount: changes.packCount ?? deleteField(),
    packSize: changes.packSize ?? deleteField(),
    // Who did it (and why) goes to the superadmin-only audit trail via attempt(), not this doc.
    editedAt: Date.now(),
  });
}

export async function deleteInventoryEntry(id: string): Promise<void> {
  await deleteDoc(doc(firebase().db, "inventory", id));
}

/** An owner logging a delivery themselves, attributed to the owner. */
export async function addInventoryEntry(changes: InventoryChanges, personName: string): Promise<void> {
  const { auth, db } = firebase();
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Sign in again.");
  const note = changes.note?.trim();
  await addDoc(collection(db, "inventory"), {
    personId: uid,
    personName,
    siteId: changes.siteId,
    name: changes.name.trim().replace(/\s+/g, " "),
    quantity: changes.quantity,
    unit: changes.unit.trim(),
    ...(note ? { note } : {}),
    receivedAt: Date.now(),
    createdAt: serverTimestamp(),
  });
}

/**
 * One line in the superadmin-only audit trail. Never throws: a failed log must
 * not undo or block the action it records. Called by attempt() in store.tsx.
 */
export interface AuditFields {
  targetType?: string;
  targetId?: string;
  note?: string;
  /** What kind of line this is; absent reads as a change. */
  kind?: AuditKind;
  /** Before → after text for an edit, or what a deleted/created record held. */
  changes?: string;
  /** Why an action failed or was refused. */
  reason?: string;
}

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

export async function logAdminAction(action: string, details: AuditFields, actorName: string): Promise<void> {
  const uid = firebase().auth.currentUser?.uid;
  if (!uid) return;
  const fields = {
    ...details,
    note: details.note?.trim() ? clip(details.note.trim(), 500) : undefined,
    changes: details.changes ? clip(details.changes, CHANGES_MAX) : undefined,
    reason: details.reason ? clip(details.reason, REASON_MAX) : undefined,
  };
  const present = Object.fromEntries(Object.entries(fields).filter(([, v]) => v != null && v !== ""));
  await addDoc(collection(firebase().db, "adminAudit"), {
    actorId: uid,
    actorName,
    action: clip(action, 300),
    ...present,
    at: Date.now(),
  }).catch(e => console.warn("[admin] audit log failed —", e));
}
