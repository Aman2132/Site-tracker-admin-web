import { IDS_PER_REQUEST, BULK_KINDS, type BulkKind, type ResetStep } from "@/lib/reset";
import { runStep } from "@/lib/resetServer";
import { HttpError, requireSuperadmin } from "@/lib/serverAuth";

/**
 * 🚨 Runs ONE step of "Reset all data": delete these photos (file, thumbnail AND
 * record), these people, these sites, a whole collection, ... The dialog calls
 * it repeatedly, in order, and shows progress. Superadmin only, checked before
 * anything is touched. Admin and superadmin accounts are never deleted.
 */
const STEPS: ResetStep[] = ["photos", "people", "sites", "bulk", "positions", "notes", "files"];
const VALID_ID = /^[A-Za-z0-9_-]{1,128}$/;

export async function POST(request: Request) {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      throw new HttpError(500, "Photo deletion isn't set up on the server: add SUPABASE_SERVICE_ROLE_KEY to .env.local and restart.");
    }
    const idToken = (request.headers.get("authorization") ?? "").replace(/^Bearer /i, "");
    if (!idToken) throw new HttpError(401, "Sign in again.");
    const actorUid = await requireSuperadmin(idToken, "Only the superadmin can reset data.");

    const body = (await request.json().catch(() => null)) as { step?: unknown; ids?: unknown; kind?: unknown } | null;
    const step = STEPS.find(candidate => candidate === body?.step);
    if (!step) throw new HttpError(400, "Unknown step.");
    const ids = Array.isArray(body?.ids) ? body.ids.filter((id): id is string => typeof id === "string" && VALID_ID.test(id)) : [];
    if (ids.length > IDS_PER_REQUEST) throw new HttpError(400, `Send at most ${IDS_PER_REQUEST} ids at a time.`);
    const kind = BULK_KINDS.find((candidate): candidate is BulkKind => candidate === body?.kind);

    const outcome = await runStep({ step, ids, kind }, actorUid, { idToken, serviceKey });
    return Response.json({ outcome });
  } catch (error) {
    if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status });
    console.warn("[reset/run] failed —", error);
    return Response.json({ error: error instanceof Error ? error.message : "Something went wrong." }, { status: 500 });
  }
}
