import { buildPreview } from "@/lib/resetServer";
import { HttpError, requireSuperadmin } from "@/lib/serverAuth";

/**
 * Everything the "Reset all data" dialog can offer to delete: people (and
 * sign-ins without a profile), sites, photos and the size of each other
 * collection. Read-only. Superadmin only.
 */
export async function POST(request: Request) {
  try {
    const idToken = (request.headers.get("authorization") ?? "").replace(/^Bearer /i, "");
    if (!idToken) throw new HttpError(401, "Sign in again.");
    await requireSuperadmin(idToken, "Only the superadmin can reset data.");
    return Response.json({ preview: await buildPreview() });
  } catch (error) {
    if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status });
    console.warn("[reset/preview] failed —", error);
    return Response.json({ error: error instanceof Error ? error.message : "Couldn't read the data." }, { status: 500 });
  }
}
