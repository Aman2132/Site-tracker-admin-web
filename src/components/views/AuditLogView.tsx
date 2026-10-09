"use client";

import { Loader2, ScrollText, Search, UserRound } from "lucide-react";
import { useMemo, useState } from "react";

import { SuperadminOnly } from "@/components/auth/AuthGate";
import { TextInput } from "@/components/domain/FormBits";
import { PageHeader } from "@/components/domain/PageHeader";
import { EmptyState } from "@/components/domain/Panel";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDateTime, formatDay, formatTime } from "@/lib/format";
import { useAdminAudit, useLiveStore, useLookups } from "@/lib/store";
import { TZ_LABEL } from "@/lib/time";

import type { AuditEntry } from "@/types/domain";

export function AuditLogView() {
  return (
    <SuperadminOnly>
      <AuditLog />
    </SuperadminOnly>
  );
}

function AuditLog() {
  const { entries, error } = useAdminAudit();
  const { sessions } = useLiveStore();
  const { personById, siteById } = useLookups();
  const [actor, setActor] = useState("all");
  const [query, setQuery] = useState("");

  /** Readable name for what an entry touched; falls back to the type and a short id. */
  const targetName = useMemo(() => {
    const sessionById = new Map(sessions.map(s => [s.id, s]));
    return (e: AuditEntry): string => {
      if (!e.targetType) return "—";
      const id = e.targetId ?? "";
      if (e.targetType === "person" && personById.has(id)) return personById.get(id)!.name;
      if (e.targetType === "site" && siteById.has(id)) return siteById.get(id)!.name;
      const session = e.targetType === "session" ? sessionById.get(id) : undefined;
      if (session) {
        const who = personById.get(session.personId)?.name ?? "Someone";
        return `${who} · check-in ${formatDay(session.start)} ${formatTime(session.start)}`;
      }
      return id ? `${e.targetType} ${id.slice(0, 8)}` : e.targetType;
    };
  }, [sessions, personById, siteById]);

  const actors = useMemo(() => {
    const names = new Map<string, string>();
    for (const e of entries ?? []) if (!names.has(e.actorId)) names.set(e.actorId, e.actorName || e.actorId.slice(0, 8));
    return [...names].sort((a, b) => a[1].localeCompare(b[1]));
  }, [entries]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (entries ?? []).filter(
      e =>
        (actor === "all" || e.actorId === actor) &&
        (!q || [e.actorName, e.action, e.note ?? "", targetName(e)].some(text => text.toLowerCase().includes(q)))
    );
  }, [entries, actor, query, targetName]);

  return (
    <>
      <PageHeader title="Audit log" description={`Every edit made by an admin, newest first (last 500). Times in ${TZ_LABEL}.`} />

      <div className="surface mb-5 flex flex-col gap-3 rounded-2xl p-3 md:flex-row md:items-center">
        <div className="relative min-w-52 flex-1 md:max-w-80">
          <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <TextInput placeholder="Search actions, targets, notes" className="h-10 pl-10" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="lg" className="h-10 rounded-xl md:ml-auto" />}>
            <UserRound /> {actor === "all" ? "All admins" : actors.find(([id]) => id === actor)?.[1]}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuRadioGroup value={actor} onValueChange={v => setActor(String(v))}>
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

      {error ? (
        <EmptyState icon={<ScrollText className="size-6" />} title="Couldn't load the audit log" description={error} />
      ) : entries == null ? (
        <div className="flex justify-center py-14 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={<ScrollText className="size-6" />} title="Nothing here" description="No admin actions match." />
      ) : (
        <div className="surface overflow-hidden rounded-2xl">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-bold tracking-wide text-muted-foreground uppercase">
                  <th className="px-5 py-3.5">Time</th>
                  <th className="px-3 py-3.5">Admin</th>
                  <th className="px-3 py-3.5">Action</th>
                  <th className="px-3 py-3.5">Target</th>
                  <th className="px-5 py-3.5">Note</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(e => (
                  <tr key={e.id} className="border-b border-border/70 align-top last:border-0">
                    <td className="px-5 py-3 whitespace-nowrap tabular-nums text-muted-foreground">{formatDateTime(e.at)}</td>
                    <td className="px-3 py-3 font-bold">{e.actorName || "—"}</td>
                    <td className="px-3 py-3">{e.action}</td>
                    <td className="px-3 py-3">{targetName(e)}</td>
                    <td className="max-w-80 px-5 py-3 break-words text-muted-foreground">{e.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
