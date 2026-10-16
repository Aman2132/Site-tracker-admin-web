import { HOUR, MINUTE } from "./time.ts";

/**
 * Pure helpers for the admin action log. Relative imports only so they can be
 * checked with `node --test`. Nothing here talks to Firebase; admin.ts and
 * store.tsx do the writing.
 */

/** What an entry in the permanent audit log is. Entries from before this existed have no kind and read as "change". */
export type AuditKind = "change" | "auth" | "failed" | "export";

/** What a page-log entry is: an in-dashboard page, or a click that leaves the dashboard. */
export type ViewKind = "view" | "external";

export const CHANGES_MAX = 1000;
export const REASON_MAX = 300;

/** One field of an edit, shown as `label: "before" → "after"`. */
export interface FieldChange {
  label: string;
  before: unknown;
  after: unknown;
}

const show = (value: unknown): string => {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (Array.isArray(value)) return value.length ? value.map(show).join(", ") : "—";
  return typeof value === "string" ? `"${value}"` : String(value);
};

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/**
 * "name: "A" → "B"; status: "planning" → "active"" for the fields that really
 * changed; undefined when nothing did. Clipped to what the audit rules allow.
 */
export function describeChanges(fields: FieldChange[]): string | undefined {
  const changed = fields.filter(f => show(f.before) !== show(f.after));
  if (changed.length === 0) return undefined;
  return clip(changed.map(f => `${f.label}: ${show(f.before)} → ${show(f.after)}`).join("; "), CHANGES_MAX);
}

/** What was created or removed, as `label: value` pairs (no before/after), e.g. for deletions. */
export function describeFields(fields: { label: string; value: unknown }[]): string | undefined {
  const present = fields.filter(f => show(f.value) !== "—");
  return present.length ? clip(present.map(f => `${f.label}: ${show(f.value)}`).join("; "), CHANGES_MAX) : undefined;
}

/** "A, B and 3 more" for a list of names, so a bulk action stays one short line. */
export function listNames(names: string[], max = 5): string {
  if (names.length <= max) return names.join(", ");
  return `${names.slice(0, max).join(", ")} and ${names.length - max} more`;
}

/** Reason text for a failed action, clipped to what the rules allow. */
export const failureReason = (error: unknown): string =>
  clip(error instanceof Error && error.message ? error.message : "Something went wrong.", REASON_MAX);

/** Whether the failure was the database or server refusing the person (as opposed to an error). */
export function wasRefused(error: unknown): boolean {
  const text = `${(error as { code?: string })?.code ?? ""} ${error instanceof Error ? error.message : ""}`.toLowerCase();
  return /permission-denied|missing or insufficient permissions|only the superadmin|only an active owner|\b40[13]\b/.test(text);
}

// ---------------------------------------------------------------- page views

/** Dashboard routes, as the title shown in the log. Anything else shows its path. */
const TITLES: [RegExp, string][] = [
  [/^\/$/, "Overview"],
  [/^\/map/, "Live map"],
  [/^\/sites\/[^/]+/, "Site"],
  [/^\/sites/, "Sites"],
  [/^\/crew\/[^/]+/, "Crew profile"],
  [/^\/crew/, "Crew"],
  [/^\/photos/, "Photos"],
  [/^\/inventory/, "Inventory"],
  [/^\/attendance/, "Attendance"],
  [/^\/activity/, "Activity"],
  [/^\/admins/, "Admins"],
  [/^\/audit/, "Audit log"],
  [/^\/storage/, "Storage"],
  [/^\/settings/, "Settings"],
];
export const pageTitle = (path: string) => TITLES.find(([re]) => re.test(path))?.[1] ?? path;

/**
 * A link that leaves the dashboard, reduced to something safe to store: the
 * host and path with no query string or fragment (those can carry tokens).
 * Null for links that stay on the dashboard or aren't http(s).
 */
export function externalTarget(href: string, ownOrigin: string): string | null {
  try {
    const url = new URL(href, ownOrigin);
    if (!/^https?:$/.test(url.protocol) || url.origin === ownOrigin) return null;
    return clip(`${url.host}${url.pathname}`, 300);
  } catch {
    return null;
  }
}

export interface ViewGateOptions {
  /** The same page opened again within this long counts once. */
  dedupeMs: number;
  /** At most this many entries per hour; the rest are dropped. */
  maxPerHour: number;
}

export const VIEW_GATE: ViewGateOptions = { dedupeMs: 5 * MINUTE, maxPerHour: 120 };

/** What a gate remembers, so it can survive a page reload (a reload loop must not dodge the hourly cap). */
export interface GateState {
  lastSeen: [string, number][];
  recent: number[];
}

/**
 * Decides whether a page view is worth a log entry, so reloads, back-and-forth
 * clicking and a stuck loop can't flood the database. Stateful, one per tab;
 * `initial` restores what an earlier page load of the same tab had seen, and
 * `onChange` hands back the state to save.
 */
export function createViewGate(options: ViewGateOptions = VIEW_GATE, initial?: GateState, onChange?: (state: GateState) => void) {
  const lastSeen = new Map<string, number>(initial?.lastSeen ?? []);
  let recent: number[] = [...(initial?.recent ?? [])];
  return {
    allow(key: string, now: number): boolean {
      const last = lastSeen.get(key);
      if (last !== undefined && now - last < options.dedupeMs) return false;
      recent = recent.filter(t => now - t < HOUR);
      if (recent.length >= options.maxPerHour) return false;
      lastSeen.set(key, now);
      recent.push(now);
      onChange?.({ lastSeen: [...lastSeen].filter(([, t]) => now - t < options.dedupeMs), recent });
      return true;
    },
  };
}
