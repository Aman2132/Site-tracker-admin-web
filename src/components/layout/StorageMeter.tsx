"use client";

import { HardDrive } from "lucide-react";
import Link from "next/link";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { fullestAllowance, formatBytes, formatLimit, formatShare } from "@/lib/usage";
import { useStorageUsage } from "@/lib/useStorageUsage";
import { cn } from "@/lib/utils";

/** The sidebar meter re-reads at most this often; opening the Storage page re-reads sooner. */
const MAX_AGE_MS = 60 * 60 * 1000;

const barTone = (fraction: number) => (fraction >= 0.9 ? "bg-danger" : fraction >= 0.7 ? "bg-warning" : "bg-primary");
const textTone = (fraction: number) => (fraction >= 0.9 ? "text-danger" : fraction >= 0.7 ? "text-warning" : "text-foreground");

/**
 * Always-visible storage gauge for the sidebar footer: shows whichever free
 * allowance is closest to full, and opens the full breakdown. Shows the last
 * result straight away and only re-reads when that is over an hour old, so
 * moving between pages costs nothing.
 */
export function StorageMeter({ collapsed }: { collapsed: boolean }) {
  const { firebaseUsage, files, error } = useStorageUsage(MAX_AGE_MS);
  const fullest = firebaseUsage ? fullestAllowance(firebaseUsage.firestoreBytes, firebaseUsage.realtimeBytes, files?.bytes ?? null) : null;

  const summary = fullest
    ? `${fullest.label}: ${formatBytes(fullest.bytes)} of ${formatLimit(fullest.limit)} (${formatShare(fullest.fraction)})`
    : error
      ? "Storage usage unavailable"
      : "Checking storage…";

  const bar = (
    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
      <div
        className={cn("h-full rounded-full transition-[width] duration-700", fullest ? barTone(fullest.fraction) : "bg-muted-foreground/30")}
        style={{ width: `${fullest ? Math.max(fullest.fraction * 100, fullest.bytes > 0 ? 3 : 0) : 0}%` }}
      />
    </div>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <Link
              href="/storage"
              aria-label={`Storage usage. ${summary}`}
              className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-2.5 transition-colors hover:bg-muted"
            />
          }
        >
          <HardDrive className={cn("size-4", fullest ? textTone(fullest.fraction) : "text-muted-foreground")} />
          <span className="w-full">{bar}</span>
        </TooltipTrigger>
        <TooltipContent side="right">{summary}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Link
      href="/storage"
      aria-label={`Storage usage. ${summary}`}
      className="block rounded-lg border border-border bg-card p-3.5 transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40"
    >
      <div className="flex items-center justify-between text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
        <span className="flex items-center gap-1.5">
          <HardDrive className="size-3.5" /> Storage
        </span>
        {fullest && <span className={cn("tabular-nums", textTone(fullest.fraction))}>{formatShare(fullest.fraction)}</span>}
      </div>
      <div className="mt-2">{bar}</div>
      <div className="mt-1.5 truncate text-xs text-muted-foreground">
        {fullest ? `${fullest.label} · ${formatBytes(fullest.bytes)} of ${formatLimit(fullest.limit)}` : error ? "Unavailable" : "Checking…"}
      </div>
    </Link>
  );
}
