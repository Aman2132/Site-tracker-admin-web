"use client";

import { AlertTriangle, FolderKanban, Plus, Search, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { TextInput } from "@/components/domain/FormBits";
import { PageHeader } from "@/components/domain/PageHeader";
import { EmptyState } from "@/components/domain/Panel";
import { SegmentedControl } from "@/components/domain/SegmentedControl";
import { SiteStatusBadge } from "@/components/domain/SiteStatusBadge";
import { Button } from "@/components/ui/button";
import { useDialogs } from "@/components/layout/DialogsProvider";
import { availableToAllocate, getStockAlert } from "@/lib/projectInventory";
import { useLiveStore } from "@/lib/store";
import type { SiteStatus } from "@/types/domain";

type Filter = "all" | SiteStatus;

export function ProjectsView() {
  const { projects, sites, projectInventory } = useLiveStore();
  const { openCreateProject } = useDialogs();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const grouped = useMemo(
    () =>
      projects.map(project => {
        const projectSites = sites.filter(site => site.projectId === project.id);
        const stock = projectInventory.filter(item => item.projectId === project.id);
        const lowStockCount = stock.filter(item => getStockAlert(item.quantity, availableToAllocate(item)).level !== "ok").length;
        return {
          project,
          sites: projectSites,
          stock,
          lowStockCount,
        };
      }),
    [projects, sites, projectInventory]
  );

  const count = (status: Filter) =>
    status === "all" ? projects.length : projects.filter(p => p.status === status).length;

  const matches = (item: (typeof grouped)[number]) => {
    const p = item.project;
    const matchesFilter = filter === "all" || p.status === filter;
    const matchesQuery = `${p.name} ${p.code} ${p.manager}`.toLowerCase().includes(query.trim().toLowerCase());
    return matchesFilter && matchesQuery;
  };

  const filtered = grouped.filter(matches);

  return (
    <>
      <PageHeader
        title="Projects"
        description="Group sites under one job, allocate stock and track consumption across the project."
        actions={
          <Button size="lg" className="rounded-xl px-4 shadow-glow" onClick={() => openCreateProject()}>
            <Plus /> Create project
          </Button>
        }
      />

      {/* Filter and Search Bar */}
      <div className="surface mb-5 flex flex-col gap-3 rounded-2xl p-3 md:flex-row md:items-center">
        <div className="overflow-x-auto scrollbar-thin">
          <SegmentedControl
            value={filter}
            onChange={setFilter}
            options={(["all", "active", "planning", "paused", "completed"] as const).map(v => ({
              value: v,
              label: v === "all" ? "All" : v[0].toUpperCase() + v.slice(1),
              count: count(v),
            }))}
          />
        </div>
        <div className="flex flex-1 items-center gap-2 md:justify-end">
          <div className="relative flex-1 md:max-w-72">
            <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <TextInput
              placeholder="Search projects…"
              className="h-10 pl-10"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {grouped.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="size-6" />}
          title="No projects yet"
          description="Create the parent project before adding its sites and inventory."
          action={
            <Button className="rounded-xl" onClick={() => openCreateProject()}>
              <Plus /> Create project
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="size-6" />}
          title="No matching projects"
          description="Try selecting another status tab or changing your search terms."
          action={
            <Button variant="outline" className="rounded-xl" onClick={() => { setFilter("all"); setQuery(""); }}>
              Reset filters
            </Button>
          }
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
          {filtered.map(({ project, sites: projectSites, stock, lowStockCount }) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="surface block rounded-2xl p-5 transition-shadow hover:shadow-lift"
            >
              <div className="flex items-start gap-3">
                <span
                  className="flex size-11 items-center justify-center rounded-xl text-white shadow-lift"
                  style={{ backgroundColor: project.color }}
                >
                  <FolderKanban className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="truncate text-lg font-semibold">{project.name}</h2>
                    <SiteStatusBadge status={project.status} />
                  </div>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">{project.code}</p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 divide-x rounded-xl bg-muted/60 py-3 text-center">
                <div>
                  <div className="font-semibold">{projectSites.length}</div>
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase">Sites</div>
                </div>
                <div>
                  <div className="font-semibold">{stock.length}</div>
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase">Stock items</div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5 truncate">
                  <Users className="size-4 shrink-0" />
                  <span className="truncate">{project.manager || "No project manager set"}</span>
                </span>
                {lowStockCount > 0 && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-warning/30 bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning-foreground">
                    <AlertTriangle className="size-3" /> {lowStockCount} low stock
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
