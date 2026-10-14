/**
 * Storage-usage maths. Pure and free of app imports so it can be checked with
 * `node --test`.
 *
 * Firebase gives an app no way to ask "how many bytes does Firestore hold", so
 * Firestore's figure is an ESTIMATE built from document counts and the stored-
 * size rules Google publishes (name + fields + 32 bytes, plus index entries).
 * The Firestore console's Usage tab is the exact number.
 */

/** Spark (free) plan allowances the bars are measured against. */
export const LIMITS = {
  firestoreBytes: 1024 ** 3, // 1 GiB stored
  realtimeBytes: 1_000_000_000, // 1 GB stored
  photoFilesBytes: 1_000_000_000, // Supabase free plan: 1 GB of file storage
};

/** Field values of this size or more aren't indexed (Firestore skips very large strings). */
const MAX_INDEXED_VALUE_BYTES = 1500;
const DOC_OVERHEAD = 32;
/** Every indexed field gets an ascending and a descending single-field index entry. */
const INDEX_ENTRIES_PER_FIELD = 2;

const utf8 = (text: string) => new TextEncoder().encode(text).length;

/** Firestore's stored size of a value (https://firebase.google.com/docs/firestore/storage-size). */
export function valueBytes(value: unknown): number {
  if (value === null || value === undefined) return 1;
  if (typeof value === "boolean") return 1;
  if (typeof value === "number") return 8;
  if (typeof value === "string") return utf8(value) + 1;
  if (Array.isArray(value)) return value.reduce<number>((sum, v) => sum + valueBytes(v), 0);
  if (typeof value === "object") {
    // Timestamps, GeoPoints and the like arrive as small class instances.
    if ("toMillis" in value || "latitude" in value) return 16;
    return Object.entries(value).reduce((sum, [k, v]) => sum + utf8(k) + 1 + valueBytes(v), 0);
  }
  return 8;
}

/** Document name bytes: each path segment + 1, plus 16 for the database. */
export const nameBytes = (path: string) => path.split("/").reduce((sum, seg) => sum + utf8(seg) + 1, 16);

/** Estimated stored size of one document, including its automatic single-field indexes. */
export function estimateDocBytes(path: string, data: Record<string, unknown>): number {
  const name = nameBytes(path);
  const fields = Object.entries(data).reduce((sum, [k, v]) => sum + utf8(k) + 1 + valueBytes(v), 0);
  let index = 0;
  for (const [key, value] of Object.entries(data)) {
    const size = valueBytes(value);
    if (size >= MAX_INDEXED_VALUE_BYTES) continue;
    index += INDEX_ENTRIES_PER_FIELD * (name + utf8(key) + 1 + size + DOC_OVERHEAD);
  }
  return name + fields + DOC_OVERHEAD + index;
}

export interface CollectionUsage {
  name: string;
  /** Documents in the collection (exact count). */
  count: number;
  /** Average estimated size of the sampled documents. */
  avgBytes: number;
  /** count × avgBytes. */
  bytes: number;
  /** How many documents the average came from. */
  sampled: number;
  /** Set when the signed-in account may not read this collection (e.g. the audit log for a plain admin). */
  unavailable?: boolean;
}

/** Folds a document count and a sample of documents into one collection's estimate. */
export function collectionUsage(
  name: string,
  count: number,
  sample: { path: string; data: Record<string, unknown> }[]
): CollectionUsage {
  const avgBytes = sample.length ? sample.reduce((sum, d) => sum + estimateDocBytes(d.path, d.data), 0) / sample.length : 0;
  return { name, count, avgBytes, bytes: Math.round(avgBytes * count), sampled: sample.length };
}

/** A collection's usage from a count and an average size remembered from an earlier check (no documents read). */
export function collectionUsageFromAverage(name: string, count: number, avgBytes: number): CollectionUsage {
  return { name, count, avgBytes, bytes: Math.round(avgBytes * count), sampled: 0 };
}

/**
 * Whether a remembered average is still good enough to reuse: it exists, and
 * the collection hasn't more than doubled (or halved) since it was measured,
 * which is when a fresh sample is worth its reads.
 */
export function averageIsFresh(saved: { avgBytes: number; count: number } | undefined, count: number): boolean {
  if (!saved || saved.avgBytes <= 0 || saved.count <= 0) return count === 0;
  return count <= saved.count * 2 && count >= saved.count / 2;
}

/** 0–1, capped, for a progress bar. */
export const share = (bytes: number, limit: number) => (limit > 0 ? Math.min(1, bytes / limit) : 0);

/** The limit as written on Firebase's pricing page: Firestore's is binary (1 GiB), the others decimal (1 GB). */
export const formatLimit = (bytes: number) => (bytes === 1024 ** 3 ? "1 GiB" : formatBytes(bytes));

/** "812 B", "14 KB", "3.4 MB", "1.23 GB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${Math.round(bytes)} B`;
  if (bytes < 1_000_000) return `${(bytes / 1000).toFixed(bytes < 10_000 ? 1 : 0)} KB`;
  if (bytes < 1_000_000_000) return `${(bytes / 1_000_000).toFixed(bytes < 10_000_000 ? 1 : 0)} MB`;
  return `${(bytes / 1_000_000_000).toFixed(2)} GB`;
}

/** "0.4%" / "<0.1%" / "63%": small shares stay visible instead of rounding to 0. */
export function formatShare(fraction: number): string {
  const pct = fraction * 100;
  if (pct === 0) return "0%";
  if (pct < 0.1) return "<0.1%";
  return `${pct < 10 ? pct.toFixed(1) : Math.round(pct)}%`;
}
