"use client";

import { motion } from "motion/react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EASE_OUT } from "@/components/motion";
import { formatDay, formatHours, formatTime, formatWeekday, formatDayMonth, istHourOfDay } from "@/lib/format";
import { sessionEnd, type AttendanceCell } from "@/lib/insights";
import { NOW } from "@/lib/mock/data";
import { cn } from "@/lib/utils";

const START_HOUR = 6;
const END_HOUR = 22;
const SPAN = END_HOUR - START_HOUR;
const pos = (t: number) => Math.min(100, Math.max(0, ((istHourOfDay(t) - START_HOUR) / SPAN) * 100));

const END_LABEL = { "signed-off": "signed off", paused: "paused sharing", timeout: "lost signal" } as const;

/** Hour ruler shared by every timeline row. */
export function TimelineRuler({ className }: { className?: string }) {
  const ticks = Array.from({ length: SPAN / 2 + 1 }, (_, i) => START_HOUR + i * 2);
  return (
    <div className={cn("relative h-5 text-[10px] font-semibold text-faint", className)}>
      {ticks.map(h => (
        <span key={h} className="absolute -translate-x-1/2" style={{ left: `${((h - START_HOUR) / SPAN) * 100}%` }}>
          {h === 12 ? "12p" : h > 12 ? `${h - 12}p` : `${h}a`}
        </span>
      ))}
    </div>
  );
}

/**
 * One day's online/offline bands. Each band is a sharing session; gaps are
 * offline (paused, signed off, or no signal).
 */
export function TimelineTrack({ cell, color = "var(--success)", delay = 0 }: { cell: AttendanceCell; color?: string; delay?: number }) {
  return (
    <div className="relative h-8 rounded-lg bg-muted/70">
      {/* hour gridlines */}
      {Array.from({ length: SPAN / 2 - 1 }, (_, i) => (
        <span key={i} className="absolute top-1 bottom-1 w-px bg-border" style={{ left: `${(((i + 1) * 2) / SPAN) * 100}%` }} />
      ))}
      {cell.sessions.map((s, i) => {
        const left = pos(s.start);
        const right = pos(sessionEnd(s));
        const open = s.end == null;
        return (
          <Tooltip key={s.id}>
            <TooltipTrigger
              render={
                <motion.span
                  className="absolute top-1.5 bottom-1.5 origin-left cursor-default rounded-md"
                  style={{ left: `${left}%`, width: `${Math.max(0.8, right - left)}%`, backgroundColor: color }}
                  initial={{ scaleX: 0, opacity: 0 }}
                  animate={{ scaleX: 1, opacity: 1 }}
                  transition={{ duration: 0.7, ease: EASE_OUT, delay: delay + i * 0.08 }}
                  whileHover={{ scaleY: 1.25 }}
                />
              }
            />
            <TooltipContent>
              {formatTime(s.start)} – {open ? "now" : formatTime(sessionEnd(s))} · {formatHours(sessionEnd(s) - s.start)}
              {!open && s.endReason && <span className="opacity-70"> · {END_LABEL[s.endReason]}</span>}
            </TooltipContent>
          </Tooltip>
        );
      })}
      {cell.open && (
        <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2" style={{ left: `${pos(NOW)}%` }}>
          <span className="absolute inset-0 animate-ping-soft rounded-full bg-success" />
          <span className="absolute inset-0.5 rounded-full bg-success ring-2 ring-card" />
        </span>
      )}
    </div>
  );
}

/** Day-by-day rows for one person. */
export function PresenceTimeline({ cells }: { cells: AttendanceCell[] }) {
  return (
    <div>
      <div className="grid grid-cols-[72px_1fr_64px] gap-3">
        <span />
        <TimelineRuler />
        <span />
      </div>
      <div className="space-y-2">
        {[...cells].reverse().map((cell, i) => (
          <div key={cell.day} className="grid grid-cols-[72px_1fr_64px] items-center gap-3">
            <div className="leading-tight" title={formatDay(cell.day)}>
              <div className="text-sm font-bold">{formatWeekday(cell.day)}</div>
              <div className="text-[11px] text-muted-foreground">{formatDayMonth(cell.day)}</div>
            </div>
            {cell.sessions.length ? (
              <TimelineTrack cell={cell} delay={i * 0.05} />
            ) : (
              <div className="flex h-8 items-center rounded-lg border border-dashed border-border px-3 text-xs text-faint">Off</div>
            )}
            <div className="text-right leading-tight">
              <div className="text-sm font-bold tabular-nums">{cell.workedMs ? formatHours(cell.workedMs) : "—"}</div>
              {cell.late && <div className="text-[10px] font-bold text-warning uppercase">Late</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
