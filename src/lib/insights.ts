import { hourOfDay, timeAgo } from "@/lib/format";
import { DAY, HOUR, dayStart } from "@/lib/time";

import type { CrewMember, PresenceSession, SitePhoto } from "@/types/domain";

/**
 * Pure derivations over the live data — the numbers the dashboard shows.
 * They live apart from the components so the views stay thin.
 */

export const LOW_BATTERY = 0.2;
/** Arriving after this hour (Nepal time) counts as late on the attendance grid. */
export const LATE_AFTER_HOUR = 9.25;

export const sessionEnd = (s: PresenceSession) => s.end ?? Date.now();
export const sessionLength = (s: PresenceSession) => sessionEnd(s) - s.start;

/** Overlap of a session with [from, to). */
function overlap(s: PresenceSession, from: number, to: number) {
  return Math.max(0, Math.min(sessionEnd(s), to) - Math.max(s.start, from));
}

export function lastNDays(n: number): number[] {
  const today = dayStart(Date.now());
  return Array.from({ length: n }, (_, i) => today - (n - 1 - i) * DAY);
}

export function hoursOnDay(sessions: PresenceSession[], dayStart: number): number {
  return sessions.reduce((sum, s) => sum + overlap(s, dayStart, dayStart + DAY), 0);
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
}

export function attendanceFor(personId: string, sessions: PresenceSession[], days: number[]): AttendanceCell[] {
  const mine = sessions.filter(s => s.personId === personId);
  return days.map(day => {
    const todays = sessionsOnDay(mine, day).sort((a, b) => a.start - b.start);
    const firstIn = todays[0]?.start;
    const last = todays[todays.length - 1];
    return {
      day,
      sessions: todays,
      workedMs: hoursOnDay(todays, day),
      firstIn,
      lastOut: last ? last.end : undefined,
      late: firstIn != null && hourOfDay(firstIn) > LATE_AFTER_HOUR,
      open: todays.some(s => s.end == null),
    };
  });
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
