"use client";

import { Building2, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { attempt, useLiveStore } from "@/lib/store";

import { SelectCard, TextInput } from "./FormBits";
import { PersonAvatar } from "./PersonAvatar";
import { StatusChip } from "./StatusDot";

/** Pick which sites one person works on. */
export function AssignSitesSheet({
  personId,
  open,
  onOpenChange,
}: {
  personId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { crew, sites, setPersonSites } = useLiveStore();
  const person = crew.find(c => c.id === personId);
  const [selected, setSelected] = useState<string[]>(person?.siteIds ?? []);

  const save = async () => {
    if (!person) return;
    if (!(await attempt("Updating sites", () => setPersonSites(person.id, selected)))) return;
    toast.success(`Sites updated for ${person.name}`, { description: `${selected.length} site${selected.length === 1 ? "" : "s"} assigned.` });
    onOpenChange(false);
  };

  return (
    <Sheet open={open && !!person} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b border-border p-6">
          <SheetTitle className="text-lg font-semibold">Assign sites</SheetTitle>
          <SheetDescription>Photos and attendance are filed under these sites.</SheetDescription>
          {person && (
            <div className="mt-3 flex items-center gap-3 rounded-2xl bg-muted/60 p-3">
              <PersonAvatar person={person} size="md" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">{person.name}</div>
                <div className="text-xs text-muted-foreground">{person.jobTitle}</div>
              </div>
              <StatusChip status={person.status} />
            </div>
          )}
        </SheetHeader>
        <div className="flex-1 space-y-2.5 overflow-y-auto p-6 scrollbar-thin">
          {sites.map(site => {
            const on = selected.includes(site.id);
            return (
              <SelectCard
                key={site.id}
                selected={on}
                onClick={() => setSelected(on ? selected.filter(s => s !== site.id) : [...selected, site.id])}
                className="p-3.5"
              >
                <div className="flex items-center gap-3 pr-8">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl text-white" style={{ backgroundColor: site.color }}>
                    <Building2 className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold">{site.name}</div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {site.status}
                    </div>
                  </div>
                </div>
              </SelectCard>
            );
          })}
        </div>
        <SheetFooter className="flex-row border-t border-border p-6">
          <Button variant="outline" size="lg" className="flex-1 rounded-xl" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="lg" className="flex-1 rounded-xl" onClick={save}>
            Save · {selected.length} site{selected.length === 1 ? "" : "s"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/** Pick which crew work on one site. */
export function AssignCrewSheet({
  siteId,
  open,
  onOpenChange,
}: {
  siteId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { crew, sites, setSiteCrew } = useLiveStore();
  const site = sites.find(s => s.id === siteId);
  const assignable = crew.filter(c => c.status !== "deactivated");
  const [selected, setSelected] = useState<string[]>(
    site ? assignable.filter(c => c.siteIds.includes(site.id)).map(c => c.id) : []
  );
  const [query, setQuery] = useState("");
  const shown = assignable.filter(c => `${c.name} ${c.jobTitle} ${c.team}`.toLowerCase().includes(query.toLowerCase()));

  const save = async () => {
    if (!site) return;
    const before = assignable.filter(c => c.siteIds.includes(site.id)).map(c => c.id);
    const added = selected.filter(id => !before.includes(id));
    const removed = before.filter(id => !selected.includes(id));
    if (!(await attempt("Updating crew", () => setSiteCrew(site.id, added, removed)))) return;
    toast.success(`Crew updated for ${site.name}`, { description: `${selected.length} people assigned.` });
    onOpenChange(false);
  };

  return (
    <Sheet open={open && !!site} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b border-border p-6">
          <SheetTitle className="text-lg font-semibold">Assign crew</SheetTitle>
          <SheetDescription>{site?.name}</SheetDescription>
          <div className="relative mt-3">
            <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <TextInput placeholder="Search by name, trade or team" className="pl-10" value={query} onChange={e => setQuery(e.target.value)} />
          </div>
        </SheetHeader>
        <div className="flex-1 space-y-2 overflow-y-auto p-6 scrollbar-thin">
          {shown.map(person => {
            const on = selected.includes(person.id);
            return (
              <SelectCard
                key={person.id}
                selected={on}
                onClick={() => setSelected(on ? selected.filter(s => s !== person.id) : [...selected, person.id])}
                className="p-3"
              >
                <div className="flex items-center gap-3 pr-8">
                  <PersonAvatar person={person} size="sm" showStatus />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">{person.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {person.jobTitle} · {person.team}
                    </div>
                  </div>
                </div>
              </SelectCard>
            );
          })}
        </div>
        <SheetFooter className="flex-row border-t border-border p-6">
          <Button variant="outline" size="lg" className="flex-1 rounded-xl" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="lg" className="flex-1 rounded-xl" onClick={save}>
            Save · {selected.length} people
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
