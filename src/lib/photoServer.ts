import { filesOf, storagePathFromUrl } from "./photoFiles";
import { bearer, FIRESTORE_DOCUMENTS, firestoreUrl } from "./serverAuth";
import { deleteFiles } from "./storage";

/**
 * Server-only photo operations on the Firestore REST API, always with the
 * caller's own sign-in token so the database rules still apply.
 *
 * 🚨 A photo is TWO files + ONE record. deletePhotoCompletely removes the
 * original, the thumbnail AND the record — files first, record last — and is
 * the only function that does it, shared by the single-photo delete route and
 * bulk cleanup. See docs/READ-BEFORE-BUILDING-PHOTO-DELETION.md in the app repo.
 */

interface PhotoFields {
  personId?: { stringValue?: string };
  uri?: { stringValue?: string };
  thumbUrl?: { stringValue?: string };
  takenAt?: { integerValue?: string; doubleValue?: number };
}

export interface PhotoRef {
  id: string;
  personId: string;
  fullUrl: string;
  thumbUrl: string;
  takenAt: number;
}

const toRef = (id: string, fields: PhotoFields): PhotoRef => {
  const fullUrl = fields.uri?.stringValue ?? "";
  return {
    id,
    personId: fields.personId?.stringValue ?? "",
    fullUrl,
    thumbUrl: fields.thumbUrl?.stringValue ?? fullUrl,
    takenAt: Number(fields.takenAt?.integerValue ?? fields.takenAt?.doubleValue ?? 0),
  };
};

/**
 * Photo records (just the fields needed to find their files), optionally only
 * those taken before `before`. Oldest first.
 */
export async function queryPhotoRecords(idToken: string, opts: { before?: number; limit: number }): Promise<PhotoRef[]> {
  const structuredQuery = {
    from: [{ collectionId: "photos" }],
    select: { fields: [{ fieldPath: "personId" }, { fieldPath: "uri" }, { fieldPath: "thumbUrl" }, { fieldPath: "takenAt" }] },
    ...(opts.before != null
      ? { where: { fieldFilter: { field: { fieldPath: "takenAt" }, op: "LESS_THAN", value: { integerValue: String(Math.floor(opts.before)) } } } }
      : {}),
    // Ordering would silently skip records without a takenAt, so only an age filter (which already needs it) orders.
    ...(opts.before != null ? { orderBy: [{ field: { fieldPath: "takenAt" }, direction: "ASCENDING" }] } : {}),
    limit: opts.limit,
  };
  const response = await fetch(`${FIRESTORE_DOCUMENTS}:runQuery`, {
    method: "POST",
    headers: { ...bearer(idToken), "content-type": "application/json" },
    body: JSON.stringify({ structuredQuery }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Couldn't read the photo records (${response.status}).`);
  const rows = (await response.json()) as { document?: { name: string; fields?: PhotoFields } }[];
  return rows
    .filter(row => row.document)
    .map(row => toRef(row.document!.name.split("/").pop() ?? "", row.document!.fields ?? {}));
}

/** Every path in the file store that some photo record points to (original or thumbnail). */
export const referencedPaths = (records: PhotoRef[]): Set<string> =>
  new Set(records.flatMap(record => filesOf({ fullUrl: record.fullUrl, thumbUrl: record.thumbUrl })));

/**
 * Leaves a small "this photo was deleted" note (deletedPhotos/{id}) so the crew
 * app can remove its own copy: it finds the photo by who took it and when.
 * Written with PATCH, so running it again just rewrites the same note.
 */
async function writeTombstone(ref: PhotoRef, idToken: string): Promise<void> {
  if (!ref.personId) return; // nothing to match a phone's copy against
  const response = await fetch(firestoreUrl(`deletedPhotos/${ref.id}`), {
    method: "PATCH",
    headers: { ...bearer(idToken), "content-type": "application/json" },
    body: JSON.stringify({
      fields: {
        personId: { stringValue: ref.personId },
        takenAt: { integerValue: String(Math.floor(ref.takenAt)) },
        deletedAt: { integerValue: String(Date.now()) },
      },
    }),
  });
  if (!response.ok) throw new Error(`Couldn't record the deletion for the crew app (${response.status}).`);
}

/**
 * Deletes one photo completely (files, then a deletion note for the crew app, then the record). Safe to run again after a failure: an
 * already-missing file or record counts as gone. A record whose file isn't in
 * our store is left alone (deleting only the record would orphan the file).
 */
export async function deletePhotoCompletely(id: string, idToken: string, serviceKey: string): Promise<void> {
  const record = await fetch(firestoreUrl(`photos/${id}`), { headers: bearer(idToken), cache: "no-store" });
  if (record.status === 404) return; // already gone
  if (!record.ok) throw new Error(`Couldn't read the photo record (${record.status}).`);

  const ref = toRef(id, ((await record.json()) as { fields?: PhotoFields }).fields ?? {});
  if (storagePathFromUrl(ref.fullUrl) === null) {
    throw new Error("This photo's file isn't in the known photo storage, so it was left alone.");
  }

  await deleteFiles(filesOf(ref), serviceKey);
  // Before the record goes: if this fails the record stays, so a retry finds it again.
  await writeTombstone(ref, idToken);

  const removal = await fetch(firestoreUrl(`photos/${id}`), { method: "DELETE", headers: bearer(idToken) });
  if (!removal.ok) {
    throw new Error(`The files were removed but the record couldn't be (${removal.status}). Delete it again once the rules allow it.`);
  }
}
