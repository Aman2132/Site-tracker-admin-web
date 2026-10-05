"use client";

import { ArrowRight, BatteryLow, CalendarCheck2, Clock3, ImageIcon, MailQuestion, Plus, Timer, UserPlus, Users } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { AttendanceTrend } from "@/components/charts/AttendanceTrend";
import { BarCompare } from "@/components/charts/BarCompare";
import { ActivityFeed } from "@/components/domain/ActivityFeed";
import { Lightbox } from "@/components/domain/Lightbox";
import { PageHeader } from "@/components/domain/PageHeader";
import { Panel } from "@/components/domain/Panel";
import { AvatarStack, PersonAvatar } from "@/components/domain/PersonAvatar";
import { PhotoThumb } from "@/components/domain/PhotoThumb";
import { PresenceBar } from "@/components/domain/PresenceBar";
import { SegmentedControl } from "@/components/domain/SegmentedControl";
import { StatCard } from "@/components/domain/StatCard";
import { useDialogs } from "@/components/layout/DialogsProvider";
import { CountUp, Stagger, StaggerItem } from "@/components/motion";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatHours } from "@/lib/format";
import { attendanceFor, dailyStats, lastNDays, needsAttention, presenceCounts } from "@/lib/insights";
import { DAY, NOW, istDayStart } from "@/lib/mock/data";
import { useDemoStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const ATTENTION_ICON = { idle: Clock3, battery: BatteryLow, invited: MailQuestion, offline: Clock3 };
const ATTENTION_TONE = {
  idle: "bg-warning-soft text-warning",
  battery: "bg-danger-soft text-danger",
  invited: "bg-accent text-primary",
  offline: "bg-stale-soft text-muted-foreground",
};

function greeting() {
  const h = (new Date(NOW).getUTCHours() + 5.5) % 24;
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function OverviewView() {
  const { crew, sites, sessions, photos, events } = useDemoStore();
  const { openAddCrew, openCreateSite } = useDialogs();
  const [range, setRange] = useState<"7" | "14">("7");
  const [openPhoto, setOpenPhoto] = useState<string | null>(null);

  const stats = useMemo(() => {
    const days = dailyStats(sessions, photos, 14);
    const today = days[days.length - 1];
    const thisWeek = days.slice(7);
    const lastWeek = days.slice(0, 7);
    const sum = (xs: typeof days, k: "hours" | "photos") => xs.reduce((s, d) => s + d[k], 0);
    const change = (a: number, b: number) => (b === 0 ? 0 : (a - b) / b);

    const todayStart = istDayStart(NOW);
    const workers = crew.filter(c => c.status !== "invited" && c.status !== "deactivated");
    const todayCells = workers.map(w => attendanceFor(w.id, sessions, [todayStart])[0]).filter(c => c.firstIn != null);
    const onTime = todayCells.length ? todayCells.filter(c => !c.late).length / todayCells.length : 0;

    return {
      days,
      today,
      hoursDelta: change(sum(thisWeek, "hours"), sum(lastWeek, "hours")),
      photosDelta: change(sum(thisWeek, "photos"), sum(lastWeek, "photos")),
      onTime,
      arrivedToday: todayCells.length,
    };
  }, [crew, sessions, photos]);

  const counts = presenceCounts(crew);
  const attention = needsAttention(crew);
  const online = crew.filter(c => c.status === "online");
  const chartDays = range === "7" ? stats.days.slice(7) : stats.days;
  const recentPhotos = photos.slice(0, 6);
  const weekStart = lastNDays(7)[0];

  const perSite = sites
    .map(s => ({
      // Short label so five bars fit; the tooltip shows the full name.
      label: s.code.split("-")[1] ?? s.code,
      full: s.name,
      value: photos.filter(p => p.siteId === s.id && p.takenAt >= weekStart).length,
      color: s.color,
    }))
    .filter(s => s.value > 0);

  return (
    <>
      <PageHeader
        eyebrow={`${greeting()}, Meera`}
        title={
          <>
            Your sites, <span className="text-gradient">live</span>
          </>
        }
        description={`${counts.online} crew are on shift across ${sites.filter(s => s.status === "active").length} active sites. Here's what's happening right now.`}
        actions={
          <>
            <Button variant="outline" size="lg" className="rounded-xl bg-card" onClick={() => openAddCrew()}>
              <UserPlus /> Add crew
            </Button>
            <Button size="lg" className="rounded-xl px-4 shadow-glow" onClick={openCreateSite}>
              <Plus /> Create site
            </Button>
          </>
        }
      />

      <Stagger className="grid gap-5">
        {/* Hero: live presence */}
        <StaggerItem className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
          <div className="relative flex flex-col overflow-hidden rounded-3xl bg-ink-hero p-6 text-white sm:p-7">
            <div className="bg-grid absolute inset-0 opacity-30" />
            <motion.div
              className="absolute -top-24 -right-24 size-72 rounded-full bg-primary/40 blur-3xl"
              animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            />
            <div className="relative flex flex-1 flex-col">
              <div className="flex items-center gap-2 text-xs font-bold tracking-[0.14em] text-white/60 uppercase">
                <span className="relative inline-flex size-2 rounded-full bg-success">
                  <span className="absolute inset-0 animate-ping-soft rounded-full bg-success" />
                </span>
                Crew presence · right now
              </div>
              <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-4">
                <div>
                  <div className="flex items-baseline gap-2">
                    <CountUp value={counts.online} className="text-6xl leading-none font-extrabold tracking-tight" />
                    <span className="text-lg text-white/60">online</span>
                  </div>
                  <div className="mt-2 text-sm text-white/60">
                    of {crew.length - counts.deactivated} people on the roster
                  </div>
                </div>
                <div className="ml-auto">
                  <AvatarStack people={online} max={6} size="md" />
                </div>
              </div>
              <PresenceBar counts={counts} dark className="mt-6" />

              <div className="mt-auto grid gap-2.5 pt-7 sm:grid-cols-2 xl:grid-cols-3">
                {sites
                  .filter(s => s.status === "active" || crew.some(c => c.currentSiteId === s.id))
                  .map((s, i) => {
                    const hereCount = crew.filter(c => c.currentSiteId === s.id && (c.status === "online" || c.status === "idle")).length;
                    return (
                      <motion.div
                        key={s.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 + i * 0.08 }}
                      >
                        <Link
                          href={`/sites/${s.id}`}
                          className="flex items-center gap-3 rounded-2xl bg-white/[0.06] p-3 ring-1 ring-white/10 transition-colors hover:bg-white/[0.12]"
                        >
                          <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{s.name}</span>
                          <span className="text-lg font-extrabold">{hereCount}</span>
                        </Link>
                      </motion.div>
                    );
                  })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <StatCard
              label="Hours today"
              value={stats.today.hours}
              decimals={1}
              suffix="h"
              icon={Timer}
              tone="primary"
              delta={stats.hoursDelta}
              trend={stats.days.slice(7).map(d => d.hours)}
            />
            <StatCard
              label="Photos today"
              value={stats.today.photos}
              icon={ImageIcon}
              tone="violet"
              delta={stats.photosDelta}
              trend={stats.days.slice(7).map(d => d.photos)}
            />
            <StatCard
              label="Arrived today"
              value={stats.arrivedToday}
              icon={Users}
              tone="success"
              footnote="crew signed in"
              trend={stats.days.slice(7).map(d => d.crewOnline)}
            />
            <StatCard
              label="On-time arrivals"
              value={Math.round(stats.onTime * 100)}
              suffix="%"
              icon={CalendarCheck2}
              tone="warning"
              footnote="before 9:15 am"
            />
          </div>
        </StaggerItem>

        {/* Trend + attention */}
        <StaggerItem className="grid gap-5 xl:grid-cols-[1.9fr_1fr]">
          <Panel
            title="Attendance trend"
            description="Hours worked and crew on shift per day"
            action={
              <SegmentedControl
                size="sm"
                value={range}
                onChange={setRange}
                options={[
                  { value: "7", label: "7 days" },
                  { value: "14", label: "14 days" },
                ]}
              />
            }
          >
            <div className="mb-3 flex gap-5 text-xs font-semibold text-muted-foreground">
              <span className="flex items-center gap-2">
                <span className="h-0.5 w-4 rounded-full bg-chart-1" /> Hours worked
              </span>
              <span className="flex items-center gap-2">
                <span className="h-0.5 w-4 rounded-full border-t-2 border-dashed border-chart-2" /> Crew on shift
              </span>
            </div>
            <AttendanceTrend key={range} data={chartDays} />
          </Panel>

          <Panel
            title="Needs attention"
            description={`${attention.length} things to look at`}
            action={
              <Link href="/crew" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "rounded-lg")}>
                Crew <ArrowRight />
              </Link>
            }
          >
            <ul className="space-y-2">
              {attention.map((item, i) => {
                const Icon = ATTENTION_ICON[item.reason];
                return (
                  <motion.li
                    key={item.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.06 }}
                  >
                    <Link
                      href={`/crew/${item.person.id}`}
                      className="group flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-muted"
                    >
                      <PersonAvatar person={item.person} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{item.person.name}</div>
                        <div className="truncate text-xs text-muted-foreground">{item.detail}</div>
                      </div>
                      <span className={cn("flex size-8 items-center justify-center rounded-lg", ATTENTION_TONE[item.reason])}>
                        <Icon className="size-4" />
                      </span>
                    </Link>
                  </motion.li>
                );
              })}
            </ul>
          </Panel>
        </StaggerItem>

        {/* Sites strip */}
        <StaggerItem>
          <Panel
            title="Sites today"
            description="Who's where right now"
            action={
              <Link href="/sites" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "rounded-lg")}>
                All sites <ArrowRight />
              </Link>
            }
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {sites.map((site, i) => {
                const here = crew.filter(c => c.currentSiteId === site.id && (c.status === "online" || c.status === "idle"));
                const assigned = crew.filter(c => c.siteIds.includes(site.id) && c.status !== "deactivated").length;
                const hoursToday = sessions
                  .filter(s => s.siteId === site.id && s.start >= istDayStart(NOW))
                  .reduce((sum, s) => sum + ((s.end ?? NOW) - s.start), 0);
                return (
                  <motion.div key={site.id} whileHover={{ y: -3 }} transition={{ type: "spring", stiffness: 400, damping: 26 }}>
                    <Link
                      href={`/sites/${site.id}`}
                      className="group block rounded-2xl border border-border p-4 transition-shadow hover:shadow-lift"
                    >
                      <div className="flex items-center justify-between">
                        <span className="size-2.5 rounded-full" style={{ backgroundColor: site.color }} />
                        <span className="text-[11px] font-bold text-faint">{site.code}</span>
                      </div>
                      <div className="mt-3 line-clamp-1 font-bold">{site.name}</div>
                      <div className="text-xs text-muted-foreground">{site.city}</div>
                      <div className="mt-4 flex items-end justify-between">
                        <div>
                          <div className="text-2xl font-extrabold tracking-tight">
                            <CountUp value={here.length} duration={0.8 + i * 0.1} />
                            <span className="text-sm font-semibold text-muted-foreground"> / {assigned}</span>
                          </div>
                          <div className="text-[11px] font-semibold text-muted-foreground">on site · {formatHours(hoursToday)} today</div>
                        </div>
                        <AvatarStack people={here} max={3} size="xs" />
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </Panel>
        </StaggerItem>

        {/* Photos + activity */}
        <StaggerItem className="grid gap-5 xl:grid-cols-[1fr_1.25fr_1fr]">
          <Panel title="Photos per site" description="This week">
            <BarCompare data={perSite} valueLabel="Photos" height={260} />
          </Panel>

          <Panel
            title="Latest photos"
            description="Thumbnails load first; full resolution on open"
            action={
              <Link href="/photos" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "rounded-lg")}>
                Gallery <ArrowRight />
              </Link>
            }
          >
            <div className="grid grid-cols-3 gap-2.5">
              {recentPhotos.map((p, i) => (
                <PhotoThumb key={p.id} photo={p} index={i} onOpen={ph => setOpenPhoto(ph.id)} showMeta={false} className="aspect-square" />
              ))}
            </div>
          </Panel>

          <Panel
            title="Live activity"
            action={
              <Link href="/activity" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "rounded-lg")}>
                All <ArrowRight />
              </Link>
            }
          >
            <div className="max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
              <ActivityFeed events={events.filter(e => e.at > NOW - DAY).slice(0, 10)} compact />
            </div>
          </Panel>
        </StaggerItem>
      </Stagger>

      <Lightbox photos={recentPhotos} openId={openPhoto} onClose={() => setOpenPhoto(null)} onChange={setOpenPhoto} />
    </>
  );
}
