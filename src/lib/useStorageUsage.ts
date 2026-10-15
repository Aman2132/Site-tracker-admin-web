"use client";

import { useEffect, useSyncExternalStore } from "react";

import { loadFirebaseUsage, loadPhotoFilesUsage, type FirebaseUsage, type PhotoFilesUsage } from "./usageSnapshot";

/**
 * One shared copy of the storage numbers for everything that shows them (the
 * sidebar meter and the Storage page), so opening a page never repeats a check
 * somebody else just made. The last result is also kept in this browser, so a
 * reload shows it at once and only re-reads once it is older than the caller's
 * `maxAgeMs`.
 */
export interface StorageUsageState {
  firebaseUsage: FirebaseUsage | null;
  files: PhotoFilesUsage | null;
  filesError: string | null;
  error: string | null;
  busy: boolean;
  /** When the numbers were last read, epoch ms. */
  at: number | null;
}

const EMPTY: StorageUsageState = { firebaseUsage: null, files: null, filesError: null, error: null, busy: false, at: null };
const SNAPSHOT_KEY = "storage-usage-snapshot-v1";

let state = EMPTY;
let restored = false;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function set(next: Partial<StorageUsageState>) {
  state = { ...state, ...next };
  listeners.forEach(listener => listener());
}

/** Loads the last result saved in this browser, once. */
function restore() {
  if (restored) return;
  restored = true;
  try {
    const saved = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) ?? "null") as Pick<StorageUsageState, "firebaseUsage" | "files" | "at"> | null;
    if (saved?.at) set({ firebaseUsage: saved.firebaseUsage, files: saved.files, at: saved.at });
  } catch {
    // A private window or corrupt value just means the first view re-reads.
  }
}

function persist() {
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ firebaseUsage: state.firebaseUsage, files: state.files, at: state.at }));
  } catch {
    // Storage full or blocked: the numbers still show, they just aren't remembered.
  }
}

/** Reads everything again. Calls made while a read is running share it. */
export function refreshStorageUsage(): Promise<void> {
  if (inflight) return inflight;
  set({ busy: true });
  inflight = Promise.allSettled([loadFirebaseUsage(), loadPhotoFilesUsage()])
    .then(([fb, ph]) => {
      // A failed half keeps its previous numbers, so one slow service doesn't blank the other.
      set({
        ...(fb.status === "fulfilled" ? { firebaseUsage: fb.value, error: null } : { error: fb.reason instanceof Error ? fb.reason.message : "Couldn't read Firebase usage." }),
        ...(ph.status === "fulfilled" ? { files: ph.value, filesError: null } : { filesError: ph.reason instanceof Error ? ph.reason.message : "Couldn't read photo storage." }),
        at: Date.now(),
        busy: false,
      });
      persist();
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The shared numbers, re-read first if they are older than `maxAgeMs`. */
export function useStorageUsage(maxAgeMs: number) {
  const snapshot = useSyncExternalStore(subscribe, () => state, () => EMPTY);
  useEffect(() => {
    restore();
    if (state.at == null || Date.now() - state.at > maxAgeMs) void refreshStorageUsage();
  }, [maxAgeMs]);
  return { ...snapshot, refresh: refreshStorageUsage };
}
