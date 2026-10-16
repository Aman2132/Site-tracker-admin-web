"use client";

import { describeFields } from "@/lib/auditLog";
import { AlarmClock, Building2, CalendarRange, Download, Timer, TriangleAlert, UserCheck, WifiOff } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/domain/PageHeader";
import { Panel } from "@/components/domain/Panel";
import { PersonAvatar } from "@/components/domain/PersonAvatar";
import { TimelineRuler, TimelineTrack } from "@/components/domain/PresenceTimeline";
import { SegmentedControl } from "@/components/domain/SegmentedControl";
import { StatCard } from "@/components/domain/StatCard";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDay, formatDayMonth, formatHours, formatTime, formatWeekday } from "@/lib/format";
import { MIN_SHIFT_MS, attendanceFor, lastNDays, type AttendanceCell } from "@/lib/insights";
import { HOUR, dayStart } from "@/lib/time";
import { logAction, useLiveStore, useLookups, useNow } from "@/lib/store";
import { defaultSiteAmong } from "@/lib/prefs";
import { cn } from "@/lib/utils";

/** A full shift; cells are shaded by how close they get to it. */
const FULL_DAY = 9 * HOUR;

/** A check-in with (next to) no time on it isn't a shift: it shows like a day off. */
const hasShift = (cell: AttendanceCell) => cell.workedMs >= MIN_SHIFT_MS;

/** Late / lost signal / too long, as icons inside the cell (shared by the grid and the phone list). */
function CellFlags({ cell, className }: { cell: AttendanceCell; className?: string }) {
  const timeout = cell.sessions.some(s => s.endReason === "timeout");
  if (!cell.late && !timeout && !cell.long && !cell.open) return null;
  return (
    <span className={cn("flex items-center gap-0.5", className)}>
      {cell.long && <TriangleAlert className="size-3.5 text-danger" aria-label="Over 12 hours" />}
      {cell.late && <AlarmClock className="size-3.5 text-warning" aria-label="Late" />}
      {timeout && <WifiOff className="size-3.5 text-chart-4" aria-label="Lost signal" />}
      {cell.open && <span className="size-2 animate-pulse rounded-full bg-success ring-1 ring-card" aria-label="On shift now" />}
    </span>
  );
}

