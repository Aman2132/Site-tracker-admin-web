import { deleteMatching, deletePersonCompletely, deleteSiteCompletely, type DeleteContext } from "./accountsServer";
import { adminAuth, adminDb, adminRtdb } from "./firebaseAdmin";
import { storagePathFromUrl } from "./photoFiles";
import { deletePhotoCompletely } from "./photoServer";
import { BULK_KINDS, isKeptRole, type BulkKind, type ResetPerson, type ResetPreview, type ResetStep } from "./reset";
import { HttpError } from "./serverAuth";
import { deleteFiles, listBucketFiles } from "./storage";

/**
 * Server-only. The "Reset all data" feature: reads everything that could be
 * deleted (preview) and deletes it one step at a time (run). Superadmin only —
 * the routes check that before calling anything here.
 *
 * The admin and superadmin accounts are never deleted: their sign-in and
 * profile stay, though what they made (photos, check-ins, ...) can go.
 */

export const BULK_COLLECTION: Record<BulkKind, string> = {
  sessions: "sessions",
  inventory: "inventory",
  events: "events",
  views: "adminViews",
  audit: "adminAudit",
};

/** The most records one request deletes from a whole collection; the dialog asks again until none are left. */
const BULK_PER_REQUEST = 2000;
/** The most leftover files one request deletes. */
const FILES_PER_REQUEST = 200;

export interface StepOutcome {
  deleted: number;
  /** Still to go after this request (only for steps that work in rounds). */
  remaining: number;
  failed: { id: string; reason: string }[];
}

const asText = (value: unknown): string => (typeof value === "string" ? value : "");

/** Everyone who could be deleted: profiles, plus sign-ins that never got a profile. */
async function readPeople(): Promise<ResetPerson[]> {
  const [profiles, signIns] = await Promise.all([adminDb().collection("people").get(), listAllSignIns()]);
  const emailByUid = new Map(signIns.map(user => [user.uid, user.email ?? ""]));
  const known = new Set<string>();

  const people: ResetPerson[] = profiles.docs.map(doc => {
    known.add(doc.id);
    const appRole = asText(doc.get("appRole")) || "worker";
    return {
      id: doc.id,
      name: asText(doc.get("name")),
      email: asText(doc.get("email")) || emailByUid.get(doc.id) || "",
      appRole,
      locked: isKeptRole(appRole),
    };
  });
  for (const user of signIns) {
    if (!known.has(user.uid)) {
      people.push({ id: user.uid, name: user.displayName ?? "", email: user.email ?? "", appRole: "none", locked: false });
    }
  }
  // Kept accounts first, then by name, so the part that matters most is at the top.
  return people.sort((a, b) => Number(b.locked) - Number(a.locked) || (a.name || a.email).localeCompare(b.name || b.email));
}

