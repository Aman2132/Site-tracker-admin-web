/**
 * The "Reset all data" feature's shared vocabulary and rules. Pure (no imports
 * from the app) so the server route, the dialog and `node --test` all use the
 * same logic.
 *
 * The reset deletes everything except the admin and superadmin accounts: they
 * keep their sign-in and profile, but nothing they made. Everything starts
 * selected; the superadmin unticks what to keep.
 */

/** Roles whose accounts a reset never deletes. */
export const KEPT_ROLES = ["owner", "superadmin"];
export const isKeptRole = (appRole: string | undefined): boolean => KEPT_ROLES.includes(appRole ?? "");

/** Collections deleted whole, with no per-record choice. */
export type BulkKind = "sessions" | "inventory" | "events" | "views" | "audit";

/** The order the groups are listed and deleted in. The audit log goes last so it records the reset until the end. */
export const BULK_KINDS: BulkKind[] = ["sessions", "inventory", "events", "views", "audit"];

export const BULK_INFO: Record<BulkKind, { title: string; what: string }> = {
  sessions: { title: "Check-ins", what: "every check-in and check-out ever recorded (attendance history)" },
  inventory: { title: "Inventory", what: "every item entry and its usage log" },
  events: { title: "Activity feed", what: "the events shown on the dashboard, like “Ramesh checked in” or “3 photos uploaded”" },
  views: { title: "Page-view logs", what: "which dashboard pages admins opened" },
  audit: { title: "Audit log", what: "the private record of what each admin changed, including this reset’s earlier history" },
};

export interface ResetPerson {
  id: string;
  name: string;
  email: string;
  /** "worker", "owner", "superadmin", or "none" for a sign-in that has no profile. */
  appRole: string;
  /** Admins and the superadmin: shown but never deleted. */
  locked: boolean;
}

export interface ResetSite {
  id: string;
  name: string;
  code: string;
}

export interface ResetPhoto {
  id: string;
  thumbUrl: string;
  personId: string;
  siteId: string;
  takenAt: number;
}

export interface ResetPreview {
  people: ResetPerson[];
  sites: ResetSite[];
  photos: ResetPhoto[];
  counts: Record<BulkKind, number>;
}

/** What the superadmin has ticked. */
export interface ResetSelection {
  people: Set<string>;
  sites: Set<string>;
  photos: Set<string>;
  bulk: Set<BulkKind>;
}

/** Everything that can be deleted, ticked: the starting point. Locked people are never included. */
export function selectEverything(preview: ResetPreview): ResetSelection {
  return {
    people: new Set(preview.people.filter(person => !person.locked).map(person => person.id)),
    sites: new Set(preview.sites.map(site => site.id)),
    photos: new Set(preview.photos.map(photo => photo.id)),
    bulk: new Set(BULK_KINDS.filter(kind => preview.counts[kind] > 0)),
  };
}

/**
 * Photos that will go whatever their own checkbox says: deleting a person
 * deletes the photos they took, and deleting a site deletes the photos filed
 * under it. The dialog shows these as ticked and locked.
 */
export function photosForcedBy(preview: ResetPreview, people: Set<string>, sites: Set<string>): Set<string> {
  const forced = new Set<string>();
  for (const photo of preview.photos) {
    if (people.has(photo.personId) || (photo.siteId && sites.has(photo.siteId))) forced.add(photo.id);
  }
  return forced;
}

/** The photo ids that will really be deleted: the ticked ones plus the forced ones. */
export function photosToDelete(preview: ResetPreview, selection: ResetSelection): string[] {
  const forced = photosForcedBy(preview, selection.people, selection.sites);
  return preview.photos.filter(photo => selection.photos.has(photo.id) || forced.has(photo.id)).map(photo => photo.id);
}

export interface ResetTotals {
  people: number;
  sites: number;
  photos: number;
  records: number;
}

export function totalsFor(preview: ResetPreview, selection: ResetSelection): ResetTotals {
  return {
    people: selection.people.size,
    sites: selection.sites.size,
    photos: photosToDelete(preview, selection).length,
    records: BULK_KINDS.filter(kind => selection.bulk.has(kind)).reduce((sum, kind) => sum + preview.counts[kind], 0),
  };
}

export const isNothingSelected = (totals: ResetTotals): boolean =>
  totals.people + totals.sites + totals.photos + totals.records === 0;

/** "3 people · 1 site · 42 photos · 300 other records", skipping the zeros. */
export function describeTotals(totals: ResetTotals): string {
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  return [
    totals.people && plural(totals.people, "person", "people"),
    totals.sites && plural(totals.sites, "site", "sites"),
    totals.photos && plural(totals.photos, "photo", "photos"),
    totals.records && plural(totals.records, "other record", "other records"),
  ]
    .filter(Boolean)
    .join(" · ");
}

/** A step of the reset the server runs; the dialog calls them in this order. */
export type ResetStep = "photos" | "people" | "sites" | "bulk" | "positions" | "notes" | "files";

/** The most ids sent in one request, so a request finishes well inside the server's time limit. */
export const IDS_PER_REQUEST = 20;

export function chunked<T>(list: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let i = 0; i < list.length; i += size) groups.push(list.slice(i, i + size));
  return groups;
}

export const CONFIRM_RESET_WORD = "DELETE";
