"use client";

import { Activity, Building2 } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";

import { ActivityFeed, EVENT_META } from "@/components/domain/ActivityFeed";
import { PageHeader } from "@/components/domain/PageHeader";
import { EmptyState, Panel } from "@/components/domain/Panel";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDay } from "@/lib/format";
import { DAY, dayStart } from "@/lib/time";
import { useLiveStore, useLookups } from "@/lib/store";
import { cn } from "@/lib/utils";

import type { ActivityEvent, EventKind } from "@/types/domain";

const KIND_FILTERS: (EventKind | "all")[] = ["all", "checkin", "checkout", "upload", "battery", "pause", "resume", "crew", "site"];

function dayLabel(day: number) {
  const today = dayStart(Date.now());
  if (day === today) return "Today";
  if (day === today - DAY) return "Yesterday";
  return formatDay(day);
}

export function ActivityView() {
  const { events, sites } = useLiveStore();
  const { siteById } = useLookups();
  const [kind, setKind] = useState<EventKind | "all">("all");
  const [site, setSite] = useState("all");

  const filtered = useMemo(
    () => events.filter(e => (kind === "all" || e.kind === kind) && (site === "all" || e.siteId === site)),
    [events, kind, site]
  );

  const groups = useMemo(() => {
    const map = new Map<number, ActivityEvent[]>();
    for (const e of filtered) {
      const d = dayStart(e.at);
      map.set(d, [...(map.get(d) ?? []), e]);
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [filtered]);

  const countOf = (k: EventKind | "all") => (k === "all" ? events.length : events.filter(e => e.kind === k).length);

  return (
    <>
      <PageHeader
        title="Activity"
        description="Check-ins, check-outs, uploads and alerts across every site, with history."
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

      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        <div className="lg:sticky lg:top-[96px] lg:self-start">
          <div className="surface flex gap-1 overflow-x-auto rounded-2xl p-2 scrollbar-thin lg:flex-col">
            {KIND_FILTERS.map(k => {
              const active = kind === k;
              const meta = k === "all" ? null : EVENT_META[k];
              const Icon = meta?.icon ?? Activity;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={cn(
                    "relative flex h-11 shrink-0 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors",
                    active ? "text-accent-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {active && (
                    <motion.span layoutId="activity-filter" className="absolute inset-0 rounded-xl bg-accent" transition={{ type: "spring", stiffness: 380, damping: 32 }} />
                  )}
                  <span className={cn("relative flex size-7 items-center justify-center rounded-lg", meta?.tone ?? "bg-muted text-foreground")}>
                    <Icon className="size-3.5" />
                  </span>
                  <span className="relative flex-1 text-left whitespace-nowrap">{meta?.label ?? "Everything"}</span>
                  <span className="relative rounded-md bg-background/70 px-1.5 text-xs font-bold">{countOf(k)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-5">
          {groups.length === 0 ? (
            <EmptyState icon={<Activity className="size-6" />} title="Nothing here" description="No events match this filter." />
          ) : (
            groups.map(([day, items]) => (
              <Panel key={`${day}-${kind}-${site}`} title={dayLabel(day)} description={`${items.length} events`}>
                <ActivityFeed events={items} />
              </Panel>
            ))
          )}
        </div>
      </div>
    </>
  );
}
