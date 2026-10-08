/**
 * Domain model for the admin dashboard. Mirrors the Site Tracker mobile
 * app's src/types/domain.ts and the Firebase documents it writes, plus the
 * derived fields the dashboard shows (presence status, hours).
 */

export type AppRole = "owner" | "worker";

/** Same vocabulary as the mobile app's ActivityKind. */
export type ActivityKind = "vehicle" | "walk" | "still" | "stale";

/** Dashboard-level presence, derived from the live position, check-in and roster flags. */
export type PresenceStatus = "online" | "idle" | "offline" | "invited" | "deactivated";

export type SiteStatus = "active" | "planning" | "paused" | "completed";

/** A project: a name and the crew assigned to it. Deliberately has no location. */
export interface Site {
  id: string;
  name: string;
  code: string;
  status: SiteStatus;
  startedAt: number;
  manager: string;
  /** Visual accent for charts and pins. */
  color: string;
}

export interface CrewMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  /** Job title, e.g. "Mason" — not the app role. */
  jobTitle: string;
  team: string;
  appRole: AppRole;
  color: string;
  avatar?: string;
  status: PresenceStatus;
  kind: ActivityKind;
  /** Sites they're assigned to. */
  siteIds: string[];
  /** Site they're checked in at right now, if any. */
  currentSiteId?: string;
  battery?: number;
  accuracy?: number;
  /** Last position fix, epoch ms. */
  lastSeenAt?: number;
  /** When they were invited; absent for people who signed up on their own. */
  joinedAt?: number;
  /** Last reported position; absent until the phone has sent one. */
  lat?: number;
  lng?: number;
  /** Checked in but paused sharing. */
  paused?: boolean;
}

export type MediaKind = "photo" | "video";

export interface SitePhoto {
  id: string;
  /** Small preview (~400px); the full file when the capture has none (older uploads, videos). */
  thumbUrl: string;
  /** Full-resolution original. */
  fullUrl: string;
  width: number;
  height: number;
  mediaType: MediaKind;
  durationMs?: number;
  personId: string;
  /** Empty when the person wasn't checked in at a site. */
  siteId: string;
  task: string;
  /** Optional free-text description written by the crew. */
  note?: string;
  takenAt: number;
  lat: number;
  lng: number;
  accuracy: number;
  plusCode: string;
}

export type SessionEndReason = "signed-off" | "paused" | "timeout";

/** One continuous stretch of checked-in time. `end` is undefined while still open. */
export interface PresenceSession {
  id: string;
  personId: string;
  siteId: string;
  start: number;
  end?: number;
  endReason?: SessionEndReason;
}

export type EventKind = "checkin" | "checkout" | "upload" | "battery" | "pause" | "resume" | "crew" | "site" | "other";

export interface ActivityEvent {
  id: string;
  at: number;
  kind: EventKind;
  personId?: string;
  siteId?: string;
  text: string;
  severity: "info" | "warn" | "success";
}

/** `people/{uid}` as stored in Firestore. */
export interface PersonDoc {
  id: string;
  name: string;
  role: string;
  color: string;
  appRole: AppRole;
  active?: boolean;
  avatar?: string;
  siteIds?: string[];
  email?: string;
  phone?: string;
  team?: string;
  invitedAt?: number;
}

/** `positions/{uid}` in the Realtime Database. */
export interface PositionDoc {
  lat?: number;
  lng?: number;
  accuracy?: number;
  lastFixAt?: number;
  battery?: number;
  paused?: boolean;
  kind?: ActivityKind;
  /** Set while checked in, null/absent once checked out. */
  siteId?: string | null;
}

/** One item received at a site (`inventory/{id}`), logged by the crew from the app. */
export interface InventoryEntry {
  id: string;
  personId: string;
  /** Name stamped when it was logged, so it survives a rename or removal. */
  personName: string;
  siteId: string;
  name: string;
  quantity: number;
  unit: string;
  note?: string;
  receivedAt: number;
  /** Set when an owner changed it from the dashboard. */
  editedAt?: number;
  editedBy?: string;
}

/** What an owner can set when adding or correcting an entry. */
export type InventoryChanges = Pick<InventoryEntry, "siteId" | "name" | "quantity" | "unit" | "note">;
