"use client";

import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Clock,
  Crosshair,
  ImageIcon,
  Mail,
  MailPlus,
  Phone,
  Timer,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { BarCompare } from "@/components/charts/BarCompare";
import { ActivityFeed } from "@/components/domain/ActivityFeed";
import { AssignSitesSheet } from "@/components/domain/AssignSheet";
import { BatteryMeter } from "@/components/domain/BatteryMeter";
import { CrewMap } from "@/components/domain/CrewMap";
import { Lightbox } from "@/components/domain/Lightbox";
import { EmptyState, Panel } from "@/components/domain/Panel";
import { PersonAvatar } from "@/components/domain/PersonAvatar";
import { PhotoThumb } from "@/components/domain/PhotoThumb";
import { PresenceTimeline } from "@/components/domain/PresenceTimeline";
import { StatusChip } from "@/components/domain/StatusDot";
import { CountUp, Stagger, StaggerItem } from "@/components/motion";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatClock, formatDate, formatWeekday, hourOfDay, timeAgo } from "@/lib/format";
import { attendanceFor, lastNDays } from "@/lib/insights";
import { HOUR } from "@/lib/time";
import { attempt, useLiveStore } from "@/lib/store";
import { useTarget } from "@/lib/useTarget";
import { cn } from "@/lib/utils";

