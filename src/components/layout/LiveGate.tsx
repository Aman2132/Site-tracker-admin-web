"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

import { useLiveStore } from "@/lib/store";

/** Holds the page back until the first live data arrives, and says so when a listener fails. */
export function LiveGate({ children }: { children: ReactNode }) {
  const { ready, error } = useLiveStore();

  return (
    <>
      {error && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl bg-danger-soft p-4 text-sm font-medium text-danger">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            {error}
            <div className="mt-0.5 text-xs font-normal opacity-80">
              If this says missing or insufficient permissions, deploy the latest firestore.rules from the app repo.
            </div>
          </div>
        </div>
      )}
      {ready ? (
        children
      ) : (
        !error && (
          <div className="flex h-64 items-center justify-center text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
          </div>
        )
      )}
    </>
  );
}
