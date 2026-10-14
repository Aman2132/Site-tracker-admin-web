"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Per-browser dashboard preferences (Settings page). Stored in localStorage, so they follow the
 * browser, not the account; a private window or cleared storage falls back to the defaults.
 * ponytail: per-browser on purpose; move to the admin's people/{uid} doc if they should follow the account.
 */
export interface Prefs {
  /** Site every site filter starts on ("all" = no default). */
  defaultSite: string;
  /** Browser notification when someone on shift loses signal (only while the dashboard is open). */
  notifySignalLost: boolean;
  /** Browser notification when someone on shift drops to low battery. */
  notifyLowBattery: boolean;
}

const KEY = "sta.prefs";
const DEFAULTS: Prefs = { defaultSite: "all", notifySignalLost: false, notifyLowBattery: false };
const listeners = new Set<() => void>();
let cache: Prefs | null = null;

function read(): Prefs {
  if (cache) return cache;
  try {
    cache = { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Prefs>) };
  } catch {
    cache = DEFAULTS;
  }
  return cache;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePrefs(): [Prefs, <K extends keyof Prefs>(key: K, value: Prefs[K]) => void] {
  const prefs = useSyncExternalStore(subscribe, read, () => DEFAULTS);
  const set = useCallback(<K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    cache = { ...read(), [key]: value };
    try {
      localStorage.setItem(KEY, JSON.stringify(cache));
    } catch {}
    listeners.forEach(l => l());
  }, []);
  return [prefs, set];
}

/** The default site if it still exists, else "all". For a filter's initial state. */
export function defaultSiteAmong(sites: { id: string }[]): string {
  const id = read().defaultSite;
  return sites.some(s => s.id === id) ? id : "all";
}
