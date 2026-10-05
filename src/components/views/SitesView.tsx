"use client";

import { Building2, Clock, ImageIcon, LayoutGrid, List, MapPin, Plus, Search, UserRound, Users } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { TextInput } from "@/components/domain/FormBits";
import { PageHeader } from "@/components/domain/PageHeader";
import { EmptyState } from "@/components/domain/Panel";
import { AvatarStack } from "@/components/domain/PersonAvatar";
import { SegmentedControl } from "@/components/domain/SegmentedControl";
import { SiteMap } from "@/components/domain/SiteMap";
import { SiteStatusBadge } from "@/components/domain/SiteStatusBadge";
import { useDialogs } from "@/components/layout/DialogsProvider";
import { EASE_OUT } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { formatHours, percent } from "@/lib/format";
import { lastNDays } from "@/lib/insights";
import { NOW, istDayStart } from "@/lib/mock/data";
import { useDemoStore } from "@/lib/store";

import type { Site, SiteStatus } from "@/types/domain";

type Filter = "all" | SiteStatus;

function useSiteSummaries() {
  const { sites, crew, sessions, photos } = useDemoStore();
  return useMemo(() => {
    const today = istDayStart(NOW);
    const weekStart = lastNDays(7)[0];
    return sites.map(site => {
      const assigned = crew.filter(c => c.siteIds.includes(site.id) && c.status !== "deactivated");
      const here = crew.filter(c => c.currentSiteId === site.id && (c.status === "online" || c.status === "idle"));
      return {
        site,
        assigned,
        here,
        photosWeek: photos.filter(p => p.siteId === site.id && p.takenAt >= weekStart).length,
        hoursToday: sessions
          .filter(s => s.siteId === site.id && s.start >= today)
          .reduce((sum, s) => sum + ((s.end ?? NOW) - s.start), 0),
      };
    });
  }, [sites, crew, sessions, photos]);
}

type Summary = ReturnType<typeof useSiteSummaries>[number];

function SiteCard({ summary, index }: { summary: Summary; index: number }) {
  const { site, assigned, here, photosWeek, hoursToday } = summary;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.45, ease: EASE_OUT, delay: Math.min(index, 8) * 0.05 }}
      whileHover={{ y: -5 }}
    >
      <Link href={`/sites/${site.id}`} className="surface group block overflow-hidden rounded-3xl transition-shadow hover:shadow-lift">
        <div className="relative">
          <SiteMap radius={site.radius} color={site.color} crew={here} interactive={false} className="rounded-none" />
          <div className="absolute top-3 left-3">
            <SiteStatusBadge status={site.status} className="shadow-card" />
          </div>
          {here.length > 0 && (
            <div className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-card/90 px-2.5 py-0.5 text-xs font-bold shadow-card backdrop-blur">
              <span className="relative inline-flex size-1.5 rounded-full bg-success">
                <span className="absolute inset-0 animate-ping-soft rounded-full bg-success" />
              </span>
              {here.length} on site
            </div>
          )}
        </div>
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-lg font-extrabold tracking-tight transition-colors group-hover:text-primary">{site.name}</h3>
              <div className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="size-3.5" /> {site.city} · <span className="font-mono text-xs">{site.code}</span>
              </div>
            </div>
            <AvatarStack people={assigned} max={3} size="sm" />
          </div>

          <div className="mt-4">
            <div className="mb-1.5 flex justify-between text-xs font-semibold">
              <span className="text-muted-foreground">Progress</span>
              <span>{percent(site.progress)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: site.color }}
                initial={{ width: 0 }}
                animate={{ width: percent(site.progress) }}
                transition={{ duration: 1, ease: EASE_OUT, delay: 0.2 + index * 0.05 }}
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 divide-x divide-border rounded-2xl bg-muted/60 py-2.5 text-center">
            <div>
              <div className="flex items-center justify-center gap-1 text-sm font-extrabold">
                <Users className="size-3.5 text-muted-foreground" /> {assigned.length}
              </div>
              <div className="text-[10px] font-semibold text-muted-foreground uppercase">Crew</div>
            </div>
            <div>
              <div className="flex items-center justify-center gap-1 text-sm font-extrabold">
                <Clock className="size-3.5 text-muted-foreground" /> {formatHours(hoursToday)}
              </div>
              <div className="text-[10px] font-semibold text-muted-foreground uppercase">Today</div>
            </div>
            <div>
              <div className="flex items-center justify-center gap-1 text-sm font-extrabold">
                <ImageIcon className="size-3.5 text-muted-foreground" /> {photosWeek}
              </div>
              <div className="text-[10px] font-semibold text-muted-foreground uppercase">Photos/wk</div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <UserRound className="size-3.5" /> Managed by {site.manager} · fence {site.radius} m
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function SiteRow({ summary, index }: { summary: Summary; index: number }) {
  const { site, assigned, here, photosWeek, hoursToday } = summary;
  return (
    <motion.tr
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, delay: index * 0.03 }}
      className="group border-b border-border/70 last:border-0 hover:bg-accent/40"
    >
      <td className="px-5 py-3.5">
        <Link href={`/sites/${site.id}`} className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl text-white" style={{ backgroundColor: site.color }}>
            <Building2 className="size-4" />
          </span>
          <div className="min-w-0">
            <div className="truncate font-bold group-hover:text-primary">{site.name}</div>
            <div className="text-xs text-muted-foreground">
              {site.address}, {site.city}
            </div>
          </div>
        </Link>
      </td>
      <td className="px-3 py-3.5"><SiteStatusBadge status={site.status} /></td>
      <td className="px-3 py-3.5 font-semibold">{here.length} / {assigned.length}</td>
      <td className="px-3 py-3.5 font-semibold tabular-nums">{formatHours(hoursToday)}</td>
      <td className="px-3 py-3.5 font-semibold">{photosWeek}</td>
      <td className="px-3 py-3.5">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full" style={{ width: percent(site.progress), backgroundColor: site.color }} />
          </div>
          <span className="text-xs font-semibold">{percent(site.progress)}</span>
        </div>
      </td>
      <td className="px-3 py-3.5 text-muted-foreground">{site.manager}</td>
    </motion.tr>
  );
}

