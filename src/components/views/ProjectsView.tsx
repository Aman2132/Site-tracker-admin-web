"use client";

import { FolderKanban, Plus, Users } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { PageHeader } from "@/components/domain/PageHeader";
import { EmptyState } from "@/components/domain/Panel";
import { SiteStatusBadge } from "@/components/domain/SiteStatusBadge";
import { Button } from "@/components/ui/button";
import { useDialogs } from "@/components/layout/DialogsProvider";
import { useLiveStore } from "@/lib/store";

export function ProjectsView() {
  const { projects, sites, projectInventory } = useLiveStore();
  const { openCreateProject } = useDialogs();
  const grouped = useMemo(() => projects.map(project => ({ project, sites: sites.filter(site => site.projectId === project.id), stock: projectInventory.filter(item => item.projectId === project.id) })), [projects, sites, projectInventory]);

  return (
    <>
      <PageHeader title="Projects" description="Group sites under one job, allocate stock and track consumption across the project." actions={<Button size="lg" className="rounded-xl" onClick={() => openCreateProject()}><Plus /> Create project</Button>} />
      {grouped.length === 0 ? (
        <EmptyState icon={<FolderKanban className="size-6" />} title="No projects yet" description="Create the parent project before adding its sites and inventory." action={<Button className="rounded-xl" onClick={() => openCreateProject()}><Plus /> Create project</Button>} />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
          {grouped.map(({ project, sites: projectSites, stock }) => (
            <Link key={project.id} href={`/projects/${project.id}`} className="surface block rounded-2xl p-5 transition-shadow hover:shadow-lift">
              <div className="flex items-start gap-3">
                <span className="flex size-11 items-center justify-center rounded-xl text-white" style={{ backgroundColor: project.color }}><FolderKanban className="size-5" /></span>
                <div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><h2 className="truncate text-lg font-semibold">{project.name}</h2><SiteStatusBadge status={project.status} /></div><p className="mt-0.5 font-mono text-xs text-muted-foreground">{project.code}</p></div>
              </div>
              <div className="mt-5 grid grid-cols-2 divide-x rounded-xl bg-muted/60 py-3 text-center"><div><div className="font-semibold">{projectSites.length}</div><div className="text-[11px] font-semibold text-muted-foreground uppercase">Sites</div></div><div><div className="font-semibold">{stock.length}</div><div className="text-[11px] font-semibold text-muted-foreground uppercase">Stock items</div></div></div>
              <div className="mt-4 flex items-center gap-1.5 text-sm text-muted-foreground"><Users className="size-4" /> {project.manager || "No project manager set"}</div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
