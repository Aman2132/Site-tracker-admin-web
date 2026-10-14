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
  getFirestore,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

import { FIREBASE_CONFIG, firebase } from "./firebase";

import type { AppRole, EventKind, InventoryChanges, SessionEndReason, SitePhoto, SiteStatus } from "../types/domain";

/**
 * Everything the dashboard writes. Each function is one admin action; the
 * live store's listeners pick the result up, so nothing here returns data to
 * merge. firestore.rules only lets an owner do these.
 */

export interface NewSiteInput {
  name: string;
  manager: string;
  status: SiteStatus;
  color: string;
  crewIds: string[];
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

export async function createSite(input: NewSiteInput): Promise<string> {
  const { db } = firebase();
  const ref = await addDoc(collection(db, "sites"), {
    name: input.name,
    code: siteCode(input.name),
    status: input.status,
    manager: input.manager,
    color: input.color,
    startedAt: Date.now(),
    createdAt: serverTimestamp(),
  });
  if (input.crewIds.length) await setSiteCrew(ref.id, input.crewIds, []);
  await logEvent(`Site created — ${input.name}`, "site", { siteId: ref.id });
  return ref.id;
}

export async function setSiteStatus(siteId: string, status: SiteStatus): Promise<void> {
  await updateDoc(doc(firebase().db, "sites", siteId), { status });
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
export async function logAdminAction(
  action: string,
  details: { targetType?: string; targetId?: string; note?: string },
  actorName: string
): Promise<void> {
  const uid = firebase().auth.currentUser?.uid;
  if (!uid) return;
  const present = Object.fromEntries(
    Object.entries({ ...details, note: details.note?.trim() || undefined }).filter(([, v]) => v != null && v !== "")
  );
  await addDoc(collection(firebase().db, "adminAudit"), {
    actorId: uid,
    actorName,
    action,
    ...present,
    at: Date.now(),
  }).catch(e => console.warn("[admin] audit log failed —", e));
}
