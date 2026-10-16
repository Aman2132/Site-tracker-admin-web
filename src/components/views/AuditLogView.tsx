"use client";

import { ChevronLeft, ChevronRight, Info, Loader2, ScrollText, Search, UserRound } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { SuperadminOnly } from "@/components/auth/AuthGate";
import { TextInput } from "@/components/domain/FormBits";
import { PageHeader } from "@/components/domain/PageHeader";
import { SegmentedControl } from "@/components/domain/SegmentedControl";
import { EmptyState } from "@/components/domain/Panel";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDateTime, formatDay, formatTime, plural } from "@/lib/format";
import { AUDIT_LIMIT, VIEWS_LIMIT, useAdminAudit, useAdminViews, useLiveStore, useLookups, useNow } from "@/lib/store";
import { DAY, TZ_LABEL, dayStart } from "@/lib/time";

import type { AuditEntry } from "@/types/domain";

const PAGE_SIZE = 50;

type Tab = "all" | "change" | "auth" | "failed" | "export" | "views";

/** One line of the log, whether it came from the audit log or the page log. */
interface Row {
  id: string;
  at: number;
  actorId: string;
  actorName: string;
  action: string;
  kind: "change" | "auth" | "failed" | "export" | "view" | "external";
  entry?: AuditEntry;
  path?: string;
  changes?: string;
  reason?: string;
  note?: string;
}

const KIND_BADGE: Partial<Record<Row["kind"], { label: string; className: string }>> = {
  auth: { label: "Sign-in", className: "bg-accent text-accent-foreground" },
  failed: { label: "Failed", className: "bg-danger-soft text-danger" },
  export: { label: "Export", className: "bg-warning-soft text-warning" },
  view: { label: "Page", className: "bg-muted text-muted-foreground" },
  external: { label: "Left dashboard", className: "bg-muted text-muted-foreground" },
};

type Range = "today" | "7d" | "30d" | "all";
const RANGE_DAYS: Record<Range, number | null> = { today: 1, "7d": 7, "30d": 30, all: null };

/**
 * The stored action is the in-progress label the admin saw ("Granting admin"), which also titles failure
 * toasts. A log reads in the past tense, so known labels are rewritten for display (older entries too).
 */
const PAST_TENSE: Record<string, string> = {
  "Creating the account": "Created account",
  "Creating the site": "Created site",
  "Deleting photos": "Deleted photos",
  "Editing check-in/out": "Edited check-in/out",
  "Resending the invite": "Resent invite",
  "Updating crew": "Updated crew",
  "Updating sites": "Updated sites",
  "Updating status": "Updated site status",
  "Granting admin": "Granted admin",
  "Revoking admin": "Revoked admin",
  "Reactivating": "Reactivated",
  "Deactivating": "Deactivated",
  "Sending a password reset": "Sent password reset",
};
const pastTense = (action: string) => PAST_TENSE[action] ?? action;

export function AuditLogView() {
  return (
    <SuperadminOnly>
      <AuditLog />
    </SuperadminOnly>
  );
}

