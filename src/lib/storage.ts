import { PHOTOS_BUCKET } from "./photoFiles";

/**
 * Server-only. Removes files from the Supabase photos bucket using the
 * service-role key, which must never reach the browser (no NEXT_PUBLIC_ prefix).
 * When files move to Cloudflare R2, this is the one function to replace.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

const publicUrl = (path: string) =>
  `${SUPABASE_URL}/storage/v1/object/public/${PHOTOS_BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`;

/**
 * Resolves only when every file is gone (already-missing counts as gone, so
 * running a delete again heals a half-finished one). Throws otherwise, so the
 * caller keeps the Firestore record.
 *
 * Supabase answers 200 with fewer items than asked when it refuses a delete, so
 * the answer is checked, not just the status.
 */
export async function deleteFiles(paths: string[], serviceKey: string): Promise<void> {
  if (paths.length === 0) return;
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${PHOTOS_BUCKET}`, {
    method: "DELETE",
    headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, "content-type": "application/json" },
    body: JSON.stringify({ prefixes: paths }),
  });
  if (!response.ok) throw new Error(`The file store refused the delete (${response.status}).`);

  const removed = new Set(((await response.json()) as { name: string }[]).map(object => object.name));
  const notRemoved: string[] = [];
  for (const path of paths.filter(p => !removed.has(p))) {
    const check = await fetch(publicUrl(path), { method: "HEAD", cache: "no-store" });
    // Supabase answers a missing public object with HTTP 400 (body statusCode "404"), not a real 404.
    if (check.status !== 404 && check.status !== 400) notRemoved.push(path);
  }
  if (notRemoved.length) throw new Error(`The file store did not remove: ${notRemoved.join(", ")}.`);
}
