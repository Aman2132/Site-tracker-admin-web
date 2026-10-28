import { FieldValue, type Query } from "firebase-admin/firestore";

import { adminAuth, adminDb, adminRtdb } from "./firebaseAdmin";
import { deletePhotoCompletely } from "./photoServer";
import { HttpError } from "./serverAuth";

/**
 * Server-only. Deleting a crew member's account and deleting a site, for the
 * superadmin (the routes check that first). Uses the Admin SDK because the
 * rules never let a browser delete a person or another user's login.
 *
 * Both are safe to run again after a failure: anything already gone counts as
 * done, and the steps are ordered so a failure leaves nothing half-removed that
 * a retry can't finish.
 */

export interface DeleteContext {
  /** The superadmin's own sign-in token: photo deletes run as them, so the rules still apply. */
  idToken: string;
  /** The file store's delete key (see storage.ts). */
  serviceKey: string;
}

const BATCH_SIZE = 400;

/** Deletes the documents a query matches, in batches, stopping once `maxDocs` are gone. Resolves with how many. */
export async function deleteMatching(query: Query, maxDocs = Infinity): Promise<number> {
  const db = adminDb();
  let total = 0;
  while (total < maxDocs) {
    const snapshot = await query.limit(Math.min(BATCH_SIZE, maxDocs - total)).get();
    if (snapshot.empty) break;
    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    total += snapshot.size;
  }
  return total;
}

/**
 * 🚨 Removes these photos completely — original, thumbnail AND record — through
 * the same function as the Photos page. Stops with an error if any one fails,
 * so the caller never goes on to delete the person or site those photos hang off.
 */
async function deletePhotosWhere(field: "personId" | "siteId", value: string, ctx: DeleteContext): Promise<number> {
  const snapshot = await adminDb().collection("photos").where(field, "==", value).select().get();
  const failed: string[] = [];
  for (const doc of snapshot.docs) {
    try {
      await deletePhotoCompletely(doc.id, ctx.idToken, ctx.serviceKey);
    } catch (error) {
      failed.push(error instanceof Error ? error.message : "Unknown error");
    }
  }
  if (failed.length > 0) {
    throw new Error(`${failed.length} of ${snapshot.size} photos couldn't be deleted, so nothing else was removed. ${failed[0]}`);
  }
  return snapshot.size;
}

export interface PersonDeletion {
  photos: number;
}

/** Login account, photos (files + records), live position, push token and profile. Their sessions, inventory entries and events stay. */
export async function deletePersonCompletely(id: string, actorUid: string, ctx: DeleteContext): Promise<PersonDeletion> {
  if (id === actorUid) throw new HttpError(400, "You can't delete your own account.");
  const profile = await adminDb().collection("people").doc(id).get();
  if (profile.get("appRole") === "superadmin") throw new HttpError(400, "A superadmin account can't be deleted here.");

  // Photos first: if any can't be deleted nothing else has been touched yet.
  const photos = await deletePhotosWhere("personId", id, ctx);

  try {
    await adminAuth().deleteUser(id);
  } catch (error) {
    if ((error as { code?: string }).code !== "auth/user-not-found") throw error;
  }
  await adminRtdb().ref(`positions/${id}`).remove();
  await adminDb().collection("pushTokens").doc(id).delete();
  // Notes left for their phone: the phone is gone with the account, so they would only be clutter.
  await deleteMatching(adminDb().collection("deletedPhotos").where("personId", "==", id));
  await adminDb().collection("people").doc(id).delete();
  return { photos };
}

export interface SiteDeletion {
  photos: number;
  inventory: number;
  sessions: number;
  events: number;
}

/**
 * The site, its photos (files + records), inventory entries, check-in sessions
 * and activity events; the site is removed from every person's assignments and
 * anyone still checked in there is cleared from it.
 */
export async function deleteSiteCompletely(id: string, ctx: DeleteContext): Promise<SiteDeletion> {
  const db = adminDb();
  const photos = await deletePhotosWhere("siteId", id, ctx);
  const inventory = await deleteMatching(db.collection("inventory").where("siteId", "==", id));
  const sessions = await deleteMatching(db.collection("sessions").where("siteId", "==", id));
  const events = await deleteMatching(db.collection("events").where("siteId", "==", id));

  const assigned = await db.collection("people").where("siteIds", "array-contains", id).get();
  const batch = db.batch();
  assigned.docs.forEach(doc => batch.update(doc.ref, { siteIds: FieldValue.arrayRemove(id) }));
  await batch.commit();

  const positions = await adminRtdb().ref("positions").orderByChild("siteId").equalTo(id).get();
  const cleared: Record<string, null> = {};
  positions.forEach(child => {
    cleared[`${child.key}/siteId`] = null;
  });
  if (Object.keys(cleared).length > 0) await adminRtdb().ref("positions").update(cleared);

  await db.collection("sites").doc(id).delete();
  return { photos, inventory, sessions, events };
}
