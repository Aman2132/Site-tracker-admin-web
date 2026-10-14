import { HttpError, requireOwner } from "@/lib/serverAuth";
import { bucketUsage } from "@/lib/storage";

/**
 * How much the photo file store holds, summed from its own metadata. Owners
 * only (checked before anything is read); needs the service-role key because
 * listing a bucket is not allowed with the public key.
 */
export async function GET(request: Request) {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      throw new HttpError(500, "Photo storage usage isn't set up on the server: add SUPABASE_SERVICE_ROLE_KEY to .env.local and restart.");
    }
    const idToken = (request.headers.get("authorization") ?? "").replace(/^Bearer /i, "");
    if (!idToken) throw new HttpError(401, "Sign in again.");
    await requireOwner(idToken);
    return Response.json(await bucketUsage(serviceKey), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status });
    console.warn("[usage] failed —", error);
    return Response.json({ error: "Couldn't read the photo storage usage." }, { status: 500 });
  }
}
