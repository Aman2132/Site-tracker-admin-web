"use client";

import { Building2, MapPinOff } from "lucide-react";
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
import { timeAgo } from "@/lib/format";
import { useLiveStore, useLookups } from "@/lib/store";
import { cn } from "@/lib/utils";

import type { PresenceStatus } from "@/types/domain";

type StatusFilter = "all" | Extract<PresenceStatus, "online" | "idle" | "offline">;

/** Everyone's last known position, filterable by site (the crew assigned to it). Read-only. */
export function LiveMapView() {
  const { crew, sites } = useLiveStore();
  const { siteById } = useLookups();
  const [site, setSite] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [focusId, setFocusId] = useState<string | null>(null);

  const members = useMemo(
    () =>
      crew
        .filter(c => c.status !== "deactivated" && c.status !== "invited")
        .filter(c => site === "all" || c.siteIds.includes(site) || c.currentSiteId === site)
        .filter(c => status === "all" || c.status === status)
        .sort((a, b) => (b.lastSeenAt ?? 0) - (a.lastSeenAt ?? 0)),
    [crew, site, status]
  );
  const located = members.filter(c => c.lat != null && c.lng != null);

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
          options={[
            { value: "all", label: "Everyone" },
            { value: "online", label: "Online" },
            { value: "idle", label: "Idle" },
            { value: "offline", label: "Offline" },
          ]}
        />
        <div className="text-sm text-muted-foreground sm:ml-auto">
          {located.length} of {members.length} on the map
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <ul className="surface max-h-[70dvh] space-y-1 overflow-y-auto rounded-2xl p-2 scrollbar-thin lg:order-1">
          {members.length === 0 && <li className="p-4 text-sm text-muted-foreground">Nobody matches these filters.</li>}
          {members.map(person => {
            const hasLocation = person.lat != null && person.lng != null;
            return (
              <li key={person.id}>
                <button
                  type="button"
                  disabled={!hasLocation}
                  onClick={() => setFocusId(person.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors",
                    hasLocation ? "hover:bg-muted" : "cursor-default opacity-60",
                    focusId === person.id && "bg-accent"
                  )}
                >
                  <PersonAvatar person={person} size="sm" showStatus />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">{person.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {hasLocation ? `${person.jobTitle} · ${timeAgo(person.lastSeenAt)}` : (
                        <span className="inline-flex items-center gap-1">
                          <MapPinOff className="size-3" /> No location yet
                        </span>
                      )}
                    </div>
                  </div>
                  <StatusChip status={person.status} />
                </button>
              </li>
            );
          })}
        </ul>
        <CrewMap crew={members} sites={sites} fitKey={`${site}|${status}`} focusId={focusId} className="h-[70dvh] min-h-[420px] lg:order-2" />
      </div>
    </>
  );
}
