"use client";

import {
  Activity,
  Building2,
  ClipboardCheck,
  Eye,
  ImageIcon,
  Package,
  ScrollText,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

import { ResetPhotoGrid } from "@/components/domain/reset/ResetPhotoGrid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { BULK_INFO, BULK_KINDS, photosForcedBy, type BulkKind, type ResetPreview, type ResetSelection } from "@/lib/reset";
import { cn } from "@/lib/utils";

export type ResetGroup = "people" | "sites" | "photos" | BulkKind;

const BULK_ICONS: Record<BulkKind, LucideIcon> = {
  sessions: ClipboardCheck,
  inventory: Package,
  events: Activity,
  views: Eye,
  audit: ScrollText,
};

interface GroupRow {
  key: ResetGroup;
  title: string;
  icon: LucideIcon;
  selected: number;
  total: number;
}

/** A copy of the selection with one set replaced, so React sees the change. */
const withSet = <K extends "people" | "sites" | "photos">(selection: ResetSelection, key: K, next: Set<string>): ResetSelection => ({
  ...selection,
  [key]: next,
});

function toggled(set: Set<string>, id: string): Set<string> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/**
 * Step one of the reset: pick what to delete. Everything starts ticked. The
 * left list shows each group with how much of it is ticked; the right side shows
 * the chosen group's items to tick or untick one by one.
 */
export function ResetSelectStep({
  preview,
  selection,
  active,
  onActive,
  onChange,
}: {
  preview: ResetPreview;
  selection: ResetSelection;
  active: ResetGroup;
  onActive: (group: ResetGroup) => void;
  onChange: (selection: ResetSelection) => void;
}) {
  const deletablePeople = preview.people.filter(person => !person.locked);
  const forced = photosForcedBy(preview, selection.people, selection.sites);
  const photoCount = new Set([...selection.photos, ...forced]).size;

  const groups: GroupRow[] = [
    { key: "people", title: "People & sign-ins", icon: Users, selected: selection.people.size, total: deletablePeople.length },
    { key: "sites", title: "Sites", icon: Building2, selected: selection.sites.size, total: preview.sites.length },
    { key: "photos", title: "Photos", icon: ImageIcon, selected: photoCount, total: preview.photos.length },
    ...BULK_KINDS.map(kind => ({
      key: kind,
      title: BULK_INFO[kind].title,
      icon: BULK_ICONS[kind],
      selected: selection.bulk.has(kind) ? preview.counts[kind] : 0,
      total: preview.counts[kind],
    })),
  ];

  const setGroupAll = (key: ResetGroup, all: boolean) => {
    if (key === "people") onChange(withSet(selection, "people", new Set(all ? deletablePeople.map(p => p.id) : [])));
    else if (key === "sites") onChange(withSet(selection, "sites", new Set(all ? preview.sites.map(s => s.id) : [])));
    else if (key === "photos") onChange(withSet(selection, "photos", new Set(all ? preview.photos.map(p => p.id) : [])));
    else {
      const bulk = new Set(selection.bulk);
      if (all) bulk.add(key);
      else bulk.delete(key);
      onChange({ ...selection, bulk });
    }
  };

  const activeRow = groups.find(group => group.key === active) ?? groups[0];

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <nav aria-label="What to delete" className="shrink-0 border-b bg-muted/40 p-2 md:w-72 md:overflow-y-auto md:border-r md:border-b-0 md:p-3">
        <ul className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
          {groups.map(group => {
            const Icon = group.icon;
            const all = group.total > 0 && group.selected === group.total;
            const some = group.selected > 0 && !all;
            return (
              <li key={group.key} className="shrink-0 md:shrink">
                <div
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
                    group.key === active ? "bg-card shadow-sm ring-1 ring-border" : "hover:bg-card/60"
                  )}
                >
                  <Checkbox
                    checked={all}
                    indeterminate={some}
                    disabled={group.total === 0}
                    onCheckedChange={checked => setGroupAll(group.key, checked)}
                    aria-label={`Delete all ${group.title}`}
                  />
                  <button type="button" onClick={() => onActive(group.key)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left outline-none">
                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{group.title}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {group.selected}/{group.total}
                    </span>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </nav>

      <section className="flex min-h-0 flex-1 flex-col" aria-label={activeRow.title}>
        <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0">
            <h3 className="text-base font-bold tracking-tight">{activeRow.title}</h3>
            <p className="text-sm text-muted-foreground">{describeGroup(active, preview)}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setGroupAll(active, true)} disabled={activeRow.total === 0}>
              Select all
            </Button>
            <Button variant="outline" size="sm" onClick={() => setGroupAll(active, false)} disabled={activeRow.selected === 0}>
              Clear
            </Button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {active === "people" && (
            <ul className="divide-y rounded-xl border">
              {preview.people.map(person => {
                const checked = selection.people.has(person.id);
                return (
                  <li key={person.id} className={cn("flex items-center gap-3 px-4 py-3", person.locked && "bg-muted/40")}>
                    <Checkbox
                      checked={checked}
                      disabled={person.locked}
                      onCheckedChange={() => onChange(withSet(selection, "people", toggled(selection.people, person.id)))}
                      aria-label={`Delete ${person.name || person.email}`}
                    />
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-primary">
                      {(person.name || person.email || "?").slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{person.name || "No name"}</div>
                      <div className="truncate text-xs text-muted-foreground">{person.email || "No email"}</div>
                    </div>
                    {person.locked ? (
                      <Badge variant="secondary" className="gap-1">
                        <ShieldCheck /> Kept · {person.appRole}
                      </Badge>
                    ) : person.appRole === "none" ? (
                      <Badge variant="outline">Sign-in, no profile</Badge>
                    ) : (
                      <Badge variant="outline" className="capitalize">
                        {person.appRole}
                      </Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {active === "sites" &&
            (preview.sites.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">There are no sites.</p>
            ) : (
              <ul className="divide-y rounded-xl border">
                {preview.sites.map(site => (
                  <li key={site.id} className="flex items-center gap-3 px-4 py-3">
                    <Checkbox
                      checked={selection.sites.has(site.id)}
                      onCheckedChange={() => onChange(withSet(selection, "sites", toggled(selection.sites, site.id)))}
                      aria-label={`Delete ${site.name}`}
                    />
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                      <Building2 className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1 truncate text-sm font-semibold">{site.name || "Unnamed site"}</div>
                    <span className="font-mono text-xs text-muted-foreground">{site.code}</span>
                  </li>
                ))}
              </ul>
            ))}

          {active === "photos" && (
            <ResetPhotoGrid
              photos={preview.photos}
              selected={selection.photos}
              forced={forced}
              onToggle={id => onChange(withSet(selection, "photos", toggled(selection.photos, id)))}
            />
          )}

          {BULK_KINDS.includes(active as BulkKind) && (
            <label className="flex cursor-pointer items-start gap-4 rounded-xl border p-5">
              <Checkbox
                checked={selection.bulk.has(active as BulkKind)}
                disabled={preview.counts[active as BulkKind] === 0}
                onCheckedChange={checked => setGroupAll(active, checked)}
                className="mt-0.5"
              />
              <span>
                <span className="block text-sm font-semibold">
                  Delete all {preview.counts[active as BulkKind]} {BULK_INFO[active as BulkKind].title.toLowerCase()} records
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">This removes {BULK_INFO[active as BulkKind].what}.</span>
              </span>
            </label>
          )}
        </div>
      </section>
    </div>
  );
}

function describeGroup(group: ResetGroup, preview: ResetPreview): string {
  if (group === "people") return "Their login and profile go. Their photos go with them. Admin and superadmin accounts are kept.";
  if (group === "sites") return "A site goes with its photos, check-ins, inventory and activity. It is also taken off everyone's assignments.";
  if (group === "photos") return `${preview.photos.length} photos. Each goes with its file and thumbnail. A photo of a ticked person or site is locked on.`;
  return `${preview.counts[group]} records.`;
}
