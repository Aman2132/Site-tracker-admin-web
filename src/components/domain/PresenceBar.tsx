"use client";

import { motion } from "motion/react";

import { EASE_OUT } from "@/components/motion";
import { cn } from "@/lib/utils";

import type { PresenceStatus } from "@/types/domain";

import { STATUS_META } from "./StatusDot";

const ORDER: PresenceStatus[] = ["online", "idle", "offline", "invited"];

/** Horizontal stacked bar of crew presence, segments grow in sequence. */
export function PresenceBar({
  counts,
  className,
  dark = false,
}: {
  counts: Record<PresenceStatus, number>;
  className?: string;
  dark?: boolean;
}) {
  const total = ORDER.reduce((s, k) => s + counts[k], 0) || 1;
  return (
    <div className={className}>
      <div className={cn("flex h-3 gap-1 overflow-hidden rounded-full", dark ? "bg-white/10" : "bg-muted")}>
        {ORDER.map((k, i) =>
          counts[k] ? (
            <motion.div
              key={k}
              className={cn("h-full rounded-full", STATUS_META[k].dot)}
              initial={{ width: 0 }}
              animate={{ width: `${(counts[k] / total) * 100}%` }}
              transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.25 + i * 0.12 }}
            />
          ) : null
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
        {ORDER.map(k => (
          <div key={k} className={cn("flex items-center gap-2 text-sm", dark ? "text-white/70" : "text-muted-foreground")}>
            <span className={cn("size-2 rounded-full", STATUS_META[k].dot)} />
            {STATUS_META[k].label}
            <span className={cn("font-bold", dark ? "text-white" : "text-foreground")}>{counts[k]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
