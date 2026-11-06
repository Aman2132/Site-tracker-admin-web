import { deleteProjectCompletely } from "@/lib/accountsServer";
import { HttpError, requireOwner } from "@/lib/serverAuth";

/**
 * 🚨 Deletes a project. If deleteSites is true, all attached sites are completely
 * deleted along with their photos, check-ins, sessions, stock, and records.
 * If deleteSites is false, attached sites become independent unassigned sites.
 * In both cases, project stock, site allocations, and usage records are cleaned up.
 *
 * Owner (Admin) and Superadmin accessible.
 */
const VALID_ID = /^[A-Za-z0-9_-]{1,128}$/;

export async function POST(request: Request) {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      throw new HttpError(
        500,
        "Deletion isn't set up on the server: add SUPABASE_SERVICE_ROLE_KEY to .env.local and restart."
      );
    }
    const idToken = (request.headers.get("authorization") ?? "").replace(/^Bearer /i, "");
    if (!idToken) throw new HttpError(401, "Sign in again.");
    await requireOwner(idToken);

    const body = (await request.json().catch(() => null)) as { id?: unknown; deleteSites?: unknown } | null;
    if (typeof body?.id !== "string" || !VALID_ID.test(body.id)) {
      throw new HttpError(400, "Send the id of the project to delete.");
    }

    const deleteSites = Boolean(body.deleteSites);
    const deleted = await deleteProjectCompletely(body.id, deleteSites, { idToken, serviceKey });
    return Response.json({ deleted });
  } catch (error) {
    if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status });
    console.warn("[projects/delete] failed —", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Something went wrong deleting the project." },
      { status: 500 }
    );
  }
}
