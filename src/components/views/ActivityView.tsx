"use client";

import { Activity, Building2, Search, X } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";

import { ActivityFeed, EVENT_META } from "@/components/domain/ActivityFeed";
import { PageHeader } from "@/components/domain/PageHeader";
import { TextInput } from "@/components/domain/FormBits";
import { EmptyState, Panel } from "@/components/domain/Panel";
import { SegmentedControl } from "@/components/domain/SegmentedControl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDay, plural } from "@/lib/format";
import { DAY, dayStart } from "@/lib/time";
import { useLiveStore, useLookups, useNow } from "@/lib/store";
import { defaultSiteAmong } from "@/lib/prefs";
import { cn } from "@/lib/utils";

import type { ActivityEvent, EventKind } from "@/types/domain";

const KIND_FILTERS: (EventKind | "all")[] = ["all", "checkin", "checkout", "upload", "battery", "pause", "resume", "crew", "site"];

type Range = "today" | "7d" | "30d" | "all";
const RANGE_DAYS: Record<Range, number | null> = { today: 1, "7d": 7, "30d": 30, all: null };

function dayLabel(day: number) {
  const today = dayStart(Date.now());
  if (day === today) return "Today";
  if (day === today - DAY) return "Yesterday";
  return formatDay(day);
}

export function ActivityView() {
  const { events, sites } = useLiveStore();
  const { siteById, personById } = useLookups();
  const now = useNow();
  const [kind, setKind] = useState<EventKind | "all">("all");
  const [site, setSite] = useState(() => defaultSiteAmong(sites));
  const [range, setRange] = useState<Range>("7d");
  const [query, setQuery] = useState("");

  /** Every filter but the event type: the type list counts from this, so each count is what clicking it shows. */
  const inScope = useMemo(() => {
    const days = RANGE_DAYS[range];
    const from = days == null ? 0 : dayStart(now) - (days - 1) * DAY;
    const q = query.trim().toLowerCase();
    return events.filter(
      e =>
        e.at >= from &&
        (site === "all" || e.siteId === site) &&
        (!q ||
          e.text.toLowerCase().includes(q) ||
          (e.personId && personById.get(e.personId)?.name.toLowerCase().includes(q)) ||
          (e.siteId && siteById.get(e.siteId)?.name.toLowerCase().includes(q)))
    );
  }, [events, site, range, query, now, personById, siteById]);
  const filtered = useMemo(() => inScope.filter(e => kind === "all" || e.kind === kind), [inScope, kind]);

  const groups = useMemo(() => {
    const map = new Map<number, ActivityEvent[]>();
    for (const e of filtered) {
      const d = dayStart(e.at);
      map.set(d, [...(map.get(d) ?? []), e]);
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [filtered]);

  const countOf = (k: EventKind | "all") => (k === "all" ? inScope.length : inScope.filter(e => e.kind === k).length);

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
        <div className="min-w-0 lg:sticky lg:top-[84px] lg:self-start">
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

        <div className="min-w-0 space-y-5">
          <div className="surface flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <TextInput placeholder="Search people, sites or events" className="h-10 pl-10" value={query} onChange={e => setQuery(e.target.value)} />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            <SegmentedControl
              value={range}
              onChange={setRange}
              options={[
                { value: "today", label: "Today" },
                { value: "7d", label: "7 days" },
                { value: "30d", label: "30 days" },
                { value: "all", label: "All" },
              ]}
            />
          </div>
          {groups.length === 0 ? (
            <EmptyState icon={<Activity className="size-6" />} title="Nothing here" description="No events match these filters." />
          ) : (
            groups.map(([day, items]) => (
              <Panel key={`${day}-${kind}-${site}`} title={dayLabel(day)} description={plural(items.length, "event")}>
                <ActivityFeed events={items} />
              </Panel>
            ))
          )}
        </div>
      </div>
    </>
  );
}
