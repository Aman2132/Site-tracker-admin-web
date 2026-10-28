import { DAY } from "./time.ts";

/**
 * Bulk-cleanup logic. Pure (relative imports only) so it can be checked with
 * `node --test`. The deleting itself lives in the server route and in
 * cleanupClient.ts; this file decides WHAT is old enough, what counts as an
 * orphan, and what the confirmation requires.
 */

export type CleanupKind = "photos" | "orphans" | "events" | "sessions" | "inventory" | "views";

/** Age choices offered for the kinds that use one. */
export const AGE_CHOICES = [30, 90, 180, 365];
export const DEFAULT_AGE_DAYS = 90;

/** A file must be at least this old before it can be called an orphan: an upload in progress writes the file before its record. */
export const MIN_ORPHAN_AGE_MS = 60 * 60 * 1000;

/** What the person has to type before a deletion runs. */
export const CONFIRM_WORD = "DELETE";
export const confirmMatches = (typed: string) => typed.trim() === CONFIRM_WORD;

/** Records older than this many days (by their own date) are eligible. */
export const cutoffFor = (days: number, now: number) => now - days * DAY;

export interface KindInfo {
  title: string;
  /** What gets removed, in plain words. */
  removes: string;
  /** What is lost for good, shown in red in the confirmation. */
  loses: string;
  usesAge: boolean;
  /** Which space it frees. */
  frees: "photo files" | "Firestore";
}

export const KIND_INFO: Record<CleanupKind, KindInfo> = {
  photos: {
    title: "Old photos",
    removes: "Photos taken before the chosen age: the original file, its thumbnail AND the Firestore record.",
    loses: "The photos are gone for good, including from the crew's own photo lists once they refresh. This cannot be undone.",
    usesAge: true,
    frees: "photo files",
  },
  orphans: {
    title: "Orphan files",
    removes: "Files in the photo store that no photo record points to (failed uploads, test leftovers). Files under an hour old are never touched.",
    loses: "Nothing that the app shows: these files have no record, so no photo links to them.",
    usesAge: false,
    frees: "photo files",
  },
  events: {
    title: "Old activity feed",
    removes: "Activity-feed entries (check-ins, uploads, edits…) older than the chosen age.",
    loses: "The history shown on the Activity page for those dates. This cannot be undone.",
    usesAge: true,
    frees: "Firestore",
  },
  sessions: {
    title: "Old check-ins",
    removes: "Check-in and check-out records older than the chosen age.",
    loses: "Attendance and hours worked for those dates disappear from Attendance, Overview and crew profiles. This cannot be undone.",
    usesAge: true,
    frees: "Firestore",
  },
  views: {
    title: "Old page views",
    removes: "Entries in the page-view log (pages opened, links followed) older than the chosen age. The audit log itself is never deleted.",
    loses: "The page-visit history for those dates. Changes, sign-ins, failures and exports stay in the audit log. This cannot be undone.",
    usesAge: true,
    frees: "Firestore",
  },
  inventory: {
    title: "Old inventory (fully used)",
    removes: "Inventory entries older than the chosen age whose whole quantity has been used. Anything with stock left is kept.",
    loses: "Those deliveries and their usage history, and the crew's link between them and their proof photos. This cannot be undone.",
    usesAge: true,
    frees: "Firestore",
  },
};

export interface BucketFile {
  path: string;
  size: number;
  /** When the file store created it, epoch ms; absent when it doesn't say. */
  createdAt?: number;
}

/**
 * Files nothing points to. A file with no known creation time is never an orphan:
 * without knowing it is old, it could be an upload that is still being saved.
 */
export function findOrphans(files: BucketFile[], referenced: Set<string>, now: number, minAgeMs = MIN_ORPHAN_AGE_MS): BucketFile[] {
  return files.filter(file => !referenced.has(file.path) && file.createdAt != null && now - file.createdAt >= minAgeMs);
}

export const sumBytes = (files: { size: number }[]) => files.reduce((sum, file) => sum + file.size, 0);

export function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export interface CleanupPreview {
  kind: CleanupKind;
  olderThanDays: number | null;
  /** How many records (or files) would be deleted. */
  count: number;
  /** Space freed: exact for files, estimated for Firestore documents; null when unknown. */
  bytes: number | null;
  bytesExact: boolean;
}

export interface CleanupResult {
  kind: CleanupKind;
  deleted: number;
  failed: { id: string; reason: string }[];
  /** What a fresh preview found after the run; 0 means everything eligible is really gone. */
  remaining: number;
}

/** One line for the audit trail, e.g. "Cleanup: deleted 142 old photos (older than 90 days) — 38 MB". */
export function auditLine(result: CleanupResult, olderThanDays: number | null, bytesLabel: string | null): string {
  const what = KIND_INFO[result.kind].title.toLowerCase();
  const age = olderThanDays != null ? ` (older than ${olderThanDays} days)` : "";
  return `Cleanup: deleted ${result.deleted} ${what}${age}${bytesLabel ? ` — ${bytesLabel}` : ""}`;
}
