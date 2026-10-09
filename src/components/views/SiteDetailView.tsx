"use client";

import { ArrowLeft, Building2, CalendarDays, ChevronDown, Clock, Crosshair, ImageIcon, UserPlus, UserRound, Users } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { BarCompare } from "@/components/charts/BarCompare";
import { ActivityFeed } from "@/components/domain/ActivityFeed";
import { AssignCrewSheet } from "@/components/domain/AssignSheet";
import { DeletableLightbox } from "@/components/domain/DeletableLightbox";
import { EmptyState, Panel } from "@/components/domain/Panel";
import { PersonAvatar } from "@/components/domain/PersonAvatar";
import { PhotoThumb } from "@/components/domain/PhotoThumb";
import { CrewMap } from "@/components/domain/CrewMap";
import { SiteStatusBadge } from "@/components/domain/SiteStatusBadge";
import { StatusChip } from "@/components/domain/StatusDot";
import { useDialogs } from "@/components/layout/DialogsProvider";
import { CountUp, Stagger, StaggerItem } from "@/components/motion";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate, formatHours, formatWeekday, timeAgo } from "@/lib/format";
import { hoursOnDay, lastNDays } from "@/lib/insights";
import { DAY, HOUR, dayStart } from "@/lib/time";
import { attempt, useLiveStore, useNow } from "@/lib/store";
import { useTarget } from "@/lib/useTarget";
import { cn } from "@/lib/utils";

import type { SiteStatus } from "@/types/domain";

