/**
 * Domain model for the admin dashboard. Mirrors the Site Tracker mobile
 * app's src/types/domain.ts and the Firebase documents it writes, plus the
 * derived fields the dashboard shows (presence status, hours).
 */

export type AppRole = "owner" | "worker" | "superadmin";

/** Same vocabulary as the mobile app's ActivityKind. */
export type ActivityKind = "vehicle" | "walk" | "still" | "stale";

/** Dashboard-level presence, derived from the live position, check-in and roster flags. */
export type PresenceStatus = "online" | "idle" | "offline" | "invited" | "deactivated";

export type SiteStatus = "active" | "planning" | "paused" | "completed";

/** A contract or job that can contain several sites. Projects deliberately have no location. */
export interface Project {
  id: string;
  name: string;
  code: string;
  status: SiteStatus;
  startedAt: number;
  manager: string;
  color: string;
}

/** One working location within a project. */
export interface Site {
  id: string;
  name: string;
  code: string;
  status: SiteStatus;
  startedAt: number;
  manager: string;
  /** Visual accent for charts and pins. */
  color: string;
  /** Absent only for older, ungrouped sites. */
  projectId?: string;
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
  /** The inventory entry this photo is proof for, if the crew linked one. */
  inventoryId?: string;
  takenAt: number;
  lat: number;
  lng: number;
  accuracy: number;
  plusCode: string;
}

/** "admin": an owner set the check-out by hand. "timeout": derived by settleSessions, never stored. */
export type SessionEndReason = "signed-off" | "paused" | "admin" | "timeout";

/** One continuous stretch of checked-in time. `end` is undefined while still open. */
export interface PresenceSession {
  id: string;
  personId: string;
  siteId: string;
  start: number;
  end?: number;
  endReason?: SessionEndReason;
  /** Set when an owner corrected it. Who and why live only in the superadmin audit log. */
  editedAt?: number;
}

/** `adminAudit/{id}`: one admin action, readable by a superadmin only. */
export interface AuditEntry {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  targetType?: string;
  targetId?: string;
  note?: string;
  /** Absent on older entries, which are all changes. */
  kind?: "change" | "auth" | "failed" | "export";
  /** Before → after for an edit, or what a deleted record held. */
  changes?: string;
  /** Why a failed or refused action didn't happen. */
  reason?: string;
  at: number;
}

/** One page opened (or one link that left the dashboard) by an admin. */
export interface AdminView {
  id: string;
  actorId: string;
  actorName: string;
  path: string;
  title: string;
  kind: "view" | "external";
  at: number;
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
  /** Arrived as equal pieces: how many, and how much `unit` each (5 × 5 m wire = 25 m). */
  packCount?: number;
  packSize?: number;
  /** Running total the creator logged as used (sum of `usage`). */
  usedQuantity: number;
  /** Each time the creator logged usage, oldest first. */
  usage: InventoryUsage[];
  /** Set when an owner changed it from the dashboard. Who did it lives in the superadmin-only audit trail. */
  editedAt?: number;
}

export interface InventoryUsage {
  quantity: number;
  at: number;
  note?: string;
}

/** Stock purchased or received for the whole project. It is allocated to sites before it can be used. */
export interface ProjectInventoryItem {
  id: string;
  projectId: string;
  name: string;
  unit: string;
  quantity: number;
  allocatedQuantity: number;
  usedQuantity: number;
  note?: string;
  receivedAt: number;
}

/** The quantity of one project item reserved for one site. */
export interface SiteInventoryAllocation {
  id: string;
  projectId: string;
  projectItemId: string;
  siteId: string;
  name: string;
  unit: string;
  quantity: number;
  usedQuantity: number;
  allocatedAt: number;
}

/** An append-only consumption record. `proofPhotoIds` point at the normal photos collection. */
export interface InventoryUsageRecord {
  id: string;
  projectId: string;
  siteId: string;
  allocationId: string;
  projectItemId: string;
  name: string;
  unit: string;
  quantity: number;
  note?: string;
  proofPhotoIds: string[];
  actorId: string;
  actorName: string;
  actorRole: "crew" | "admin";
  at: number;
}

/** What an owner can set when adding or correcting an entry. Admins may also correct `usedQuantity`. */
export type InventoryChanges = Pick<
  InventoryEntry,
  "siteId" | "name" | "quantity" | "unit" | "note" | "packCount" | "packSize"
> & {
  usedQuantity?: number;
};
