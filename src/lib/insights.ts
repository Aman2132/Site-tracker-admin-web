import { hourOfDay, timeAgo } from "./format.ts";
import { DAY, HOUR, MINUTE, dayStart } from "./time.ts";

import type { ActivityEvent, CrewMember, PresenceSession, SitePhoto } from "../types/domain.ts";

/**
 * Pure derivations over the live data — the numbers the dashboard shows.
 * They live apart from the components so the views stay thin.
 */

export const LOW_BATTERY = 0.2;
/** Arriving after this hour (Nepal time) counts as late on the attendance grid. */
export const LATE_AFTER_HOUR = 9.25;

/** A day longer than this is almost certainly a session nobody closed; it gets flagged for a correction. */
export const LONG_SHIFT_MS = 12 * HOUR;
/** A check-in shorter than this isn't counted as a shift. */
export const MIN_SHIFT_MS = MINUTE;

export const sessionEnd = (s: PresenceSession) => s.end ?? Date.now();
export const sessionLength = (s: PresenceSession) => sessionEnd(s) - s.start;

/** Overlap of a session with [from, to). */
function overlap(s: PresenceSession, from: number, to: number) {
  return Math.max(0, Math.min(sessionEnd(s), to) - Math.max(s.start, from));
}

/** Checked-in time inside [from, to). One person's overlapping sessions count once, so a duplicate check-in doesn't double their hours. */
export function workedMs(sessions: PresenceSession[], from: number, to: number): number {
  const byPerson = new Map<string, [number, number][]>();
  for (const s of sessions) {
    const a = Math.max(s.start, from);
    const b = Math.min(sessionEnd(s), to);
    if (b > a) byPerson.set(s.personId, [...(byPerson.get(s.personId) ?? []), [a, b]]);
  }
  let total = 0;
  for (const spans of byPerson.values()) {
    spans.sort((x, y) => x[0] - y[0]);
    let [start, end] = spans[0];
    for (const [a, b] of spans.slice(1)) {
      if (a <= end) end = Math.max(end, b);
      else {
        total += end - start;
        [start, end] = [a, b];
      }
    }
    total += end - start;
  }
  return total;
}

/** Ids of sessions that overlap another session of the same person. */
export function overlappingSessionIds(sessions: PresenceSession[]): Set<string> {
  const ids = new Set<string>();
  const byPerson = new Map<string, PresenceSession[]>();
  for (const s of sessions) byPerson.set(s.personId, [...(byPerson.get(s.personId) ?? []), s]);
  for (const list of byPerson.values()) {
    list.sort((a, b) => a.start - b.start);
    let latest: PresenceSession | undefined;
    for (const s of list) {
      if (latest && s.start < sessionEnd(latest)) {
        ids.add(s.id);
        ids.add(latest.id);
      }
      if (!latest || sessionEnd(s) > sessionEnd(latest)) latest = s;
    }
  }
  return ids;
}

/** On shift = checked in at a site right now (sharing or not). The one definition every tile uses. */
export const isOnShift = (c: CrewMember) => c.currentSiteId != null && (c.status === "online" || c.status === "idle");

export function lastNDays(n: number): number[] {
  const today = dayStart(Date.now());
  return Array.from({ length: n }, (_, i) => today - (n - 1 - i) * DAY);
}

export function hoursOnDay(sessions: PresenceSession[], dayStart: number): number {
  return workedMs(sessions, dayStart, dayStart + DAY);
}

export function sessionsOnDay(sessions: PresenceSession[], dayStart: number) {
  return sessions.filter(s => overlap(s, dayStart, dayStart + DAY) > 0);
}

export interface DailyStat {
  day: number;
  crewOnline: number;
  hours: number;
  photos: number;
}

export function dailyStats(sessions: PresenceSession[], photos: SitePhoto[], days: number): DailyStat[] {
  return lastNDays(days).map(day => {
    const todays = sessionsOnDay(sessions, day);
    return {
      day,
      crewOnline: new Set(todays.map(s => s.personId)).size,
      hours: hoursOnDay(todays, day) / HOUR,
      photos: photos.filter(p => p.takenAt >= day && p.takenAt < day + DAY).length,
    };
  });
}

export interface AttendanceCell {
  day: number;
  sessions: PresenceSession[];
  workedMs: number;
  firstIn?: number;
  lastOut?: number;
  late: boolean;
  open: boolean;
  /** Over LONG_SHIFT_MS: most likely a check-out that never happened. */
  long: boolean;
}

export function attendanceFor(personId: string, sessions: PresenceSession[], days: number[]): AttendanceCell[] {
  const mine = sessions.filter(s => s.personId === personId);
  return days.map(day => {
    const todays = sessionsOnDay(mine, day).sort((a, b) => a.start - b.start);
    const firstIn = todays[0]?.start;
    const last = todays[todays.length - 1];
    const worked = hoursOnDay(todays, day);
    return {
      day,
      sessions: todays,
      workedMs: worked,
      long: worked > LONG_SHIFT_MS || todays.some(s => sessionLength(s) > LONG_SHIFT_MS),
      firstIn,
      lastOut: last ? last.end : undefined,
      late: firstIn != null && hourOfDay(firstIn) > LATE_AFTER_HOUR,
      open: todays.some(s => s.end == null),
    };
  });
}

/** Newest-first events with back-to-back repeats (same person, same text, within REPEAT_WINDOW_MS) folded into one with a count. */
const REPEAT_WINDOW_MS = 10 * MINUTE;
export function collapseRepeats(events: ActivityEvent[]): (ActivityEvent & { count: number })[] {
  const out: (ActivityEvent & { count: number })[] = [];
  for (const e of events) {
    const prev = out[out.length - 1];
    if (prev && prev.text === e.text && prev.personId === e.personId && Math.abs(prev.at - e.at) <= REPEAT_WINDOW_MS) prev.count++;
    else out.push({ ...e, count: 1 });
  }
  return out;
}

export function presenceCounts(crew: CrewMember[]) {
  const counts = { online: 0, idle: 0, offline: 0, invited: 0, deactivated: 0 };
  for (const c of crew) counts[c.status]++;
  return counts;
}

export interface AttentionItem {
  id: string;
  person: CrewMember;
  reason: "idle" | "battery" | "invited";
  detail: string;
}

export function needsAttention(crew: CrewMember[]): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const c of crew) {
    if (c.status === "idle") {
      items.push({
        id: `${c.id}-idle`,
        person: c,
        reason: "idle",
        detail: c.paused ? "Paused sharing" : `No update since ${timeAgo(c.lastSeenAt)}`,
      });
    }
    if (c.battery != null && c.battery <= LOW_BATTERY && (c.status === "online" || c.status === "idle"))
      items.push({ id: `${c.id}-bat`, person: c, reason: "battery", detail: `Battery at ${Math.round(c.battery * 100)}%` });
    if (c.status === "invited") items.push({ id: `${c.id}-inv`, person: c, reason: "invited", detail: "Hasn't signed in yet" });
  }
  return items;
}
