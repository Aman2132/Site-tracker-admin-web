import { deleteSiteCompletely } from "@/lib/accountsServer";
import { HttpError, requireSuperadmin } from "@/lib/serverAuth";

/**
 * 🚨 Deletes a site for good, with everything filed under it: its photos (files,
 * thumbnails AND records — see docs/READ-BEFORE-BUILDING-PHOTO-DELETION.md in
 * the app repo), inventory entries, check-in sessions and activity events. The
 * site is also removed from every person's assignments.
 *
 * Superadmin only, checked before anything is touched. Safe to run again after a failure.
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
    await requireSuperadmin(idToken, "Only the superadmin can delete sites.");

    const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
    if (typeof body?.id !== "string" || !VALID_ID.test(body.id)) throw new HttpError(400, "Send the id of the site to delete.");

    const deleted = await deleteSiteCompletely(body.id, { idToken, serviceKey });
    return Response.json({ deleted });
  } catch (error) {
    if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status });
    console.warn("[sites/delete] failed —", error);
    return Response.json({ error: error instanceof Error ? error.message : "Something went wrong deleting the site." }, { status: 500 });
  }
}
