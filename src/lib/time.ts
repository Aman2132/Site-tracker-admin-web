export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** Nepal Time is UTC+5:45 — every date in the dashboard is shown and bucketed in it. */
export const TZ_OFFSET = 5.75 * HOUR;
export const TZ_LABEL = "Nepal Time (UTC+5:45)";

/** Midnight (Nepal time) of the day containing `t`, as an epoch ms. */
export function dayStart(t: number): number {
  return Math.floor((t + TZ_OFFSET) / DAY) * DAY - TZ_OFFSET;
}

/** "YYYY-MM-DDTHH:mm" in Nepal time, the value an `<input type="datetime-local">` takes. */
export function toLocalInput(t: number): string {
  return new Date(t + TZ_OFFSET).toISOString().slice(0, 16);
}

/** Inverse of toLocalInput (the text is read as Nepal time). NaN for an empty or bad value. */
export function fromLocalInput(value: string): number {
  return value ? Date.parse(`${value}:00Z`) - TZ_OFFSET : NaN;
}

/** Why a corrected check-in/out can't be saved, or null. Mirrors firestore.rules (end >= start). */
export function sessionTimesProblem(start: number, end: number | undefined, now: number): string | null {
  if (Number.isNaN(start)) return "Enter a check-in time.";
  if (end != null && Number.isNaN(end)) return "Enter a valid check-out time, or leave it empty.";
  if (start > now || (end != null && end > now)) return "Times can't be in the future.";
  if (end != null && end < start) return "Check-out must be after check-in.";
  return null;
}
