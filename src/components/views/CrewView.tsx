"use client";

import {
  ArrowDownUp,
  Building2,
  Download,
  Eye,
  LayoutGrid,
  List,
  MailPlus,
  MoreHorizontal,
  Search,
  UserCheck,
  UserPlus,
  UserX,
  Users,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AssignSitesSheet } from "@/components/domain/AssignSheet";
import { BatteryMeter } from "@/components/domain/BatteryMeter";
import { TextInput } from "@/components/domain/FormBits";
import { PageHeader } from "@/components/domain/PageHeader";
import { EmptyState } from "@/components/domain/Panel";
import { PersonAvatar } from "@/components/domain/PersonAvatar";
import { SegmentedControl } from "@/components/domain/SegmentedControl";
import { StatusChip } from "@/components/domain/StatusDot";
import { useDialogs } from "@/components/layout/DialogsProvider";
import { EASE_OUT } from "@/components/motion";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatHours, timeAgo } from "@/lib/format";
import { hoursOnDay } from "@/lib/insights";
import { dayStart } from "@/lib/time";
import { attempt, useLiveStore, useLookups, useNow } from "@/lib/store";
import { useTarget } from "@/lib/useTarget";

import type { CrewMember, PresenceStatus } from "@/types/domain";

type Filter = "all" | PresenceStatus;
type SortKey = "name" | "lastSeen" | "hours";

