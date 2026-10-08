import type { SitePhoto } from "../types/domain.ts";

/**
 * Where a photo's files live. Pure (relative imports only) so it can be checked
 * with `node --test`.
 *
 * 🚨 A photo is TWO files + ONE Firestore record. Deleting a photo must remove
 * the original, the `_thumb.jpg` thumbnail AND the record — see
 * docs/READ-BEFORE-BUILDING-PHOTO-DELETION.md in the app repo.
 *
 * When photo files move to Cloudflare R2, this is the file to update: it is the
 * only place that knows how a record's URL maps to a path in the file store.
 */

export const PHOTOS_BUCKET = "Photos";
const PUBLIC_PREFIX = `/storage/v1/object/public/${PHOTOS_BUCKET}/`;

/** The path of a file inside the bucket, from its public URL; null if the URL isn't from this bucket. */
export function storagePathFromUrl(url: string): string | null {
  const start = url.indexOf(PUBLIC_PREFIX);
  if (start < 0) return null;
  const path = url.slice(start + PUBLIC_PREFIX.length).split("?")[0];
  try {
    return decodeURIComponent(path) || null;
  } catch {
    return null;
  }
}

/**
 * Every file that belongs to one photo record: the original and, when it has
 * one, its thumbnail (older records and videos have none; their thumbnail URL
 * is the original again, so duplicates are dropped).
 */
export function filesOf(photo: Pick<SitePhoto, "fullUrl" | "thumbUrl">): string[] {
  const paths = [photo.fullUrl, photo.thumbUrl]
    .map(storagePathFromUrl)
    .filter((path): path is string => path !== null);
  return Array.from(new Set(paths));
}
