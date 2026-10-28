import { AGE_CHOICES, chunk, cutoffFor, findOrphans, sumBytes, type CleanupPreview, type CleanupResult } from "@/lib/cleanup";
import { filesOf } from "@/lib/photoFiles";
import { deletePhotoCompletely, queryPhotoRecords, referencedPaths } from "@/lib/photoServer";
import { HttpError, requireSuperadmin } from "@/lib/serverAuth";
import { deleteFiles, listBucketFiles } from "@/lib/storage";

/**
 * 🚨 Bulk cleanup of the photo store: old photos (file + thumbnail + record) and
 * orphan files. Superadmin only, checked before anything is read or touched.
 *
 * `preview` only reads. `run` deletes one batch and reports what is still left
 * (found by looking again, not by counting what we deleted), so the dashboard
 * can loop until nothing remains and can show that the data is really gone.
 * Everything to delete is worked out here from the database and the file store;
 * the request only names the kind and the age.
 */
const BATCH = 100;
/** The most records one request looks at when counting; a preview beyond this says "at least". */
const SCAN_LIMIT = 5000;

type Kind = "photos" | "orphans";

interface Body {
  kind?: unknown;
  mode?: unknown;
  olderThanDays?: unknown;
}

export async function POST(request: Request) {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) throw new HttpError(500, "Cleanup isn't set up on the server: add SUPABASE_SERVICE_ROLE_KEY to .env.local and restart.");
    const idToken = (request.headers.get("authorization") ?? "").replace(/^Bearer /i, "");
    if (!idToken) throw new HttpError(401, "Sign in again.");
    await requireSuperadmin(idToken);

    const body = (await request.json().catch(() => null)) as Body | null;
    const kind = body?.kind as Kind | undefined;
    const mode = body?.mode;
    if (kind !== "photos" && kind !== "orphans") throw new HttpError(400, "Unknown cleanup.");
    if (mode !== "preview" && mode !== "run") throw new HttpError(400, "Unknown mode.");
    let days: number | null = null;
    if (kind === "photos") {
      days = Number(body?.olderThanDays);
      // Only the offered ages: a typo must not be able to wipe recent photos.
      if (!AGE_CHOICES.includes(days)) throw new HttpError(400, `Choose one of: ${AGE_CHOICES.join(", ")} days.`);
    }

    const now = Date.now();
    const ctx = { idToken, serviceKey, now };
    const preview = kind === "photos" ? await previewPhotos(ctx, days!) : await previewOrphans(ctx);
    if (mode === "preview") return Response.json({ preview });

    const { deleted, failed } = kind === "photos" ? await runPhotos(ctx, days!) : await runOrphans(ctx);
    const after = kind === "photos" ? await previewPhotos(ctx, days!) : await previewOrphans(ctx);
    const result: CleanupResult = { kind, deleted, failed, remaining: after.count };
    return Response.json({ result });
  } catch (error) {
    if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status });
    console.warn("[cleanup] failed —", error);
    return Response.json({ error: error instanceof Error ? error.message : "Cleanup failed." }, { status: 500 });
  }
}

interface Ctx {
  idToken: string;
  serviceKey: string;
  now: number;
}

async function previewPhotos({ idToken, serviceKey, now }: Ctx, days: number): Promise<CleanupPreview> {
  const records = await queryPhotoRecords(idToken, { before: cutoffFor(days, now), limit: SCAN_LIMIT });
  const sizes = new Map((await listBucketFiles(serviceKey)).map(file => [file.path, file.size]));
  const bytes = records.reduce(
    (sum, record) => sum + filesOf({ fullUrl: record.fullUrl, thumbUrl: record.thumbUrl }).reduce((n, path) => n + (sizes.get(path) ?? 0), 0),
    0
  );
  return { kind: "photos", olderThanDays: days, count: records.length, bytes, bytesExact: true };
}

/** The files nothing points to. Refuses outright if the records can't be matched to the store at all. */
async function findOrphanFiles({ idToken, serviceKey, now }: Ctx) {
  const [files, records] = await Promise.all([listBucketFiles(serviceKey), queryPhotoRecords(idToken, { limit: SCAN_LIMIT * 4 })]);
  const referenced = referencedPaths(records);
  // Photo records exist but none points into this store: the URL mapping is wrong (or the store changed),
  // and "everything is an orphan" would delete every photo. Stop instead.
  if (records.length > 0 && referenced.size === 0) {
    throw new HttpError(409, "Photo records exist but none of them point to this photo store, so nothing can be safely called an orphan. Cleanup refused.");
  }
  return findOrphans(files, referenced, now);
}

async function previewOrphans(ctx: Ctx): Promise<CleanupPreview> {
  const orphans = await findOrphanFiles(ctx);
  return { kind: "orphans", olderThanDays: null, count: orphans.length, bytes: sumBytes(orphans), bytesExact: true };
}

async function runPhotos({ idToken, serviceKey, now }: Ctx, days: number) {
  const batch = await queryPhotoRecords(idToken, { before: cutoffFor(days, now), limit: BATCH });
  const deleted = { count: 0 };
  const failed: { id: string; reason: string }[] = [];
  for (const record of batch) {
    try {
      await deletePhotoCompletely(record.id, idToken, serviceKey);
      deleted.count += 1;
    } catch (error) {
      failed.push({ id: record.id, reason: error instanceof Error ? error.message : "Unknown error" });
    }
  }
  return { deleted: deleted.count, failed };
}

async function runOrphans(ctx: Ctx) {
  const orphans = (await findOrphanFiles(ctx)).slice(0, BATCH);
  let deleted = 0;
  const failed: { id: string; reason: string }[] = [];
  for (const group of chunk(orphans, 50)) {
    try {
      await deleteFiles(group.map(file => file.path), ctx.serviceKey);
      deleted += group.length;
    } catch (error) {
      for (const file of group) failed.push({ id: file.path, reason: error instanceof Error ? error.message : "Unknown error" });
    }
  }
  return { deleted, failed };
}
