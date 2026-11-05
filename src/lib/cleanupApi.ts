import type { CleanupKind, CleanupPreview, CleanupResult } from "./cleanup";
import { previewFirestoreCleanup, runFirestoreCleanup, type FirestoreKind } from "./cleanupClient";
import { firebase } from "./firebase";

/**
 * The one entry point the cleanup screen uses. Events, check-ins and inventory
 * are deleted straight from the browser (database rules: superadmin only);
 * photos and orphan files go through the server route, which holds the
 * file-store key. Every path ends by looking again, so `remaining` is what is
 * really still there.
 */
const isFirestoreKind = (kind: CleanupKind): kind is FirestoreKind =>
  kind === "events" || kind === "sessions" || kind === "inventory" || kind === "views";

/** Photos go 100 per request; this many requests is 6,000 photos, then it stops rather than loop. */
const MAX_SERVER_ROUNDS = 60;

export type CleanupParam = number | { before: number; after?: number; label?: string } | null;

async function callServer(kind: "photos" | "orphans", mode: "preview" | "run", param: CleanupParam) {
  const user = firebase().auth.currentUser;
  if (!user) throw new Error("Sign in again.");
  const body: Record<string, unknown> = { kind, mode };
  if (typeof param === "number") {
    body.olderThanDays = param;
  } else if (param != null) {
    body.beforeMs = param.before;
    if (param.after != null) body.afterMs = param.after;
    if (param.label) body.scopeLabel = param.label;
  }

  const response = await fetch("/api/cleanup", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${await user.getIdToken()}` },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as { preview?: CleanupPreview; result?: CleanupResult; error?: string };
  if (!response.ok) throw new Error(data.error ?? `Cleanup failed (${response.status}).`);
  return data;
}

export async function previewCleanup(kind: CleanupKind, param: CleanupParam): Promise<CleanupPreview> {
  if (isFirestoreKind(kind)) return previewFirestoreCleanup(kind, param ?? 0);
  const { preview } = await callServer(kind, "preview", param);
  if (!preview) throw new Error("No preview came back.");
  return preview;
}

export async function runCleanup(kind: CleanupKind, param: CleanupParam, onProgress?: (deletedSoFar: number) => void): Promise<CleanupResult> {
  if (isFirestoreKind(kind)) return runFirestoreCleanup(kind, param ?? 0, onProgress);

  let deleted = 0;
  const failed: CleanupResult["failed"] = [];
  let remaining = 0;
  for (let round = 0; round < MAX_SERVER_ROUNDS; round++) {
    const { result } = await callServer(kind, "run", param);
    if (!result) throw new Error("No result came back.");
    deleted += result.deleted;
    failed.push(...result.failed);
    remaining = result.remaining;
    onProgress?.(deleted);
    // Done, or a round that deleted nothing (everything left is failing): stop instead of repeating.
    if (remaining === 0 || result.deleted === 0) break;
  }
  return { kind, deleted, failed, remaining };
}