export function SiteDetailView({ id }: { id: string }) {
  const { sites, crew, sessions, photos, events, setSiteStatus } = useLiveStore();
  const now = useNow();
  const { openAddCrew } = useDialogs();
  const assign = useTarget();
  const [openPhoto, setOpenPhoto] = useState<string | null>(null);
  const site = sites.find(s => s.id === id);

  const data = useMemo(() => {
    if (!site) return null;
    const siteSessions = sessions.filter(s => s.siteId === site.id);
    const days = lastNDays(7);
    const today = dayStart(now);
    const sitePhotos = photos.filter(p => p.siteId === site.id);
    return {
      perDay: days.map(day => ({
        label: formatWeekday(day),
        full: formatDate(day),
        value: Math.round((hoursOnDay(siteSessions, day) / HOUR) * 10) / 10,
        color: site.color,
      })),
      hoursToday: hoursOnDay(siteSessions, today),
      hoursWeek: days.reduce((s, d) => s + hoursOnDay(siteSessions, d), 0),
      todayHoursBy: (personId: string) => hoursOnDay(siteSessions.filter(s => s.personId === personId), today),
      photos: sitePhotos,
      photosWeek: sitePhotos.filter(p => p.takenAt >= days[0]).length,
      events: events.filter(e => e.siteId === site.id && e.at > now - 2 * DAY).slice(0, 14),
    };
  }, [site, sessions, photos, events, now]);

  if (!site || !data) {
    return (
      <EmptyState
        icon={<Building2 className="size-6" />}
        title="Site not found"
        description="It may have been removed, or the link is wrong."
        action={
          <Link href="/sites" className={cn(buttonVariants({ variant: "outline" }), "rounded-xl")}>
            Back to sites
          </Link>
        }
      />
    );
  }

  const assigned = crew.filter(c => c.siteIds.includes(site.id) && c.status !== "deactivated");
  const here = crew.filter(c => c.currentSiteId === site.id && (c.status === "online" || c.status === "idle"));
  const gallery = data.photos.slice(0, 8);

  return (
    <>
      <Link href="/sites" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-4" /> All sites
      </Link>

      <Stagger className="grid gap-5">
        <StaggerItem>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-center gap-4">
              <motion.span
                initial={{ scale: 0.6, rotate: -12 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 18 }}
                className="flex size-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-lift"
                style={{ backgroundColor: site.color }}
              >
                <Building2 className="size-6" />
              </motion.span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{site.name}</h1>
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<button type="button" className="inline-flex items-center gap-1 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50" aria-label="Change status" />}>
                      <SiteStatusBadge status={site.status} /> <ChevronDown className="size-3.5 text-muted-foreground" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-44">
                      <DropdownMenuRadioGroup
                        value={site.status}
                        onValueChange={v => attempt("Updating status", () => setSiteStatus(site.id, v as SiteStatus), { targetType: "site", targetId: site.id, note: String(v) })}
                      >
                        {(["planning", "active", "paused", "completed"] as const).map(status => (
                          <DropdownMenuRadioItem key={status} value={status} className="capitalize">
                            {status}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5 font-mono text-xs">{site.code}</span>
                  {site.manager && <span className="inline-flex items-center gap-1.5"><UserRound className="size-4" /> {site.manager}</span>}
                  <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-4" /> Since {formatDate(site.startedAt)}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="lg" className="rounded-xl bg-card" onClick={() => assign.show(site.id)}>
                <Users /> Assign crew
              </Button>
              <Button size="lg" className="rounded-xl px-4 shadow-glow" onClick={() => openAddCrew(site.id)}>
                <UserPlus /> Add crew
              </Button>
            </div>
          </div>
        </StaggerItem>

        <StaggerItem className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: "Working now", icon: Users, value: here.length, suffix: ` / ${assigned.length}` },
            { label: "Hours today", icon: Clock, value: data.hoursToday / HOUR, decimals: 1, suffix: "h" },
            { label: "Hours this week", icon: CalendarDays, value: data.hoursWeek / HOUR, decimals: 0, suffix: "h" },
            { label: "Photos this week", icon: ImageIcon, value: data.photosWeek },
          ].map(stat => (
            <div key={stat.label} className="surface rounded-2xl p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <stat.icon className="size-4" style={{ color: site.color }} /> {stat.label}
              </div>
              <div className="mt-2 text-2xl font-semibold tracking-tight">
                <CountUp value={stat.value} decimals={stat.decimals ?? 0} suffix={stat.suffix} />
              </div>
            </div>
          ))}
        </StaggerItem>

        <StaggerItem className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
          <Panel title="Crew on the map" description="Last reported positions of the people assigned here" bodyClassName="pt-4">
            <CrewMap crew={assigned} sites={sites} fitKey={site.id} className="h-[340px] w-full" />
          </Panel>

          <Panel title="Working now" description={`${here.length} checked in here`}>
            {here.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nobody is checked in here at the moment.</p>
            ) : (
              <ul className="space-y-1.5">
                {here.map((p, i) => (
                  <motion.li key={p.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 + i * 0.06 }}>
                    <Link href={`/crew/${p.id}`} className="flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-muted">
                      <PersonAvatar person={p} size="sm" showStatus />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold">{p.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.jobTitle} · {p.status === "idle" ? `idle ${timeAgo(p.lastSeenAt)}` : `updated ${timeAgo(p.lastSeenAt)}`}
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                        <Crosshair className="size-3.5" />±{p.accuracy} m
                      </span>
                    </Link>
                  </motion.li>
                ))}
              </ul>
            )}
          </Panel>
        </StaggerItem>

        <StaggerItem className="grid gap-5 xl:grid-cols-[1fr_1.4fr]">
          <Panel title="Crew hours at this site" description="Last 7 days">
            <BarCompare data={data.perDay} valueLabel="Hours" formatValue={v => `${v}h`} height={250} />
          </Panel>
          <Panel
            title="Assigned crew"
            description={`${assigned.length} people`}
            action={<Button variant="ghost" size="sm" className="rounded-lg" onClick={() => assign.show(site.id)}>Manage</Button>}
          >
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[480px] text-sm">
                <tbody>
                  {assigned.map(p => (
                    <tr key={p.id} className="border-b border-border/70 last:border-0">
                      <td className="py-2.5 pr-3">
                        <Link href={`/crew/${p.id}`} className="flex items-center gap-3 hover:text-primary">
                          <PersonAvatar person={p} size="sm" />
                          <div>
                            <div className="font-bold">{p.name}</div>
                            <div className="text-xs text-muted-foreground">{p.jobTitle}</div>
                          </div>
                        </Link>
                      </td>
                      <td className="px-3 py-2.5"><StatusChip status={p.status} /></td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                        {data.todayHoursBy(p.id) ? formatHours(data.todayHoursBy(p.id)) : <span className="text-faint">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </StaggerItem>

        <StaggerItem className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
          <Panel
            title="Site photos"
            description={`${data.photos.length} geotagged captures`}
            action={
              <Link href={`/photos?site=${site.id}`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "rounded-lg")}>
                View all
              </Link>
            }
          >
            {gallery.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {gallery.map((p, i) => (
                  <PhotoThumb key={p.id} photo={p} index={i} onOpen={ph => setOpenPhoto(ph.id)} className="aspect-[4/3]" />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No photos from this site yet.</p>
            )}
          </Panel>
          <Panel title="Site activity" description="Last 48 hours">
            {data.events.length ? (
              <div className="max-h-[340px] overflow-y-auto pr-1 scrollbar-thin">
                <ActivityFeed events={data.events} compact showSite={false} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Quiet here.</p>
            )}
          </Panel>
        </StaggerItem>
      </Stagger>

      <AssignCrewSheet key={assign.key} siteId={assign.id} open={assign.open} onOpenChange={assign.setOpen} />
      <DeletableLightbox photos={gallery} openId={openPhoto} onClose={() => setOpenPhoto(null)} onChange={setOpenPhoto} />
    </>
  );
}
