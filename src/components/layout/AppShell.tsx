"use client";

import { MotionConfig } from "motion/react";
import { useCallback, useSyncExternalStore, type ReactNode } from "react";

import { DemoStoreProvider } from "@/lib/store";

import { DialogsProvider } from "./DialogsProvider";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

const COLLAPSE_KEY = "sta.sidebar-collapsed";
const listeners = new Set<() => void>();
/** Fallback when storage is unavailable (private mode), so the toggle still works for the visit. */
let memoryCollapsed = false;

/** Sidebar collapse, remembered per browser. */
function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return memoryCollapsed;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function AppShell({ children }: { children: ReactNode }) {
  const collapsed = useSyncExternalStore(subscribe, readCollapsed, () => false);

  const toggle = useCallback(() => {
    const next = !readCollapsed();
    memoryCollapsed = next;
    try {
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
    } catch {}
    listeners.forEach(l => l());
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <DemoStoreProvider>
        <DialogsProvider>
          <div className="flex min-h-dvh">
            <Sidebar collapsed={collapsed} onToggle={toggle} />
            <div className="flex min-w-0 flex-1 flex-col">
              <Topbar />
              <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
                <div className="mx-auto w-full max-w-[1480px]">{children}</div>
              </main>
            </div>
          </div>
        </DialogsProvider>
      </DemoStoreProvider>
    </MotionConfig>
  );
}