export function CrewProfileView({ id }: { id: string }) {
  const { crew, sites, sessions, photos, events, setCrewActive, resendInvite } = useLiveStore();
  const person = crew.find(c => c.id === id);
  const assign = useTarget();
  const [openPhoto, setOpenPhoto] = useState<string | null>(null);

  const data = useMemo(() => {
    if (!person) return null;
    const days14 = lastNDays(14);
    const cells = attendanceFor(person.id, sessions, days14);
    const week = cells.slice(7);
    const present = cells.filter(c => c.sessions.length > 0);
    const arrivals = present.map(c => hourOfDay(c.firstIn!));
    const myPhotos = photos.filter(p => p.personId === person.id);
    const weekStart = days14[7];
    return {
      cells,
      week,
      weekHours: week.reduce((s, c) => s + c.workedMs, 0),
      daysPresent: present.length,
      lateDays: present.filter(c => c.late).length,
      avgArrival: arrivals.length ? arrivals.reduce((a, b) => a + b, 0) / arrivals.length : null,
      photos: myPhotos,
      weekPhotos: myPhotos.filter(p => p.takenAt >= weekStart).length,
      events: events.filter(e => e.personId === person.id).slice(0, 12),
    };
  }, [person, sessions, photos, events]);

  if (!person || !data) {
    return (
      <EmptyState
        icon={<Users className="size-6" />}
        title="Crew member not found"
        description="They may have been removed, or the link is wrong."
        action={
          <Link href="/crew" className={cn(buttonVariants({ variant: "outline" }), "rounded-xl")}>
            Back to crew
          </Link>
        }
      />
    );
  }

  const mySites = sites.filter(s => person.siteIds.includes(s.id));
  const currentSite = sites.find(s => s.id === person.currentSiteId);
  const deactivated = person.status === "deactivated";

  return (
    <>
      <Link href="/crew" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-4" /> All crew
      </Link>

      <Stagger className="grid gap-5">
        {/* Header */}
        <StaggerItem>
          <div className="surface relative overflow-hidden rounded-3xl">
            <div className="h-20 border-b border-border bg-muted sm:h-24" />
            <div className="flex flex-col gap-5 px-6 pb-6 sm:flex-row sm:items-end sm:px-8">
              <div className="-mt-12 rounded-full bg-card p-1.5 shadow-lift sm:-mt-14">
                <PersonAvatar person={person} size="xl" showStatus={person.status === "online" || person.status === "idle"} />
              </div>
              <div className="min-w-0 flex-1 sm:pt-4">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{person.name}</h1>
                  <StatusChip status={person.status} />
                  {person.appRole === "owner" && <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold text-primary">Admin</span>}
                </div>
                <div className="mt-1 text-muted-foreground">
                  {[person.jobTitle, person.team].filter(Boolean).join(" · ")}
                  {currentSite && (
                    <>
                      {" "}· on site at <span className="font-semibold text-foreground">{currentSite.name}</span>
                    </>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
                  {person.email && <span className="inline-flex items-center gap-1.5"><Mail className="size-4" /> {person.email}</span>}
                  {person.phone && <span className="inline-flex items-center gap-1.5"><Phone className="size-4" /> {person.phone}</span>}
                  {person.joinedAt != null && <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-4" /> Invited {formatDate(person.joinedAt)}</span>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {person.status === "invited" && (
                  <Button
                    variant="outline"
                    size="lg"
                    className="rounded-xl"
                    onClick={async () => {
                      if (!person.email) return toast.error("No email on file for this person.");
                      if (await attempt("Resending the invite", () => resendInvite(person.email)))
                        toast.success("Invite re-sent", { description: `New set-password link sent to ${person.email}.` });
                    }}
                  >
                    <MailPlus /> Resend invite
                  </Button>
                )}
                <Button variant="outline" size="lg" className="rounded-xl" onClick={() => assign.show(person.id)}>
                  <Building2 /> Assign sites
                </Button>
                <Button
                  variant={deactivated ? "default" : "destructive"}
                  size="lg"
                  className="rounded-xl"
                  onClick={async () => {
                    if (!(await attempt(deactivated ? "Reactivating" : "Deactivating", () => setCrewActive(person.id, person.name, deactivated)))) return;
                    toast(deactivated ? `${person.name} reactivated` : `${person.name} deactivated`);
                  }}
                >
                  {deactivated ? <UserCheck /> : <UserX />} {deactivated ? "Reactivate" : "Deactivate"}
                </Button>
              </div>
            </div>
          </div>
        </StaggerItem>

        {/* Stats */}
        <StaggerItem className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: "Hours this week", icon: Timer, node: <CountUp value={data.weekHours / HOUR} decimals={1} suffix="h" /> },
            {
              label: "Avg. arrival",
              icon: Clock,
              node: <span>{data.avgArrival != null ? formatClock(data.avgArrival) : "—"}</span>,
              sub: data.lateDays ? `${data.lateDays} late day${data.lateDays > 1 ? "s" : ""} in 2 weeks` : "Always on time",
            },
            { label: "Photos this week", icon: ImageIcon, node: <CountUp value={data.weekPhotos} />, sub: `${data.photos.length} in total` },
            { label: "Days present", icon: CalendarDays, node: <CountUp value={data.daysPresent} suffix=" / 14" /> },
          ].map(stat => (
            <div key={stat.label} className="surface rounded-2xl p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <stat.icon className="size-4 text-primary" /> {stat.label}
              </div>
              <div className="mt-2 text-2xl font-semibold tracking-tight">{stat.node}</div>
              {stat.sub && <div className="mt-0.5 text-xs text-muted-foreground">{stat.sub}</div>}
            </div>
          ))}
        </StaggerItem>

        {/* Timeline + side */}
        <StaggerItem className="grid gap-5 xl:grid-cols-[1.7fr_1fr]">
          <Panel
            title="Online / offline — last 7 days"
            description="Each bar is a stretch of location sharing. Hover for exact times."
          >
            <PresenceTimeline cells={data.week} />
          </Panel>

          <div className="grid gap-5">
            <Panel title="Right now">
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Last update</dt>
                  <dd className="mt-0.5 font-bold">{person.status === "invited" ? "Never signed in" : timeAgo(person.lastSeenAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Battery</dt>
                  <dd className="mt-0.5"><BatteryMeter value={person.battery} /></dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">GPS accuracy</dt>
                  <dd className="mt-0.5 inline-flex items-center gap-1 font-bold">
                    <Crosshair className="size-3.5 text-muted-foreground" />
                    {person.accuracy ? `±${person.accuracy} m` : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Moving</dt>
                  <dd className="mt-0.5 font-bold capitalize">
                    {person.kind === "stale" ? "—" : person.kind === "vehicle" ? "Driving" : person.kind === "walk" ? "Walking" : "Still"}
                  </dd>
                </div>
              </dl>
            </Panel>
            <Panel title="Last known location" description={person.lat != null ? `Updated ${timeAgo(person.lastSeenAt)}` : undefined}>
              {person.lat != null ? (
                <CrewMap crew={[person]} sites={sites} fitKey={person.id} className="h-[200px] w-full" />
              ) : (
                <p className="text-sm text-muted-foreground">No location yet — they have not checked in.</p>
              )}
            </Panel>
          </div>
        </StaggerItem>

        <StaggerItem className="grid gap-5 xl:grid-cols-[1fr_1fr_1fr]">
          <Panel title="Hours per day" description="This week">
            <BarCompare
              height={220}
              valueLabel="Worked"
              formatValue={v => `${v}h`}
              data={data.week.map(c => ({
                label: formatWeekday(c.day),
                full: formatDate(c.day),
                value: Math.round((c.workedMs / HOUR) * 10) / 10,
                color: c.late ? "var(--chart-3)" : "var(--chart-1)",
              }))}
            />
          </Panel>
          <Panel title="Assigned sites" action={<Button variant="ghost" size="sm" className="rounded-lg" onClick={() => assign.show(person.id)}>Edit</Button>}>
            {mySites.length === 0 ? (
              <p className="text-sm text-muted-foreground">Not assigned to any site yet.</p>
            ) : (
              <ul className="space-y-2">
                {mySites.map(s => (
                  <li key={s.id}>
                    <Link href={`/sites/${s.id}`} className="flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-muted">
                      <span className="flex size-9 items-center justify-center rounded-xl text-white" style={{ backgroundColor: s.color }}>
                        <Building2 className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold">{s.name}</div>
                        <div className="text-xs text-muted-foreground">{s.code}</div>
                      </div>
                      {s.id === person.currentSiteId && <span className="rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-bold text-success">Working now</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Recent activity">
            {data.events.length ? (
              <div className="max-h-[260px] overflow-y-auto pr-1 scrollbar-thin">
                <ActivityFeed events={data.events} compact />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nothing yet.</p>
            )}
          </Panel>
        </StaggerItem>

        <StaggerItem>
          <Panel title={`Photos by ${person.name.split(" ")[0]}`} description={`${data.photos.length} geotagged captures`}>
            {data.photos.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {data.photos.slice(0, 12).map((p, i) => (
                  <PhotoThumb key={p.id} photo={p} index={i} onOpen={ph => setOpenPhoto(ph.id)} className="aspect-[4/3]" />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No photos yet.</p>
            )}
          </Panel>
        </StaggerItem>
      </Stagger>

      <AssignSitesSheet key={assign.key} personId={assign.id} open={assign.open} onOpenChange={assign.setOpen} />
      <Lightbox photos={data.photos.slice(0, 12)} openId={openPhoto} onClose={() => setOpenPhoto(null)} onChange={setOpenPhoto} />
    </>
  );
}
