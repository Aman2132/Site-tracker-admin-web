import { firebase } from "./firebase";
import {
  BULK_KINDS,
  IDS_PER_REQUEST,
  chunked,
  photosToDelete,
  type BulkKind,
  type ResetPreview,
  type ResetSelection,
  type ResetStep,
} from "./reset";

/**
 * The browser side of "Reset all data": asks the server what exists, then runs
 * the reset one small request at a time so progress can be shown and a slow
 * step can't time out. The server decides what is allowed (superadmin only,
 * admin accounts kept); nothing here can widen that.
 */

interface Outcome {
  deleted: number;
  remaining: number;
  failed: { id: string; reason: string }[];
}

async function post<T>(route: string, body: object): Promise<T> {
  const user = firebase().auth.currentUser;
  if (!user) throw new Error("Sign in again.");
  const response = await fetch(route, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${await user.getIdToken()}` },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? `The reset failed (${response.status}).`);
  return data;
}

export async function fetchResetPreview(): Promise<ResetPreview> {
  const { preview } = await post<{ preview: ResetPreview }>("/api/reset/preview", {});
  return preview;
}

const runStep = async (step: ResetStep, extra: { ids?: string[]; kind?: BulkKind } = {}): Promise<Outcome> =>
  (await post<{ outcome: Outcome }>("/api/reset/run", { step, ...extra })).outcome;

/** People and sites take longer each (their photos go too), so fewer per request. */
const HEAVY_PER_REQUEST = 5;
/** A whole collection is deleted in rounds; stop after this many rather than loop forever. */
const MAX_ROUNDS = 100;

export interface ResetProgress {
  /** What is being deleted right now, in plain words. */
  label: string;
  done: number;
  total: number;
}

export interface ResetReport {
  deleted: { people: number; sites: number; photos: number; records: number };
  failed: { what: string; id: string; reason: string }[];
}

/**
 * Deletes what is selected, in an order that never leaves something pointing at
 * a missing thing: photos, then people, then sites, then the plain collections
 * (the audit log last), then live positions, leftover notes and leftover files.
 */
export async function executeReset(
  preview: ResetPreview,
  selection: ResetSelection,
  onProgress: (progress: ResetProgress) => void
): Promise<ResetReport> {
  const photoIds = photosToDelete(preview, selection);
  const peopleIds = [...selection.people];
  const siteIds = [...selection.sites];
  const bulk = BULK_KINDS.filter(kind => selection.bulk.has(kind));

  const total =
    photoIds.length + peopleIds.length + siteIds.length + bulk.reduce((sum, kind) => sum + preview.counts[kind], 0);
  const report: ResetReport = { deleted: { people: 0, sites: 0, photos: 0, records: 0 }, failed: [] };
  let done = 0;
  const tick = (label: string, count: number) => {
    done += count;
    onProgress({ label, done: Math.min(done, total), total });
  };
  onProgress({ label: "Starting", done: 0, total });

  const byIds = async (step: "photos" | "people" | "sites", ids: string[], size: number, label: string) => {
    for (const group of chunked(ids, size)) {
      const outcome = await runStep(step, { ids: group });
      report.deleted[step] += outcome.deleted;
      report.failed.push(...outcome.failed.map(failure => ({ what: step, ...failure })));
      tick(label, group.length);
    }
  };

  await byIds("photos", photoIds, IDS_PER_REQUEST, "Deleting photos");
  await byIds("people", peopleIds, HEAVY_PER_REQUEST, "Deleting people and their sign-ins");
  await byIds("sites", siteIds, HEAVY_PER_REQUEST, "Deleting sites");

  for (const kind of bulk) {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const outcome = await runStep("bulk", { kind });
      report.deleted.records += outcome.deleted;
      tick("Deleting records", outcome.deleted);
      // Done, or a round that deleted nothing (everything left is failing): stop instead of repeating.
      if (outcome.remaining === 0 || outcome.deleted === 0) break;
    }
  }

  // Clean-up of what the above leaves behind. Each is cheap and safe to run when there is nothing to do.
  if (peopleIds.length > 0 || selection.bulk.has("sessions")) {
    onProgress({ label: "Clearing live positions", done: Math.min(done, total), total });
    await runStep("positions");
  }
  if (peopleIds.length > 0) {
    onProgress({ label: "Clearing leftover notes", done: Math.min(done, total), total });
    await runStep("notes");
  }
  if (photoIds.length + peopleIds.length + siteIds.length > 0) {
    onProgress({ label: "Removing leftover photo files", done: Math.min(done, total), total });
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const outcome = await runStep("files");
      if (outcome.remaining === 0 || outcome.deleted === 0) break;
    }
  }
  onProgress({ label: "Done", done: total, total });
  return report;
}