function HeatCell({ cell, delay, href }: { cell: AttendanceCell; delay: number; href: string }) {
  if (!hasShift(cell)) {
    return (
      <div
        className="flex h-12 items-center justify-center"
        title={cell.sessions.length ? `${formatDay(cell.day)}: checked in, no time logged` : `${formatDay(cell.day)}: off`}
      >
        <span className="size-1.5 rounded-full bg-border" />
      </div>
    );
  }
  const strength = Math.min(1, cell.workedMs / FULL_DAY);
  const timeout = cell.sessions.some(s => s.endReason === "timeout");
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, delay }}
            whileHover={{ scale: 1.06, zIndex: 2 }}
            className={cn(
              "relative flex h-12 cursor-default flex-col items-center justify-center rounded-xl text-xs font-bold",
              cell.long && "ring-2 ring-danger"
            )}
            style={{
              backgroundColor: `color-mix(in oklab, var(--primary) ${Math.round(10 + strength * 70)}%, var(--card))`,
              color: strength > 0.55 ? "white" : "var(--foreground)",
            }}
          />
        }
      >
        {formatHours(cell.workedMs)}
        <CellFlags cell={cell} className="mt-0.5 rounded-md bg-card/90 px-0.5" />
      </TooltipTrigger>
      <TooltipContent>
        <div className="font-semibold">{formatDay(cell.day)}</div>
        <div className="opacity-80">
          In {formatTime(cell.firstIn!)} · {cell.open ? "still on shift" : `out ${formatTime(cell.lastOut!)}`}
        </div>
        <div className="opacity-80">
          {cell.sessions.length} session{cell.sessions.length > 1 ? "s" : ""}
          {cell.late ? " · late" : ""}
          {timeout ? " · lost signal" : ""}
        </div>
        {cell.long && (
          <Link href={href} className="mt-1 block font-semibold text-danger underline">
            Over 12 h, probably a missed check-out. Correct it
          </Link>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

export function AttendanceView() {
  const { roster: crew, sessions, sites } = useLiveStore();
  const { siteById } = useLookups();
  const now = useNow();
  const [mode, setMode] = useState<"grid" | "timeline">("grid");
  const [span, setSpan] = useState<"7" | "14">("7");
  const [site, setSite] = useState(() => defaultSiteAmong(sites));
  const [timelineDay, setTimelineDay] = useState(() => dayStart(now));

  const days = useMemo(() => lastNDays(Number(span)), [span]);
  const people = useMemo(
    () => crew.filter(c => c.status !== "invited" && (site === "all" || c.siteIds.includes(site))),
    [crew, site]
  );
  const scoped = useMemo(() => (site === "all" ? sessions : sessions.filter(s => s.siteId === site)), [sessions, site]);

  // Most hours first, so the people who worked are on top.
  const rows = useMemo(
    () =>
      people
        .map(p => {
          const cells = attendanceFor(p.id, scoped, days);
          return { person: p, cells, total: cells.reduce((s, c) => s + c.workedMs, 0) };
        })
        .sort((a, b) => b.total - a.total || a.person.name.localeCompare(b.person.name)),
    [people, scoped, days]
  );

  const summary = useMemo(() => {
    const all = rows.flatMap(r => r.cells).filter(hasShift);
    const todayCells = rows.map(r => r.cells[r.cells.length - 1]).filter(hasShift);
    return {
      avg: all.length ? all.reduce((s, c) => s + c.workedMs, 0) / all.length / HOUR : 0,
      late: all.filter(c => c.late).length,
      timeouts: all.filter(c => c.sessions.some(s => s.endReason === "timeout")).length,
      presentToday: todayCells.length,
    };
  }, [rows]);

  const exportCsv = () => {
    const header = ["Name", ...days.map(d => formatDayMonth(d)), "Total"].join(",");
    const body = rows.map(r => [r.person.name, ...r.cells.map(c => (c.workedMs / HOUR).toFixed(2)), (r.total / HOUR).toFixed(2)].join(","));
    const url = URL.createObjectURL(new Blob([[header, ...body].join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "attendance.csv";
    a.click();
    URL.revokeObjectURL(url);
    logAction("Exported attendance CSV", { kind: "export", changes: describeFields([{ label: "people", value: rows.length }, { label: "days", value: days.length }]) });
    toast.success("Timesheet exported", { description: `${rows.length} people × ${days.length} days · attendance.csv` });
  };

  return (
    <>
      <PageHeader
        title="Attendance"
        description="When each person was online and offline, built from their location-sharing sessions — hours, late arrivals and dropped signals."
        actions={
          <Button size="lg" className="rounded-xl px-4 shadow-glow" onClick={exportCsv}>
            <Download /> Export timesheet
          </Button>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Present today" value={summary.presentToday} icon={UserCheck} tone="success" footnote={`Today · of ${people.length} on the roster`} />
        <StatCard label="Avg. hours / day" value={summary.avg} decimals={1} suffix="h" icon={Timer} tone="primary" footnote={`Last ${span} days · days worked`} />
        <StatCard label="Late arrivals" value={summary.late} icon={AlarmClock} tone="warning" footnote={`Last ${span} days · after 9:15 am`} />
        <StatCard label="Signal drop-offs" value={summary.timeouts} icon={WifiOff} tone="violet" footnote={`Last ${span} days · ended by timeout`} />
      </div>

      <div className="surface mb-5 flex flex-col gap-3 rounded-2xl p-3 md:flex-row md:items-center">
        <SegmentedControl
          value={mode}
          onChange={setMode}
          options={[
            { value: "grid", label: "Week grid" },
            { value: "timeline", label: "Day timeline" },
          ]}
        />
        <div className="flex flex-wrap items-center gap-2 md:ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="lg" className="h-10 rounded-xl" />}>
              <Building2 /> {site === "all" ? "All sites" : siteById.get(site)?.name}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuRadioGroup value={site} onValueChange={v => setSite(String(v))}>
                <DropdownMenuRadioItem value="all">All sites</DropdownMenuRadioItem>
                {sites.map(s => (
                  <DropdownMenuRadioItem key={s.id} value={s.id}>
                    <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} /> {s.name}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          {mode === "grid" && (
            <SegmentedControl
              value={span}
              onChange={setSpan}
              options={[
                { value: "7", label: "7 days" },
                { value: "14", label: "14 days" },
              ]}
            />
          )}
        </div>
      </div>

      {mode === "grid" ? (
        <Panel
          title={
            <span className="inline-flex items-center gap-2">
              <CalendarRange className="size-4 text-primary" /> {formatDayMonth(days[0])} – {formatDayMonth(days[days.length - 1])}
            </span>
          }
          action={
            <div className="hidden flex-wrap items-center gap-4 text-xs font-semibold text-muted-foreground md:flex">
              <span className="flex items-center gap-1.5"><AlarmClock className="size-3.5 text-warning" /> Late</span>
              <span className="flex items-center gap-1.5"><WifiOff className="size-3.5 text-chart-4" /> Lost signal</span>
              <span className="flex items-center gap-1.5"><TriangleAlert className="size-3.5 text-danger" /> Over 12 h</span>
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-success" /> On shift now</span>
            </div>
          }
        >
          {/* Phone: one day at a time, a row per person. */}
          <div className="md:hidden">
            <div className="-mx-1 mb-3 flex gap-1 overflow-x-auto px-1 pb-1 scrollbar-thin">
              {days.map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setTimelineDay(d)}
                  className={cn(
                    "flex h-12 w-11 shrink-0 flex-col items-center justify-center rounded-xl text-xs font-semibold",
                    timelineDay === d ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  <span>{formatWeekday(d)}</span>
                  <span className="text-sm">{formatDayMonth(d).split(" ")[0]}</span>
                </button>
              ))}
            </div>
            <ul className="divide-y divide-border">
              {rows
                .map(r => ({ person: r.person, cell: r.cells.find(c => c.day === timelineDay) ?? attendanceFor(r.person.id, scoped, [timelineDay])[0] }))
                .sort((a, b) => b.cell.workedMs - a.cell.workedMs)
                .map(({ person, cell }) => (
                  <li key={person.id}>
                    <Link href={`/crew/${person.id}`} className="flex items-center gap-3 py-2.5">
                      <PersonAvatar person={person} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold">{person.name}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {hasShift(cell) ? `In ${formatTime(cell.firstIn!)}` : "Off"}
                        </div>
                      </div>
                      <CellFlags cell={cell} />
                      <span className={cn("w-16 text-right text-sm font-semibold tabular-nums", !hasShift(cell) && "text-faint")}>
                        {hasShift(cell) ? formatHours(cell.workedMs) : "—"}
                      </span>
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
          <div className="hidden overflow-x-auto scrollbar-thin md:block">
            <div
              className="grid min-w-[760px] items-center gap-2"
              style={{ gridTemplateColumns: `minmax(200px, 1.4fr) repeat(${days.length}, minmax(52px, 1fr)) 80px` }}
            >
              <div />
              {days.map(d => (
                <div key={d} className={cn("text-center text-xs leading-tight", d === dayStart(now) ? "font-semibold text-primary" : "font-semibold text-muted-foreground")}>
                  <div>{formatWeekday(d)}</div>
                  <div className="text-[10px] opacity-75">{formatDayMonth(d)}</div>
                </div>
              ))}
              <div className="text-right text-xs font-semibold text-muted-foreground">Total</div>

              {rows.map((row, r) => (
                <div key={row.person.id} className="contents">
                  <Link href={`/crew/${row.person.id}`} className="group flex min-w-0 items-center gap-2.5 pr-2">
                    <PersonAvatar person={row.person} size="sm" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold group-hover:text-primary">{row.person.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{row.person.jobTitle}</div>
                    </div>
                  </Link>
                  {row.cells.map((cell, c) => (
                    <HeatCell key={cell.day} cell={cell} href={`/crew/${row.person.id}`} delay={Math.min(r * 0.03 + c * 0.015, 0.8)} />
                  ))}
                  <div className="text-right text-sm font-semibold tabular-nums">{formatHours(row.total)}</div>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      ) : (
        <Panel
          title="Who was online, and when"
          description="Each bar is a stretch of location sharing; gaps are breaks, pauses or lost signal."
          action={
            <div className="flex gap-1 overflow-x-auto scrollbar-thin">
              {lastNDays(7).map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setTimelineDay(d)}
                  className={cn(
                    "relative flex h-12 w-11 shrink-0 flex-col items-center justify-center rounded-xl text-xs font-semibold transition-colors",
                    timelineDay === d ? "text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {timelineDay === d && (
                    <motion.span layoutId="day-pick" className="absolute inset-0 rounded-xl bg-primary shadow-glow" transition={{ type: "spring", stiffness: 380, damping: 32 }} />
                  )}
                  <span className="relative">{formatWeekday(d)}</span>
                  <span className="relative text-sm font-semibold">{formatDayMonth(d).split(" ")[0]}</span>
                </button>
              ))}
            </div>
          }
        >
          <div className="overflow-x-auto scrollbar-thin">
            <div className="min-w-[720px]">
              <div className="grid grid-cols-[220px_1fr_70px] gap-3">
                <span />
                <TimelineRuler />
                <span />
              </div>
              <div className="space-y-2">
                {people.map((p, i) => {
                  const cell = attendanceFor(p.id, scoped, [timelineDay])[0];
                  return (
                    <div key={`${p.id}-${timelineDay}`} className="grid grid-cols-[220px_1fr_70px] items-center gap-3">
                      <Link href={`/crew/${p.id}`} className="group flex min-w-0 items-center gap-2.5">
                        <PersonAvatar person={p} size="sm" />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold group-hover:text-primary">{p.name}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {cell.firstIn ? `In ${formatTime(cell.firstIn)}` : "Not in"}
                            {cell.late && <span className="ml-1 font-bold text-warning">· late</span>}
                          </div>
                        </div>
                      </Link>
                      {cell.sessions.length ? (
                        <TimelineTrack cell={cell} delay={i * 0.04} />
                      ) : (
                        <div className="flex h-8 items-center rounded-lg border border-dashed border-border px-3 text-xs text-faint">Off</div>
                      )}
                      <div className="text-right text-sm font-bold tabular-nums">{cell.workedMs ? formatHours(cell.workedMs) : "—"}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Panel>
      )}
    </>
  );
}
