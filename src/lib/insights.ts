import { createRandom } from "@/lib/mock/random";
import { DAY, HOUR, NOW, istDayStart } from "@/lib/mock/data";
import { istHourOfDay } from "@/lib/format";

import type { CrewMember, PresenceSession, SitePhoto } from "@/types/domain";

/**
 * Pure derivations over the dataset — the numbers the dashboard shows.
 * These are exactly the queries a real backend (or a Postgres view) would
 * need to answer, which is why they live apart from the components.
 */

export const LOW_BATTERY = 0.2;
export const IDLE_AFTER_MS = HOUR;
/** Arriving after this IST hour counts as late on the attendance grid. */
export const LATE_AFTER_HOUR = 9.25;

export const sessionEnd = (s: PresenceSession) => s.end ?? NOW;
export const sessionLength = (s: PresenceSession) => sessionEnd(s) - s.start;

/** Overlap of a session with [from, to). */
function overlap(s: PresenceSession, from: number, to: number) {
  return Math.max(0, Math.min(sessionEnd(s), to) - Math.max(s.start, from));
}

export function lastNDays(n: number): number[] {
  const today = istDayStart(NOW);
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
      late: firstIn != null && istHourOfDay(firstIn) > LATE_AFTER_HOUR,
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
  reason: "idle" | "battery" | "invited" | "offline";
  detail: string;
}

export function needsAttention(crew: CrewMember[]): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const c of crew) {
    if (c.status === "idle") items.push({ id: `${c.id}-idle`, person: c, reason: "idle", detail: "No update for over 1 hour" });
    if (c.battery != null && c.battery <= LOW_BATTERY && c.status !== "deactivated")
      items.push({ id: `${c.id}-bat`, person: c, reason: "battery", detail: `Battery at ${Math.round(c.battery * 100)}%` });
    if (c.status === "invited") items.push({ id: `${c.id}-inv`, person: c, reason: "invited", detail: "Hasn't accepted the invite yet" });
  }
  return items;
}

/** Share of tracked time spent walking / driving / still. Derived per person, deterministic. */
export function activityMix(personId: string) {
  const r = createRandom(personId.charCodeAt(0) * 131 + personId.charCodeAt(1));
  const walk = r.between(0.3, 0.55);
  const vehicle = r.between(0.05, 0.25);
  return [
    { kind: "walk", label: "Walking", value: walk },
    { kind: "vehicle", label: "Driving", value: vehicle },
    { kind: "still", label: "Still", value: 1 - walk - vehicle },
  ] as const;
}