export function SitesView() {
  const summaries = useSiteSummaries();
  const { openCreateSite } = useDialogs();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");

  const count = (s: Filter) => (s === "all" ? summaries.length : summaries.filter(x => x.site.status === s).length);
  const matches = (site: Site) =>
    (filter === "all" || site.status === filter) &&
    `${site.name} ${site.city} ${site.code} ${site.address}`.toLowerCase().includes(query.trim().toLowerCase());
  const shown = summaries.filter(s => matches(s.site));

  return (
    <>
      <PageHeader
        title="Sites"
        description="Every project, its geofence, and the crew assigned to it."
        actions={
          <Button size="lg" className="rounded-xl px-4 shadow-glow" onClick={openCreateSite}>
            <Plus /> Create site
          </Button>
        }
      />

      <div className="surface mb-5 flex flex-col gap-3 rounded-2xl p-3 md:flex-row md:items-center">
        <div className="overflow-x-auto scrollbar-thin">
          <SegmentedControl
            value={filter}
            onChange={setFilter}
            options={(["all", "active", "planning", "paused"] as const).map(v => ({
              value: v,
              label: v === "all" ? "All" : v[0].toUpperCase() + v.slice(1),
              count: count(v),
            }))}
          />
        </div>
        <div className="flex flex-1 items-center gap-2 md:justify-end">
          <div className="relative flex-1 md:max-w-72">
            <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <TextInput placeholder="Search sites" className="h-10 pl-10" value={query} onChange={e => setQuery(e.target.value)} />
          </div>
          <SegmentedControl
            value={view}
            onChange={setView}
            options={[
              { value: "grid", label: <LayoutGrid className="size-4" aria-label="Grid view" /> },
              { value: "list", label: <List className="size-4" aria-label="List view" /> },
            ]}
          />
        </div>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon={<Building2 className="size-6" />}
          title="No sites match"
          description="Try another filter, or create a new site."
          action={
            <Button className="rounded-xl" onClick={openCreateSite}>
              <Plus /> Create site
            </Button>
          }
        />
      ) : view === "grid" ? (
        <motion.div layout className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
          <AnimatePresence initial={false}>
            {shown.map((s, i) => (
              <SiteCard key={s.site.id} summary={s} index={i} />
            ))}
          </AnimatePresence>
        </motion.div>
      ) : (
        <div className="surface overflow-hidden rounded-2xl">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-bold tracking-wide text-muted-foreground uppercase">
                  <th className="px-5 py-3.5">Site</th>
                  <th className="px-3 py-3.5">Status</th>
                  <th className="px-3 py-3.5">On site</th>
                  <th className="px-3 py-3.5">Hours today</th>
                  <th className="px-3 py-3.5">Photos / wk</th>
                  <th className="px-3 py-3.5">Progress</th>
                  <th className="px-3 py-3.5">Manager</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {shown.map((s, i) => (
                    <SiteRow key={s.site.id} summary={s} index={i} />
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