async function listAllSignIns() {
  const users = [];
  let pageToken: string | undefined;
  do {
    const page = await adminAuth().listUsers(1000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);
  return users;
}

export async function buildPreview(): Promise<ResetPreview> {
  const db = adminDb();
  const [people, sites, photos, ...counts] = await Promise.all([
    readPeople(),
    db.collection("sites").select("name", "code").get(),
    db.collection("photos").select("personId", "siteId", "thumbUrl", "uri", "takenAt").get(),
    ...BULK_KINDS.map(kind => db.collection(BULK_COLLECTION[kind]).count().get()),
  ]);
  return {
    people,
    sites: sites.docs.map(doc => ({ id: doc.id, name: asText(doc.get("name")), code: asText(doc.get("code")) })),
    photos: photos.docs
      .map(doc => ({
        id: doc.id,
        thumbUrl: asText(doc.get("thumbUrl")) || asText(doc.get("uri")),
        personId: asText(doc.get("personId")),
        siteId: asText(doc.get("siteId")),
        takenAt: Number(doc.get("takenAt") ?? 0),
      }))
      .sort((a, b) => b.takenAt - a.takenAt),
    counts: Object.fromEntries(BULK_KINDS.map((kind, i) => [kind, counts[i].data().count])) as ResetPreview["counts"],
  };
}

/** Runs `work` for each id, collecting failures instead of stopping at the first. */
async function eachId(ids: string[], work: (id: string) => Promise<void>): Promise<StepOutcome> {
  let deleted = 0;
  const failed: StepOutcome["failed"] = [];
  for (const id of ids) {
    try {
      await work(id);
      deleted += 1;
    } catch (error) {
      failed.push({ id, reason: error instanceof Error ? error.message : "Unknown error" });
    }
  }
  return { deleted, remaining: 0, failed };
}

async function keptPersonIds(): Promise<Set<string>> {
  const snapshot = await adminDb().collection("people").where("appRole", "in", ["owner", "superadmin"]).select().get();
  return new Set(snapshot.docs.map(doc => doc.id));
}

export interface StepInput {
  step: ResetStep;
  ids: string[];
  kind?: BulkKind;
}

export async function runStep(input: StepInput, actorUid: string, ctx: DeleteContext): Promise<StepOutcome> {
  const db = adminDb();
  switch (input.step) {
    case "photos":
      return eachId(input.ids, id => deletePhotoCompletely(id, ctx.idToken, ctx.serviceKey));

    case "people": {
      const kept = await keptPersonIds();
      return eachId(input.ids, async id => {
        if (kept.has(id)) throw new Error("Admin and superadmin accounts are kept.");
        await deletePersonCompletely(id, actorUid, ctx);
      });
    }

    case "sites":
      return eachId(input.ids, async id => {
        await deleteSiteCompletely(id, ctx);
      });

    case "bulk": {
      if (!input.kind || !BULK_KINDS.includes(input.kind)) throw new HttpError(400, "Unknown kind of record.");
      const collection = db.collection(BULK_COLLECTION[input.kind]);
      const deleted = await deleteMatching(collection, BULK_PER_REQUEST);
      const remaining = (await collection.count().get()).data().count;
      return { deleted, remaining, failed: [] };
    }

    case "positions":
      // Live positions of the kept admins too: their phones write them again when tracking restarts.
      await adminRtdb().ref("positions").remove();
      return { deleted: 1, remaining: 0, failed: [] };

    case "notes": {
      // Deletion notes for photos of people who no longer exist. Notes for the kept admins stay: their phones still read them.
      const kept = await keptPersonIds();
      const snapshot = await db.collection("deletedPhotos").select("personId").get();
      const stale = snapshot.docs.filter(doc => !kept.has(asText(doc.get("personId"))));
      for (let i = 0; i < stale.length; i += 400) {
        const batch = db.batch();
        stale.slice(i, i + 400).forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }
      return { deleted: stale.length, remaining: 0, failed: [] };
    }

    case "files": {
      // Files in the photo store that no remaining photo record points to.
      const [files, records] = await Promise.all([
        listBucketFiles(ctx.serviceKey),
        db.collection("photos").select("uri", "thumbUrl").get(),
      ]);
      const referenced = new Set<string>();
      for (const doc of records.docs) {
        for (const url of [asText(doc.get("uri")), asText(doc.get("thumbUrl"))]) {
          const path = url && storagePathFromUrl(url);
          if (path) referenced.add(path);
        }
      }
      // Records exist but none maps into this store: the URL mapping is wrong, and "everything is leftover" would wipe real photos.
      if (records.size > 0 && referenced.size === 0) {
        throw new HttpError(409, "Photo records exist but none of them point to this photo store, so no file can be safely called leftover.");
      }
      const leftover = files.filter(file => !referenced.has(file.path));
      const batch = leftover.slice(0, FILES_PER_REQUEST);
      for (let i = 0; i < batch.length; i += 50) {
        await deleteFiles(batch.slice(i, i + 50).map(file => file.path), ctx.serviceKey);
      }
      return { deleted: batch.length, remaining: leftover.length - batch.length, failed: [] };
    }
  }
}
