"use client";

import { Building2, ChevronRight, List, MapPinOff } from "lucide-react";
import { useMemo, useState } from "react";

import { CrewMap } from "@/components/domain/CrewMap";
import { PageHeader } from "@/components/domain/PageHeader";
import { PersonAvatar } from "@/components/domain/PersonAvatar";
import { SegmentedControl } from "@/components/domain/SegmentedControl";
import { StatusChip } from "@/components/domain/StatusDot";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { timeAgo } from "@/lib/format";
import { useLiveStore, useLookups } from "@/lib/store";
import { defaultSiteAmong } from "@/lib/prefs";
import { cn } from "@/lib/utils";

import type { CrewMember, PresenceStatus } from "@/types/domain";

type StatusFilter = "all" | Extract<PresenceStatus, "online" | "idle" | "offline">;

const hasLocation = (c: CrewMember) => c.lat != null && c.lng != null;

/** People who can be seen on the map first; the ones with no position yet fold away below them. */
function CrewList({ members, focusId, onFocus }: { members: CrewMember[]; focusId: string | null; onFocus: (id: string) => void }) {
  const located = members.filter(hasLocation);
  const unlocated = members.filter(c => !hasLocation(c));
  const row = (person: CrewMember) => (
    <li key={person.id}>
      <button
        type="button"
        disabled={!hasLocation(person)}
        onClick={() => onFocus(person.id)}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors",
          hasLocation(person) ? "hover:bg-muted" : "cursor-default opacity-60",
          focusId === person.id && "bg-accent"
        )}
      >
        <PersonAvatar person={person} size="sm" showStatus />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold">{person.name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {hasLocation(person) ? (
              `${person.jobTitle} · ${timeAgo(person.lastSeenAt)}`
            ) : (
              <span className="inline-flex items-center gap-1">
                <MapPinOff className="size-3" /> No location yet
              </span>
            )}
          </div>
        </div>
        <StatusChip status={person.status} since={person.lastSeenAt} />
      </button>
    </li>
  );

  if (members.length === 0) return <p className="p-4 text-sm text-muted-foreground">Nobody matches these filters.</p>;
  return (
    <>
      <ul className="space-y-1">{located.map(row)}</ul>
      {unlocated.length > 0 && (
        <details className="group mt-1">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl p-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted [&::-webkit-details-marker]:hidden">
            <ChevronRight className="size-4 transition-transform group-open:rotate-90" />
            No location yet
            <span className="rounded-md bg-muted px-1.5 text-xs font-bold">{unlocated.length}</span>
          </summary>
          <ul className="space-y-1">{unlocated.map(row)}</ul>
        </details>
      )}
    </>
  );
}

/** Everyone's last known position, filterable by site (the crew assigned to it). Read-only. */
export function LiveMapView() {
  const { roster, sites } = useLiveStore();
  const { siteById } = useLookups();
  const [site, setSite] = useState(() => defaultSiteAmong(sites));
  const [status, setStatus] = useState<StatusFilter>("all");
  const [focusId, setFocusId] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);

  const inSite = useMemo(
    () =>
      roster
        .filter(c => c.status !== "deactivated" && c.status !== "invited")
        .filter(c => site === "all" || c.siteIds.includes(site) || c.currentSiteId === site),
    [roster, site]
  );
  const counts = useMemo(() => {
    const c = { all: inSite.length, online: 0, idle: 0, offline: 0 };
    for (const p of inSite) if (p.status === "online" || p.status === "idle" || p.status === "offline") c[p.status]++;
    return c;
  }, [inSite]);
  const members = useMemo(
    () => inSite.filter(c => status === "all" || c.status === status).sort((a, b) => (b.lastSeenAt ?? 0) - (a.lastSeenAt ?? 0)),
    [inSite, status]
  );
  const located = members.filter(hasLocation);

  return (
    <>
      <PageHeader
        title="Live map"
        description="Where each person last reported from. Checked-in crew update every few seconds; everyone else shows their last known spot."
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="lg" className="rounded-xl bg-card" />}>
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
        }
      />

      <div className="surface mb-5 flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-center">
        <SegmentedControl
          value={status}
          onChange={setStatus}
          className="flex-wrap"
          options={[
            { value: "all", label: "Everyone", count: counts.all },
            { value: "online", label: "Online", count: counts.online },
            { value: "idle", label: "Idle", count: counts.idle },
            { value: "offline", label: "Offline", count: counts.offline },
          ]}
        />
        <div className="text-sm text-muted-foreground sm:ml-auto">
          {located.length} of {members.length} on the map
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        {/* Desktop: the list beside the map. On a phone it lives in a pull-up sheet so the map comes first. */}
        <div className="surface hidden max-h-[70dvh] overflow-y-auto rounded-2xl p-2 scrollbar-thin lg:block">
          <CrewList members={members} focusId={focusId} onFocus={setFocusId} />
        </div>
        <div className="relative">
          <CrewMap crew={members} sites={sites} fitKey={`${site}|${status}`} focusId={focusId} className="h-[70dvh] min-h-[420px]" />
          <Button
            size="lg"
            className="absolute bottom-4 left-1/2 z-[500] -translate-x-1/2 rounded-full px-5 shadow-lift lg:hidden"
            onClick={() => setListOpen(true)}
          >
            <List /> Crew list · {members.length}
          </Button>
        </div>
      </div>

      <Sheet open={listOpen} onOpenChange={setListOpen}>
        <SheetContent side="bottom" className="max-h-[75dvh] gap-0 rounded-t-2xl lg:hidden">
          <SheetHeader className="border-b border-border px-5 py-4">
            <SheetTitle>Crew</SheetTitle>
            <SheetDescription>
              {located.length} of {members.length} on the map. Tap someone to find them.
            </SheetDescription>
          </SheetHeader>
          <div className="overflow-y-auto p-2">
            <CrewList
              members={members}
              focusId={focusId}
              onFocus={id => {
                setFocusId(id);
                setListOpen(false);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
