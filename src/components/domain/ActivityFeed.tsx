"use client";

import {
  BatteryLow,
  Building2,
  Clock3,
  ImageUp,
  LogIn,
  LogOut,
  MailPlus,
  Pause,
  Play,
  type LucideIcon,
} from "lucide-react";
import { motion } from "motion/react";

import { EASE_OUT } from "@/components/motion";
import { formatTime, timeAgo } from "@/lib/format";
import { useLookups } from "@/lib/store";
import { cn } from "@/lib/utils";

import type { ActivityEvent, EventKind } from "@/types/domain";

export const EVENT_META: Record<EventKind, { icon: LucideIcon; tone: string; label: string }> = {
  arrive: { icon: LogIn, tone: "bg-success-soft text-success", label: "Arrivals" },
  leave: { icon: LogOut, tone: "bg-stale-soft text-muted-foreground", label: "Departures" },
  upload: { icon: ImageUp, tone: "bg-accent text-primary", label: "Uploads" },
  battery: { icon: BatteryLow, tone: "bg-danger-soft text-danger", label: "Battery" },
  pause: { icon: Pause, tone: "bg-warning-soft text-warning", label: "Paused" },
  resume: { icon: Play, tone: "bg-success-soft text-success", label: "Resumed" },
  idle: { icon: Clock3, tone: "bg-warning-soft text-warning", label: "Idle alerts" },
  invite: { icon: MailPlus, tone: "bg-accent text-chart-4", label: "Invites" },
  site: { icon: Building2, tone: "bg-accent text-primary", label: "Sites" },
};

export function ActivityFeed({
  events,
  compact = false,
  showSite = true,
}: {
  events: ActivityEvent[];
  compact?: boolean;
  showSite?: boolean;
}) {
  const { siteById } = useLookups();
  return (
    <ol className="relative">
      {events.map((event, i) => {
        const meta = EVENT_META[event.kind];
        const site = event.siteId ? siteById.get(event.siteId) : undefined;
        return (
          <motion.li
            key={event.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease: EASE_OUT, delay: Math.min(i, 12) * 0.035 }}
            className="relative flex gap-3 pb-4 last:pb-0"
          >
            {i < events.length - 1 && <span className="absolute top-9 bottom-0 left-[17px] w-px bg-border" />}
            <span className={cn("relative z-10 flex size-9 shrink-0 items-center justify-center rounded-xl", meta.tone)}>
              <meta.icon className="size-4" strokeWidth={2.2} />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className={cn("text-sm leading-snug font-medium", compact && "line-clamp-2")}>{event.text}</p>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>{compact ? timeAgo(event.at) : formatTime(event.at)}</span>
                {showSite && site && (
                  <>
                    <span className="size-1 rounded-full bg-faint" />
                    <span className="truncate">{site.name}</span>
                  </>
                )}
              </div>
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}
