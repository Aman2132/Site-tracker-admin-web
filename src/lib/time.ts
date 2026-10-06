export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** IST is UTC+5:30 — every date in the dashboard is shown and bucketed in it. */
export const IST_OFFSET = 5.5 * HOUR;

/** Midnight IST of the day containing `t`, as an epoch ms. */
export function istDayStart(t: number): number {
  return Math.floor((t + IST_OFFSET) / DAY) * DAY - IST_OFFSET;
}