function AuditLog() {
  const { entries, error } = useAdminAudit();
  const [tab, setTab] = useState<Tab>("all");
  const views = useAdminViews(tab === "views");
  const { sessions, inventory } = useLiveStore();
  const { personById, siteById } = useLookups();
  const now = useNow();
  const [actor, setActor] = useState("all");
  const [query, setQuery] = useState("");
  const [range, setRange] = useState<Range>("all");
  const [page, setPage] = useState(0);

  /** Readable name (and a link, when it still exists) for what an entry touched. Never a raw id. */
  const target = useMemo(() => {
    const sessionById = new Map(sessions.map(s => [s.id, s]));
    const inventoryById = new Map(inventory.map(i => [i.id, i]));
    return (e: AuditEntry): { name: string; href?: string } => {
      if (!e.targetType) return { name: "" };
      const id = e.targetId ?? "";
      if (e.targetType === "person") {
        const person = personById.get(id);
        return person ? { name: person.name, href: `/crew/${id}` } : { name: "Removed person" };
      }
      if (e.targetType === "site") {
        const site = siteById.get(id);
        return site ? { name: site.name, href: `/sites/${id}` } : { name: "Removed site" };
      }
      if (e.targetType === "session") {
        const session = sessionById.get(id);
        if (!session) return { name: "Check-in (older than 15 days)" };
        const who = personById.get(session.personId)?.name ?? "Someone";
        return { name: `${who} · check-in ${formatDay(session.start)} ${formatTime(session.start)}`, href: `/crew/${session.personId}` };
      }
      if (e.targetType === "inventory") {
        const item = inventoryById.get(id);
        return item
          ? { name: `${item.name} · ${siteById.get(item.siteId)?.name ?? "site"}`, href: "/inventory" }
          : { name: "Inventory entry (deleted)" };
      }
      if (e.targetType === "photo") return { name: id ? "Photo" : "Photos", href: "/photos" };
      return { name: e.targetType };
    };
  }, [sessions, inventory, personById, siteById]);

  const actors = useMemo(() => {
    const names = new Map<string, string>();
    for (const e of [...(entries ?? []), ...(views.entries ?? [])]) if (!names.has(e.actorId)) names.set(e.actorId, e.actorName || e.actorId.slice(0, 8));
    return [...names].sort((a, b) => a[1].localeCompare(b[1]));
  }, [entries, views.entries]);

  /** A page path as a name a person can read: "Crew profile: Ram" rather than /crew/abc123. */
  const pageTarget = (path: string): { name: string; href?: string } => {
    const crewId = path.match(/^\/crew\/([^/]+)/)?.[1];
    if (crewId) return { name: `Crew profile: ${personById.get(crewId)?.name ?? "removed person"}`, href: personById.has(crewId) ? path : undefined };
    const siteId = path.match(/^\/sites\/([^/]+)/)?.[1];
    if (siteId) return { name: `Site: ${siteById.get(siteId)?.name ?? "removed site"}`, href: siteById.has(siteId) ? path : undefined };
    return path.startsWith("/") ? { name: path, href: path } : { name: path };
  };

  const all: Row[] = useMemo(() => {
    if (tab === "views") {
      return (views.entries ?? []).map(v => ({
        id: v.id,
        at: v.at,
        actorId: v.actorId,
        actorName: v.actorName,
        action: v.kind === "external" ? "Left the dashboard" : `Opened ${v.title}`,
        kind: v.kind,
        path: v.path,
      }));
    }
    return (entries ?? []).map(e => ({
      id: e.id,
      at: e.at,
      actorId: e.actorId,
      actorName: e.actorName,
      action: e.action,
      kind: e.kind ?? "change",
      entry: e,
      changes: e.changes,
      reason: e.reason,
      note: e.note,
    }));
  }, [tab, entries, views.entries]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const days = RANGE_DAYS[range];
    const from = days == null ? 0 : dayStart(now) - (days - 1) * DAY;
    return all.filter(
      r =>
        r.at >= from &&
        (tab === "all" || tab === "views" || r.kind === tab) &&
        (actor === "all" || r.actorId === actor) &&
        (!q ||
          [r.actorName, pastTense(r.action), r.note ?? "", r.changes ?? "", r.reason ?? "", r.entry ? target(r.entry).name : r.path ? pageTarget(r.path).name : ""].some(text =>
            text.toLowerCase().includes(q)
          ))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pageTarget only reads the lookups already listed
  }, [all, tab, actor, query, range, now, target, personById, siteById]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: entries?.length ?? 0 };
    for (const e of entries ?? []) c[e.kind ?? "change"] = (c[e.kind ?? "change"] ?? 0) + 1;
    return c;
  }, [entries]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const shown = rows.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  const feed = tab === "views" ? views : { entries, error };
  const atLimit = tab === "views" ? (views.entries?.length ?? 0) >= VIEWS_LIMIT : (entries?.length ?? 0) >= AUDIT_LIMIT;

  return (
    <>
      <PageHeader
        title="Audit log"
        description={`Everything admins do: changes (with before → after), sign-ins, failed attempts, exports and every page opened. Newest first. Times in ${TZ_LABEL}.`}
      />

      <div className="mb-3 overflow-x-auto scrollbar-thin">
        <SegmentedControl<Tab>
          value={tab}
          onChange={v => {
            setTab(v);
            setPage(0);
          }}
          options={[
            { value: "all", label: "All", count: counts.all },
            { value: "change", label: "Changes", count: counts.change ?? 0 },
            { value: "auth", label: "Sign-ins", count: counts.auth ?? 0 },
            { value: "failed", label: "Failed", count: counts.failed ?? 0 },
            { value: "export", label: "Exports", count: counts.export ?? 0 },
            { value: "views", label: "Page views" },
          ]}
        />
      </div>

      <div className="surface mb-5 flex flex-col gap-3 rounded-2xl p-3 md:flex-row md:items-center">
        <div className="relative min-w-52 flex-1 md:max-w-80">
          <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <TextInput
            placeholder="Search actions, targets, notes"
            className="h-10 pl-10"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setPage(0);
            }}
          />
        </div>
        <SegmentedControl
          value={range}
          onChange={v => {
            setRange(v);
            setPage(0);
          }}
          className="md:ml-auto"
          options={[
            { value: "today", label: "Today" },
            { value: "7d", label: "7 days" },
            { value: "30d", label: "30 days" },
            { value: "all", label: "All" },
          ]}
        />
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="lg" className="h-10 rounded-xl" />}>
            <UserRound /> {actor === "all" ? "All admins" : actors.find(([id]) => id === actor)?.[1]}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuRadioGroup
              value={actor}
              onValueChange={v => {
                setActor(String(v));
                setPage(0);
              }}
            >
              <DropdownMenuRadioItem value="all">All admins</DropdownMenuRadioItem>
              {actors.map(([id, name]) => (
                <DropdownMenuRadioItem key={id} value={id}>
                  {name}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {feed.error ? (
        <EmptyState icon={<ScrollText className="size-6" />} title="Couldn't load the audit log" description={feed.error} />
      ) : feed.entries == null ? (
        <div className="flex justify-center py-14 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={<ScrollText className="size-6" />} title="Nothing here" description="No admin actions match." />
      ) : (
        <>
        {atLimit && (
          <div className="mb-3 flex items-start gap-2 rounded-xl bg-accent px-3 py-2.5 text-sm text-accent-foreground">
            <Info className="mt-0.5 size-4 shrink-0" />
            Only the newest {tab === "views" ? VIEWS_LIMIT : AUDIT_LIMIT} {tab === "views" ? "page views" : "admin actions"} are loaded. Anything older isn&apos;t shown here.{tab === "views" ? " Old page views can be cleared in Storage → Clean up." : ""}
          </div>
        )}
        <div className="surface overflow-hidden rounded-2xl">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-bold tracking-wide text-muted-foreground uppercase">
                  <th className="px-5 py-3.5">Time</th>
                  <th className="px-3 py-3.5">Admin</th>
                  <th className="px-3 py-3.5">Action</th>
                  <th className="px-3 py-3.5">{tab === "views" ? "Page" : "Target"}</th>
                  <th className="px-5 py-3.5">Details</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(e => {
                  const t = e.entry ? target(e.entry) : e.path ? pageTarget(e.path) : { name: "" };
                  const badge = KIND_BADGE[e.kind];
                  return (
                    <tr key={e.id} className="border-b border-border/70 align-top last:border-0">
                      <td className="px-5 py-3 whitespace-nowrap tabular-nums text-muted-foreground">{formatDateTime(e.at)}</td>
                      <td className="px-3 py-3 font-bold">{e.actorName || "Unknown admin"}</td>
                      <td className="min-w-44 px-3 py-3">
                        {badge && <span className={`mr-2 inline-flex rounded px-1.5 text-[11px] font-semibold ${badge.className}`}>{badge.label}</span>}
                        {e.kind === "failed" ? e.action : pastTense(e.action)}
                      </td>
                      <td className="px-3 py-3">
                        {t.href ? (
                          <Link href={t.href} className="font-medium text-primary hover:underline">
                            {t.name}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">{t.name}</span>
                        )}
                      </td>
                      <td className="max-w-96 space-y-1 px-5 py-3 break-words text-muted-foreground">
                        {e.reason && <div className="font-medium text-danger">{e.reason}</div>}
                        {e.changes && <div className="font-mono text-xs text-foreground">{e.changes}</div>}
                        {e.note && <div>Note: {e.note}</div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3 text-sm text-muted-foreground">
            <span>
              {current * PAGE_SIZE + 1}–{current * PAGE_SIZE + shown.length} of {plural(rows.length, "entry", "entries")}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon-sm" aria-label="Newer" disabled={current === 0} onClick={() => setPage(current - 1)}>
                <ChevronLeft />
              </Button>
              <span className="px-2 tabular-nums">
                Page {current + 1} / {pages}
              </span>
              <Button variant="outline" size="icon-sm" aria-label="Older" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
                <ChevronRight />
              </Button>
            </div>
          </div>
        </div>
        </>
      )}
    </>
  );
}
