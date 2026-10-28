import {
  Timestamp,
  collection,
  getCountFromServer,
  getDocs,
  limit,
  query,
  where,
  writeBatch,
  type DocumentData,
  type Query,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

import { cutoffFor, type CleanupPreview, type CleanupResult } from "./cleanup";
import { firebase } from "./firebase";
import { isUsedUp } from "./inventory";
import { collectionUsage, estimateDocBytes } from "./usage";

/**
 * Bulk deletion of Firestore records straight from the browser: activity-feed
 * events, check-in sessions and fully-used inventory entries older than a
 * chosen age. The database rules only allow the superadmin to delete these, so
 * this fails (permission denied) for anyone else even if called by hand.
 *
 * Photos and orphan files are not here: they need the file-store key, so they
 * go through the server route /api/cleanup.
 */
export type FirestoreKind = "events" | "sessions" | "inventory" | "views";

/** Firestore allows 500 writes in one batch. */
const BATCH = 500;
/** Safety stop so a bug can never loop forever: 40 batches is 20,000 records. */
const MAX_BATCHES = 40;
const SAMPLE = 10;

/** The queries that find records older than the cutoff. Events from before the feed used server timestamps hold a plain number, which is a different type to Firestore, so both are asked. */
function queriesFor(kind: FirestoreKind, cutoff: number): Query<DocumentData>[] {
  const { db } = firebase();
  if (kind === "events") {
    return [
      query(collection(db, "events"), where("at", "<", Timestamp.fromMillis(cutoff))),
      query(collection(db, "events"), where("at", "<", cutoff)),
    ];
  }
  if (kind === "views") return [query(collection(db, "adminViews"), where("at", "<", cutoff))];
  if (kind === "sessions") return [query(collection(db, "sessions"), where("start", "<", cutoff))];
  return [query(collection(db, "inventory"), where("receivedAt", "<", cutoff))];
}

/** An inventory entry is only removed once everything received has been used. */
const eligible = (kind: FirestoreKind, doc: QueryDocumentSnapshot<DocumentData>) =>
  kind !== "inventory" ||
  isUsedUp({ quantity: Number(doc.data().quantity ?? 0), usedQuantity: Number(doc.data().usedQuantity ?? 0) });

/** Up to `max` eligible records, found by asking the server. */
async function findEligible(kind: FirestoreKind, cutoff: number, max: number) {
  const found: QueryDocumentSnapshot<DocumentData>[] = [];
  for (const q of queriesFor(kind, cutoff)) {
    const snapshot = await getDocs(query(q, limit(kind === "inventory" ? 2000 : max)));
    for (const doc of snapshot.docs) if (eligible(kind, doc) && found.length < max) found.push(doc);
    if (found.length >= max) break;
  }
  return found;
}

/** What a cleanup would delete, asked of the server (counts are exact; sizes are estimated). */
export async function previewFirestoreCleanup(kind: FirestoreKind, days: number, now = Date.now()): Promise<CleanupPreview> {
  const cutoff = cutoffFor(days, now);
  if (kind === "inventory") {
    const docs = await findEligible(kind, cutoff, 2000);
    const bytes = docs.reduce((sum, d) => sum + estimateDocBytes(`inventory/${d.id}`, d.data()), 0);
    return { kind, olderThanDays: days, count: docs.length, bytes: Math.round(bytes), bytesExact: false };
  }
  let count = 0;
  const sample: { path: string; data: Record<string, unknown> }[] = [];
  for (const q of queriesFor(kind, cutoff)) {
    count += (await getCountFromServer(q)).data().count;
    if (sample.length < SAMPLE) {
      const docs = await getDocs(query(q, limit(SAMPLE - sample.length)));
      docs.forEach(d => sample.push({ path: `${kind}/${d.id}`, data: d.data() }));
    }
  }
  return { kind, olderThanDays: days, count, bytes: collectionUsage(kind, count, sample).bytes, bytesExact: false };
}

/**
 * Deletes everything the preview counted, 500 at a time, then looks again and
 * reports what is left (0 means it is really gone from the database).
 */
export async function runFirestoreCleanup(
  kind: FirestoreKind,
  days: number,
  onProgress?: (deletedSoFar: number) => void,
  now = Date.now()
): Promise<CleanupResult> {
  const { db } = firebase();
  const cutoff = cutoffFor(days, now);
  let deleted = 0;
  const failed: CleanupResult["failed"] = [];
  for (let i = 0; i < MAX_BATCHES; i++) {
    const docs = await findEligible(kind, cutoff, BATCH);
    if (docs.length === 0) break;
    const batch = writeBatch(db);
    docs.forEach(d => batch.delete(d.ref));
    try {
      await batch.commit(); // resolves once the server has applied it
      deleted += docs.length;
      onProgress?.(deleted);
    } catch (error) {
      failed.push({ id: kind, reason: error instanceof Error ? error.message : "Delete refused." });
      break;
    }
  }
  const after = await previewFirestoreCleanup(kind, days, now);
  return { kind, deleted, failed, remaining: after.count };
}
