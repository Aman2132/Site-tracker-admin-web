/**
 * Domain model for the admin dashboard. Mirrors the Site Tracker mobile
 * app's src/types/domain.ts, extended with what the dashboard needs and the
 * backend doesn't store yet: multi-site, site assignment, presence sessions.
 */

export type AppRole = "owner" | "worker";

/** Same vocabulary as the mobile app's ActivityKind. */
export type ActivityKind = "vehicle" | "walk" | "still" | "stale";

/** Dashboard-level presence, derived from sessions + last fix. */
export type PresenceStatus = "online" | "idle" | "offline" | "invited" | "deactivated";

export type SiteStatus = "active" | "planning" | "paused" | "completed";

export interface Site {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  /** Geofence radius, metres. */
  radius: number;
  status: SiteStatus;
  /** 0–1 construction progress, for the site card. */
  progress: number;
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
  siteIds: string[];
  /** Site they're physically inside right now, if any. */
  currentSiteId?: string;
  battery?: number;
  accuracy?: number;
  lastSeenAt?: number;
  joinedAt: number;
  /** Position inside the current site's schematic map, 0–1 on each axis. */
  mapX?: number;
  mapY?: number;
}

export type MediaKind = "photo" | "video";

export interface SitePhoto {
  id: string;
  /** Small preview (~480px). */
  thumbUrl: string;
  /** Full-resolution original. */
  fullUrl: string;
  width: number;
  height: number;
  mediaType: MediaKind;
  durationMs?: number;
  personId: string;
  siteId: string;
  task: string;
  takenAt: number;
  lat: number;
  lng: number;
  accuracy: number;
  plusCode: string;
}

export type SessionEndReason = "signed-off" | "paused" | "timeout";

/** One continuous stretch of location sharing. `end` is undefined while still open. */
export interface PresenceSession {
  id: string;
  personId: string;
  siteId: string;
  start: number;
  end?: number;
  endReason?: SessionEndReason;
}

export type EventKind =
  | "arrive"
  | "leave"
  | "upload"
  | "battery"
  | "pause"
  | "resume"
  | "idle"
  | "invite"
  | "site";

export interface ActivityEvent {
  id: string;
  at: number;
  kind: EventKind;
  personId?: string;
  siteId?: string;
  text: string;
  severity: "info" | "warn" | "success";
}
