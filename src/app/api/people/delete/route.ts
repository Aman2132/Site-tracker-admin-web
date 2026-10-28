import { deletePersonCompletely } from "@/lib/accountsServer";
import { HttpError, requireSuperadmin } from "@/lib/serverAuth";

/**
 * 🚨 Deletes a crew member for good: their login account, their photos (files,
 * thumbnails AND records — see docs/READ-BEFORE-BUILDING-PHOTO-DELETION.md in
 * the app repo), live position, push token and profile. Their check-in sessions,
 * inventory entries and activity events stay for the records.
 *
 * Superadmin only, checked before anything is touched. Refuses to delete the
 * caller or another superadmin. Safe to run again after a failure.
 */
const VALID_ID = /^[A-Za-z0-9_-]{1,128}$/;

export async function POST(request: Request) {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      throw new HttpError(500, "Photo deletion isn't set up on the server: add SUPABASE_SERVICE_ROLE_KEY to .env.local and restart.");
    }
    const idToken = (request.headers.get("authorization") ?? "").replace(/^Bearer /i, "");
    if (!idToken) throw new HttpError(401, "Sign in again.");
    const actorUid = await requireSuperadmin(idToken, "Only the superadmin can delete accounts.");

    const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
    if (typeof body?.id !== "string" || !VALID_ID.test(body.id)) throw new HttpError(400, "Send the id of the person to delete.");

    const deleted = await deletePersonCompletely(body.id, actorUid, { idToken, serviceKey });
    return Response.json({ deleted });
  } catch (error) {
    if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status });
    console.warn("[people/delete] failed —", error);
    return Response.json({ error: error instanceof Error ? error.message : "Something went wrong deleting the account." }, { status: 500 });
  }
}
