import { HOUR, MINUTE } from "./time.ts";

import type {
  ActivityEvent,
  CrewMember,
  EventKind,
  PersonDoc,
  PositionDoc,
  PresenceSession,
  Site,
  SitePhoto,
  SiteStatus,
} from "../types/domain.ts";

/**
 * Turns the raw Firebase documents into what the views show. Pure and free of
 * app imports (relative paths only) so it can be checked with `node --test`.
 */

/** A checked-in phone with no fix for this long no longer counts as online. */
export const SIGNAL_LOST_AFTER_MS = 15 * MINUTE;
/** The phone's own map marker goes stale after this (same as the mobile app). */
export const STALE_AFTER_MS = 3 * MINUTE;
/** Longest an abandoned session (never closed, phone reused) is counted for. */
export const ABANDONED_SESSION_MS = 12 * HOUR;

export function deriveCrew(people: PersonDoc[], positions: Record<string, PositionDoc>, now: number): CrewMember[] {
  return people.map(person => {
    const position = positions[person.id];
    const lastFix = position?.lastFixAt;
    const checkedIn = Boolean(position?.siteId);
    const fresh = lastFix != null && now - lastFix <= SIGNAL_LOST_AFTER_MS;

    const status: CrewMember["status"] =
      person.active === false
        ? "deactivated"
        : person.invitedAt != null && lastFix == null
          ? "invited"
          : checkedIn && !position?.paused && fresh
            ? "online"
            : checkedIn
              ? "idle"
              : "offline";

    const hasPosition = position?.lat != null && position?.lng != null && (position.lat !== 0 || position.lng !== 0);
    return {
      id: person.id,
      name: person.name,
      email: person.email ?? "",
      phone: person.phone ?? "",
      jobTitle: person.role,
      team: person.team ?? "",
      appRole: person.appRole,
      color: person.color,
      avatar: person.avatar,
      status,
      kind: lastFix != null && now - lastFix <= STALE_AFTER_MS ? (position?.kind ?? "still") : "stale",
      siteIds: person.siteIds ?? [],
      currentSiteId: checkedIn && position?.siteId ? position.siteId : undefined,
      battery: position?.battery,
      accuracy: position?.accuracy,
      lastSeenAt: lastFix,
      joinedAt: person.invitedAt,
      ...(hasPosition ? { lat: position.lat, lng: position.lng } : {}),
      paused: checkedIn ? Boolean(position?.paused) : undefined,
    };
  });
}

/**
 * Closes sessions that never got a check-out, so hours are not counted forever:
 * - a person whose last fix is older than SIGNAL_LOST_AFTER_MS ended when that fix arrived;
 * - one who has since started a newer session ended no later than that, and no
 *   later than ABANDONED_SESSION_MS after starting (the real end is unknown).
 * ponytail: abandoned sessions are an estimate; have the app close stale sessions on check-in if exact hours matter.
 */
export function settleSessions(
  sessions: PresenceSession[],
  positions: Record<string, PositionDoc>,
  now: number
): PresenceSession[] {
  const startsByPerson = new Map<string, number[]>();
  for (const s of sessions) startsByPerson.set(s.personId, [...(startsByPerson.get(s.personId) ?? []), s.start]);

  return sessions.map(s => {
    if (s.end != null) return s;
    // Just opened: the first fix is still on its way.
    if (now - s.start <= SIGNAL_LOST_AFTER_MS) return s;

    const laterStart = Math.min(...(startsByPerson.get(s.personId) ?? []).filter(start => start > s.start), Infinity);
    const lastFix = positions[s.personId]?.lastFixAt;

    if (laterStart === Infinity && lastFix != null && lastFix >= s.start) {
      return now - lastFix <= SIGNAL_LOST_AFTER_MS ? s : { ...s, end: lastFix, endReason: "timeout" };
    }
    const end = Math.min(s.start + ABANDONED_SESSION_MS, laterStart === Infinity ? now : laterStart);
    return { ...s, end, endReason: "timeout" };
  });
}

const toMillis = (value: unknown, fallback: number): number => {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") {
    return value.toMillis() as number;
  }
  // A just-written serverTimestamp() is null until the server answers.
  return fallback;
};

const initials = (name: string) =>
  name
    .replace(/[^a-zA-Z ]/g, "")
    .split(" ")
    .filter(Boolean)
    .map(w => w[0])
    .join("")
    .slice(0, 4)
    .toUpperCase() || "SITE";

export function toSite(id: string, data: Record<string, unknown>, now: number): Site {
  const name = typeof data.name === "string" ? data.name : "Unnamed site";
  return {
    id,
    name,
    code: typeof data.code === "string" && data.code ? data.code : initials(name),
    status: (typeof data.status === "string" ? data.status : "active") as SiteStatus,
    startedAt: toMillis(data.startedAt ?? data.createdAt, now),
    manager: typeof data.manager === "string" ? data.manager : "",
    color: typeof data.color === "string" ? data.color : "#1c4ff0",
  };
}

export function toPhoto(id: string, data: Record<string, unknown>): SitePhoto {
  const uri = String(data.uri ?? "");
  const isVideo = data.mediaType === "video";
  return {
    id,
    thumbUrl: typeof data.thumbUrl === "string" ? data.thumbUrl : uri,
    fullUrl: uri,
    // Captures from before sizes were recorded: assume the camera's usual 4:3 landscape.
    width: typeof data.width === "number" ? data.width : 1600,
    height: typeof data.height === "number" ? data.height : 1200,
    mediaType: isVideo ? "video" : "photo",
    durationMs: typeof data.durationMs === "number" ? data.durationMs : undefined,
    personId: String(data.personId ?? ""),
    siteId: typeof data.siteId === "string" ? data.siteId : "",
    task: String(data.task ?? ""),
    note: typeof data.note === "string" && data.note.trim() ? data.note.trim() : undefined,
    inventoryId: typeof data.inventoryId === "string" && data.inventoryId ? data.inventoryId : undefined,
    takenAt: Number(data.takenAt ?? 0),
    lat: Number(data.lat ?? 0),
    lng: Number(data.lng ?? 0),
    accuracy: Number(data.accuracy ?? 0),
    plusCode: String(data.plusCode ?? ""),
  };
}

const KNOWN_TYPES: EventKind[] = ["checkin", "checkout", "upload", "battery", "pause", "resume", "crew", "site"];

/** Events written before the app recorded a `type`: guess it from the text the app generated. */
function kindFromText(text: string): EventKind {
  if (/paused sharing/i.test(text)) return "pause";
  if (/resumed sharing/i.test(text)) return "resume";
  if (/uploaded/i.test(text)) return "upload";
  if (/battery/i.test(text)) return "battery";
  if (/deactivated|reactivated|changed .*(role|title)/i.test(text)) return "crew";
  return "other";
}

export function toEvent(id: string, data: Record<string, unknown>, now: number): ActivityEvent {
  const text = String(data.text ?? "");
  const type = data.type as EventKind | undefined;
  const kind = type && KNOWN_TYPES.includes(type) ? type : kindFromText(text);
  return {
    id,
    at: toMillis(data.at, now),
    kind,
    personId: typeof data.personId === "string" ? data.personId : undefined,
    siteId: typeof data.siteId === "string" ? data.siteId : undefined,
    text,
    severity: data.kind === "warn" ? "warn" : kind === "checkin" || kind === "site" ? "success" : "info",
  };
}
