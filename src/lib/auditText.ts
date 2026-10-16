import { describeFields, listNames } from "./auditLog";
import { formatDateTime } from "./format";

import type { SitePhoto } from "../types/domain";

/** `"Column grid L4" by Ram at Tower B (7 Oct 9:19 pm)`: enough to tell which photo a log line is about once it is deleted. */
export function describePhoto(photo: SitePhoto, personName?: string, siteName?: string): string {
  return `"${photo.task || "Photo"}" by ${personName || "unknown"}${siteName ? ` at ${siteName}` : ""} (${formatDateTime(photo.takenAt)})`;
}

/** What a photo deletion removed, for the audit line. */
export function describePhotoDeletion(
  photos: SitePhoto[],
  personName: (id: string) => string | undefined,
  siteName: (id: string) => string | undefined
): string | undefined {
  return describeFields([
    { label: "count", value: photos.length },
    { label: "photos", value: listNames(photos.map(p => describePhoto(p, personName(p.personId), siteName(p.siteId)))) },
  ]);
}
