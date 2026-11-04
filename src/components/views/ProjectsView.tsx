"use client";

import { FolderKanban, Plus, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { ChoiceChip, Field, TextInput } from "@/components/domain/FormBits";
import { PageHeader } from "@/components/domain/PageHeader";
import { EmptyState } from "@/components/domain/Panel";
import { SiteStatusBadge } from "@/components/domain/SiteStatusBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { describeFields } from "@/lib/auditLog";
import { attempt, useLiveStore } from "@/lib/store";

import type { NewProjectInput } from "@/lib/admin";

const COLORS = ["#1c4ff0", "#0f9d58", "#a142f4", "#e2670f", "#12b5cb", "#d93025"];

export function ProjectsView() {
  const { projects, sites, projectInventory, createProject } = useLiveStore();
  const [open, setOpen] = useState(false);
  const grouped = useMemo(() => projects.map(project => ({ project, sites: sites.filter(site => site.projectId === project.id), stock: projectInventory.filter(item => item.projectId === project.id) })), [projects, sites, projectInventory]);

  return (
    <>
      <PageHeader title="Projects" description="Group sites under one job, allocate stock and track consumption across the project." actions={<Button size="lg" className="rounded-xl" onClick={() => setOpen(true)}><Plus /> Create project</Button>} />
      {grouped.length === 0 ? (
        <EmptyState icon={<FolderKanban className="size-6" />} title="No projects yet" description="Create the parent project before adding its sites and inventory." action={<Button className="rounded-xl" onClick={() => setOpen(true)}><Plus /> Create project</Button>} />
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
      <ProjectDialog open={open} onOpenChange={setOpen} onSave={createProject} count={projects.length} />
    </>
  );
}

function ProjectDialog({ open, onOpenChange, onSave, count }: { open: boolean; onOpenChange: (open: boolean) => void; onSave: (input: NewProjectInput) => Promise<string>; count: number }) {
  const [name, setName] = useState(""); const [manager, setManager] = useState(""); const [status, setStatus] = useState<NewProjectInput["status"]>("planning"); const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (name.trim().length < 3) return;
    setBusy(true);
    const result = await attempt("Creating the project", () => onSave({ name: name.trim(), manager: manager.trim(), status, color: COLORS[count % COLORS.length] }), { targetType: "project", changes: describeFields([{ label: "name", value: name.trim() }, { label: "status", value: status }]) });
    setBusy(false); if (result) onOpenChange(false);
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="rounded-2xl sm:max-w-md"><DialogTitle>Create project</DialogTitle><DialogDescription>The parent record for related sites and their stock.</DialogDescription><div className="space-y-4 pt-2"><Field label="Project name"><TextInput autoFocus value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Riverside Apartments" /></Field><Field label="Project manager"><TextInput value={manager} onChange={event => setManager(event.target.value)} placeholder="Optional" /></Field><Field label="Status"><div className="flex gap-2">{(["planning", "active"] as const).map(value => <ChoiceChip key={value} selected={status === value} onClick={() => setStatus(value)}>{value}</ChoiceChip>)}</div></Field><div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancel</Button><Button className="flex-1" onClick={submit} disabled={busy || name.trim().length < 3}>Create project</Button></div></div></DialogContent></Dialog>;
}