function CrewActions({ person, onAssign }: { person: CrewMember; onAssign: () => void }) {
  const { setCrewActive, resendInvite } = useLiveStore();
  const router = useRouter();
  const deactivated = person.status === "deactivated";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="rounded-lg"
            aria-label={`Actions for ${person.name}`}
            onClick={e => e.stopPropagation()}
          />
        }
      >
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52" onClick={e => e.stopPropagation()}>
        <DropdownMenuItem onClick={() => router.push(`/crew/${person.id}`)}>
          <Eye /> View profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onAssign}>
          <Building2 /> Assign sites
        </DropdownMenuItem>
        {person.status === "invited" && (
          <DropdownMenuItem
            onClick={async () => {
              if (!person.email) return toast.error("No email on file for this person.");
              if (await attempt("Resending the invite", () => resendInvite(person.email)))
                toast.success("Invite re-sent", { description: `New set-password link sent to ${person.email}.` });
            }}
          >
            <MailPlus /> Resend invite
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant={deactivated ? "default" : "destructive"}
          onClick={async () => {
            if (!(await attempt(deactivated ? "Reactivating" : "Deactivating", () => setCrewActive(person.id, person.name, deactivated)))) return;
            toast(deactivated ? `${person.name} reactivated` : `${person.name} deactivated`, {
              description: deactivated ? "They can sign in again." : "They're signed out and can't sign back in.",
            });
          }}
        >
          {deactivated ? <UserCheck /> : <UserX />} {deactivated ? "Reactivate" : "Deactivate"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function CrewView() {
  const router = useRouter();
  const { crew, sessions, sites } = useLiveStore();
  const { siteById } = useLookups();
  const { openAddCrew } = useDialogs();
  const assign = useTarget();
  const now = useNow();

  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [siteFilter, setSiteFilter] = useState("all");
  const [sort, setSort] = useState<SortKey>("lastSeen");
  const [view, setView] = useState<"table" | "cards">("table");

  const hoursToday = useMemo(() => {
    const today = dayStart(now);
    const map = new Map<string, number>();
    for (const c of crew) map.set(c.id, hoursOnDay(sessions.filter(s => s.personId === c.id), today));
    return map;
  }, [crew, sessions, now]);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: crew.length, online: 0, idle: 0, offline: 0, invited: 0, deactivated: 0 };
    for (const p of crew) c[p.status]++;
    return c;
  }, [crew]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return crew
      .filter(p => filter === "all" || p.status === filter)
      .filter(p => siteFilter === "all" || p.siteIds.includes(siteFilter))
      .filter(p => !q || `${p.name} ${p.email} ${p.jobTitle} ${p.team}`.toLowerCase().includes(q))
      .sort((a, b) => {
        if (sort === "name") return a.name.localeCompare(b.name);
        if (sort === "hours") return (hoursToday.get(b.id) ?? 0) - (hoursToday.get(a.id) ?? 0);
        return (b.lastSeenAt ?? 0) - (a.lastSeenAt ?? 0);
      });
  }, [crew, filter, siteFilter, query, sort, hoursToday]);

  const exportCsv = () => {
    const header = "Name,Email,Job title,Team,Status,Sites,Hours today,Last seen\n";
    const body = rows
      .map(p =>
        [p.name, p.email, p.jobTitle, p.team, p.status, p.siteIds.map(id => siteById.get(id)?.name).join(" | "), formatHours(hoursToday.get(p.id) ?? 0), timeAgo(p.lastSeenAt)]
          .map(v => `"${v}"`)
          .join(",")
      )
      .join("\n");
    const url = URL.createObjectURL(new Blob([header + body], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "crew.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Crew exported", { description: `${rows.length} rows · crew.csv` });
  };

  return (
    <>
      <PageHeader
        title="Crew"
        description="Everyone on the roster — who's on shift, where they're assigned, and who still needs to accept an invite."
        actions={
          <>
            <Button variant="outline" size="lg" className="rounded-xl bg-card" onClick={exportCsv}>
              <Download /> Export
            </Button>
            <Button size="lg" className="rounded-xl px-4 shadow-glow" onClick={() => openAddCrew()}>
              <UserPlus /> Add crew
            </Button>
          </>
        }
      />

      <div className="surface mb-5 flex flex-col gap-3 rounded-2xl p-3 lg:flex-row lg:items-center">
        <div className="overflow-x-auto scrollbar-thin">
          <SegmentedControl
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All", count: counts.all },
              { value: "online", label: "Online", count: counts.online },
              { value: "idle", label: "Idle", count: counts.idle },
              { value: "offline", label: "Offline", count: counts.offline },
              { value: "invited", label: "Invited", count: counts.invited },
              { value: "deactivated", label: "Deactivated", count: counts.deactivated },
            ]}
          />
        </div>
        <div className="flex flex-1 flex-wrap items-center gap-2 lg:justify-end">
          <div className="relative min-w-52 flex-1 lg:max-w-72">
            <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <TextInput placeholder="Search crew" className="h-10 pl-10" value={query} onChange={e => setQuery(e.target.value)} />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="lg" className="h-10 rounded-xl" />}>
              <Building2 /> {siteFilter === "all" ? "All sites" : siteById.get(siteFilter)?.code}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Filter by site</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={siteFilter} onValueChange={v => setSiteFilter(String(v))}>
                  <DropdownMenuRadioItem value="all">All sites</DropdownMenuRadioItem>
                  {sites.map(s => (
                    <DropdownMenuRadioItem key={s.id} value={s.id}>
                      <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.name}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="lg" className="h-10 rounded-xl" />}>
              <ArrowDownUp /> Sort
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuRadioGroup value={sort} onValueChange={v => setSort(v as SortKey)}>
                <DropdownMenuRadioItem value="lastSeen">Last seen</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="hours">Hours today</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <SegmentedControl
            value={view}
            onChange={setView}
            options={[
              { value: "table", label: <List className="size-4" aria-label="Table view" /> },
              { value: "cards", label: <LayoutGrid className="size-4" aria-label="Card view" /> },
            ]}
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Users className="size-6" />}
          title="No one matches"
          description="Try a different status, site or search term."
          action={
            <Button variant="outline" className="rounded-xl" onClick={() => { setFilter("all"); setQuery(""); setSiteFilter("all"); }}>
              Clear filters
            </Button>
          }
        />
      ) : view === "table" ? (
        <div className="surface overflow-hidden rounded-2xl">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[920px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-bold tracking-wide text-muted-foreground uppercase">
                  <th className="px-5 py-3.5">Person</th>
                  <th className="px-3 py-3.5">Status</th>
                  <th className="px-3 py-3.5">Sites</th>
                  <th className="px-3 py-3.5">Today</th>
                  <th className="px-3 py-3.5">Battery</th>
                  <th className="px-3 py-3.5">Last seen</th>
                  <th className="w-12 px-3 py-3.5" />
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {rows.map((p, i) => (
                    <motion.tr
                      key={p.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3, ease: EASE_OUT, delay: Math.min(i, 14) * 0.025 }}
                      onClick={() => router.push(`/crew/${p.id}`)}
                      className="group cursor-pointer border-b border-border/70 transition-colors last:border-0 hover:bg-accent/40"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <PersonAvatar person={p} size="md" showStatus={p.status === "online" || p.status === "idle"} />
                          <div className="min-w-0">
                            <div className="truncate font-bold transition-colors group-hover:text-primary">{p.name}</div>
                            <div className="truncate text-xs text-muted-foreground">
                              {[p.jobTitle, p.team].filter(Boolean).join(" · ")}
                              {p.appRole === "owner" && <span className="ml-1.5 rounded bg-accent px-1 text-[10px] font-bold text-primary">ADMIN</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <StatusChip status={p.status} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex max-w-56 flex-wrap gap-1">
                          {p.siteIds.slice(0, 2).map(id => {
                            const s = siteById.get(id);
                            if (!s) return null;
                            return (
                              <span key={id} className="inline-flex items-center gap-1.5 rounded-md bg-muted px-1.5 py-0.5 text-xs font-semibold">
                                <span className="size-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                                {s.code}
                              </span>
                            );
                          })}
                          {p.siteIds.length > 2 && <span className="text-xs font-semibold text-muted-foreground">+{p.siteIds.length - 2}</span>}
                          {p.siteIds.length === 0 && <span className="text-xs text-faint">Unassigned</span>}
                        </div>
                      </td>
                      <td className="px-3 py-3 font-semibold tabular-nums">
                        {hoursToday.get(p.id) ? formatHours(hoursToday.get(p.id)!) : <span className="text-faint">—</span>}
                      </td>
                      <td className="px-3 py-3">
                        <BatteryMeter value={p.battery} />
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{p.status === "invited" ? "Not signed in yet" : timeAgo(p.lastSeenAt)}</td>
                      <td className="px-3 py-3 text-right">
                        <CrewActions person={p} onAssign={() => assign.show(p.id)} />
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <motion.div layout className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          <AnimatePresence initial={false}>
            {rows.map((p, i) => (
              <motion.div
                key={p.id}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.3, delay: Math.min(i, 12) * 0.03 }}
                whileHover={{ y: -4 }}
              >
                <Link href={`/crew/${p.id}`} className="surface group block rounded-2xl p-5 transition-shadow hover:shadow-lift">
                  <div className="flex items-start justify-between">
                    <PersonAvatar person={p} size="lg" showStatus={p.status === "online" || p.status === "idle"} />
                    <StatusChip status={p.status} />
                  </div>
                  <div className="mt-4 truncate text-base font-extrabold group-hover:text-primary">{p.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {[p.jobTitle, p.team].filter(Boolean).join(" · ")}
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-muted/60 p-3 text-center">
                    <div>
                      <div className="text-sm font-extrabold">{formatHours(hoursToday.get(p.id) ?? 0)}</div>
                      <div className="text-[10px] font-semibold text-muted-foreground uppercase">Today</div>
                    </div>
                    <div>
                      <div className="text-sm font-extrabold">{p.siteIds.length}</div>
                      <div className="text-[10px] font-semibold text-muted-foreground uppercase">Sites</div>
                    </div>
                    <div>
                      <div className="flex justify-center"><BatteryMeter value={p.battery} /></div>
                      <div className="text-[10px] font-semibold text-muted-foreground uppercase">Battery</div>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground">
                    {p.status === "invited" ? "Invite pending" : `Last seen ${timeAgo(p.lastSeenAt)}`}
                  </div>
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <AssignSitesSheet key={assign.key} personId={assign.id} open={assign.open} onOpenChange={assign.setOpen} />
    </>
  );
}
