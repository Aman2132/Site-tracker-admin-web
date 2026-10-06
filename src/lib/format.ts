import { DAY, HOUR, TZ_OFFSET, MINUTE } from "@/lib/time";

/**
 * Dates render in Nepal time, computed by hand rather than through Intl so the
 * server render and every browser produce byte-identical strings (ICU
 * versions differ on commas and narrow spaces, which breaks hydration).
 */
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function local(t: number) {
  const d = new Date(t + TZ_OFFSET);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth(),
    day: d.getUTCDate(),
    weekday: d.getUTCDay(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
  };
}

export function formatTime(t: number): string {
  const { hour, minute } = local(t);
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "am" : "pm"}`;
}

export const formatWeekday = (t: number) => WEEKDAYS[local(t).weekday];
export const formatDayMonth = (t: number) => {
  const d = local(t);
  return `${d.day} ${MONTHS[d.month]}`;
};
export const formatDay = (t: number) => `${formatWeekday(t)}, ${formatDayMonth(t)}`;
export const formatDate = (t: number) => `${formatDayMonth(t)} ${local(t).year}`;
export const formatDateTime = (t: number) => `${formatDay(t)} · ${formatTime(t)}`;

/** Hour-of-day in Nepal time as a fraction, e.g. 15.5 for 3:30 pm. */
export function hourOfDay(t: number): number {
  const { hour, minute } = local(t);
  return hour + minute / 60;
}

/** 9.25 → "9:15 am". */
export function formatClock(hourOfDay: number): string {
  const totalMin = Math.round(hourOfDay * 60);
  const hour = Math.floor(totalMin / 60) % 24;
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(totalMin % 60).padStart(2, "0")} ${hour < 12 ? "am" : "pm"}`;
}

/** "just now", "12m ago", "3h ago", "2d ago". */
export function timeAgo(t?: number): string {
  if (t == null) return "never";
  const diff = Math.max(0, Date.now() - t);
  if (diff < MINUTE) return "just now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  return `${Math.floor(diff / DAY)}d ago`;
}

/** 7.5 h → "7h 30m". */
export function formatHours(ms: number): string {
  const totalMin = Math.round(ms / MINUTE);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** 27.7172, 85.324 -> "27.717200° N, 85.324000° E"; the letter follows the sign. */
export function formatCoord(lat: number, lng: number): string {
  return `${Math.abs(lat).toFixed(6)}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(lng).toFixed(6)}° ${lng >= 0 ? "E" : "W"}`;
}

export const percent = (v: number) => `${Math.round(v * 100)}%`;
