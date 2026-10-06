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
