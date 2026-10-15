import { deletePhotoCompletely } from "@/lib/photoServer";
import { HttpError, requireOwner } from "@/lib/serverAuth";

/**
 * 🚨 Deletes photos completely: the original file, its thumbnail AND the
 * Firestore record — files first, record last, so a failed file delete keeps the
 * record and nothing is left pointing at a missing file. If the record delete
 * fails after the files are gone, running it again finishes the job.
 * See docs/READ-BEFORE-BUILDING-PHOTO-DELETION.md in the app repo.
 *
 * Only an active owner may call this (checked before anything is touched), and
 * the file paths come from the stored record, never from the request.
 */
const MAX_PER_REQUEST = 200;
const VALID_ID = /^[A-Za-z0-9]{1,64}$/;

export async function POST(request: Request) {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      throw new HttpError(
        500,
        "Photo deletion isn't set up on the server: add SUPABASE_SERVICE_ROLE_KEY to .env.local (no NEXT_PUBLIC_ prefix) and restart."
      );
    }
    const idToken = (request.headers.get("authorization") ?? "").replace(/^Bearer /i, "");
    if (!idToken) throw new HttpError(401, "Sign in again.");
    await requireOwner(idToken);

    const body = (await request.json().catch(() => null)) as { ids?: unknown } | null;
    const ids = Array.isArray(body?.ids)
      ? body.ids.filter((id): id is string => typeof id === "string" && VALID_ID.test(id))
      : [];
    if (ids.length === 0 || ids.length > MAX_PER_REQUEST) {
      throw new HttpError(400, `Send between 1 and ${MAX_PER_REQUEST} photo ids.`);
    }

    const deleted: string[] = [];
    const failed: { id: string; reason: string }[] = [];
    for (const id of ids) {
      try {
        await deletePhotoCompletely(id, idToken, serviceKey);
        deleted.push(id);
      } catch (error) {
        failed.push({ id, reason: error instanceof Error ? error.message : "Unknown error" });
      }
    }
    return Response.json({ deleted, failed });
  } catch (error) {
    if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status });
    console.warn("[photos/delete] failed —", error);
    return Response.json({ error: "Something went wrong deleting photos." }, { status: 500 });
  }
}
