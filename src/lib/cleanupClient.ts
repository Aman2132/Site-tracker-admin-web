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

export type ScopeArg = number | { before: number; after?: number; label?: string };

export function parseScope(scopeOrDays: ScopeArg, now: number) {
  if (typeof scopeOrDays === "number") {
    return { before: cutoffFor(scopeOrDays, now), after: undefined, days: scopeOrDays, label: `older than ${scopeOrDays} days` };
  }
  return {
    before: scopeOrDays.before,
    after: scopeOrDays.after,
    days: null,
    label: scopeOrDays.label ?? (scopeOrDays.after ? `between ${new Date(scopeOrDays.after).toLocaleDateString()} and ${new Date(scopeOrDays.before).toLocaleDateString()}` : `before ${new Date(scopeOrDays.before).toLocaleDateString()}`),
  };
}

/** The queries that find records within the cutoff. */
function queriesFor(kind: FirestoreKind, before: number, after?: number): Query<DocumentData>[] {
  const { db } = firebase();
  if (kind === "events") {
    if (after != null) {
      return [
        query(collection(db, "events"), where("at", "<=", Timestamp.fromMillis(before)), where("at", ">=", Timestamp.fromMillis(after))),
        query(collection(db, "events"), where("at", "<=", before), where("at", ">=", after)),
      ];
    }
    return [
      query(collection(db, "events"), where("at", "<=", Timestamp.fromMillis(before))),
      query(collection(db, "events"), where("at", "<=", before)),
    ];
  }
  if (kind === "views") {
    if (after != null) return [query(collection(db, "adminViews"), where("at", "<=", before), where("at", ">=", after))];
    return [query(collection(db, "adminViews"), where("at", "<=", before))];
  }
  if (kind === "sessions") {
    if (after != null) return [query(collection(db, "sessions"), where("start", "<=", before), where("start", ">=", after))];
    return [query(collection(db, "sessions"), where("start", "<=", before))];
  }
  if (after != null) return [query(collection(db, "inventory"), where("receivedAt", "<=", before), where("receivedAt", ">=", after))];
  return [query(collection(db, "inventory"), where("receivedAt", "<=", before))];
}

/** An inventory entry is only removed once everything received has been used. */
const eligible = (kind: FirestoreKind, doc: QueryDocumentSnapshot<DocumentData>) =>
  kind !== "inventory" ||
  isUsedUp({ quantity: Number(doc.data().quantity ?? 0), usedQuantity: Number(doc.data().usedQuantity ?? 0) });

/** Up to `max` eligible records, found by asking the server. */
async function findEligible(kind: FirestoreKind, before: number, after: number | undefined, max: number) {
  const found: QueryDocumentSnapshot<DocumentData>[] = [];
  for (const q of queriesFor(kind, before, after)) {
    const snapshot = await getDocs(query(q, limit(kind === "inventory" ? 2000 : max)));
    for (const doc of snapshot.docs) if (eligible(kind, doc) && found.length < max) found.push(doc);
    if (found.length >= max) break;
  }
  return found;
}

/** What a cleanup would delete, asked of the server (counts are exact; sizes are estimated). */
export async function previewFirestoreCleanup(kind: FirestoreKind, scopeOrDays: ScopeArg, now = Date.now()): Promise<CleanupPreview> {
  const { before, after, days, label } = parseScope(scopeOrDays, now);
  if (kind === "inventory") {
    const docs = await findEligible(kind, before, after, 2000);
    const bytes = docs.reduce((sum, d) => sum + estimateDocBytes(`inventory/${d.id}`, d.data()), 0);
    return { kind, olderThanDays: days, beforeMs: before, afterMs: after ?? null, scopeLabel: label, count: docs.length, bytes: Math.round(bytes), bytesExact: false };
  }
  let count = 0;
  const sample: { path: string; data: Record<string, unknown> }[] = [];
  for (const q of queriesFor(kind, before, after)) {
    count += (await getCountFromServer(q)).data().count;
    if (sample.length < SAMPLE) {
      const docs = await getDocs(query(q, limit(SAMPLE - sample.length)));
      docs.forEach(d => sample.push({ path: `${kind}/${d.id}`, data: d.data() }));
    }
  }
  return { kind, olderThanDays: days, beforeMs: before, afterMs: after ?? null, scopeLabel: label, count, bytes: collectionUsage(kind, count, sample).bytes, bytesExact: false };
}

/**
 * Deletes everything the preview counted, 500 at a time, then looks again and
 * reports what is left (0 means it is really gone from the database).
 */
export async function runFirestoreCleanup(
  kind: FirestoreKind,
  scopeOrDays: ScopeArg,
  onProgress?: (deletedSoFar: number) => void,
  now = Date.now()
): Promise<CleanupResult> {
  const { db } = firebase();
  const { before, after } = parseScope(scopeOrDays, now);
  let deleted = 0;
  const failed: CleanupResult["failed"] = [];
  for (let i = 0; i < MAX_BATCHES; i++) {
    const docs = await findEligible(kind, before, after, BATCH);
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
  const afterPreview = await previewFirestoreCleanup(kind, scopeOrDays, now);
  return { kind, deleted, failed, remaining: afterPreview.count };
}