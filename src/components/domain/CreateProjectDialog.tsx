"use client";

import { describeFields } from "@/lib/auditLog";
import { ArrowLeft, ArrowRight, Building2, FolderKanban, Loader2, Plus, Sparkles, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { EASE_OUT } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { NewProjectSiteInput } from "@/lib/admin";
import { projectNameProblem, siteNameProblem } from "@/lib/projectInventory";
import { attempt, useLiveStore } from "@/lib/store";
import { cn } from "@/lib/utils";

import { ChoiceChip, Field, SelectCard, TextInput } from "./FormBits";

const COLORS = ["#1c4ff0", "#0f9d58", "#a142f4", "#e2670f", "#12b5cb", "#d93025"];
const STEPS = ["Details", "Sites", "Review"] as const;

const slide = {
  enter: (dir: number) => ({ x: dir * 40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir * -40, opacity: 0 }),
};

/**
 * Creates a project and, in the same atomic write, attaches existing unassigned
 * sites and/or creates new ones. A site can belong to only one project, so sites
 * already in another project are shown but not selectable.
 */
export function CreateProjectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const { projects, sites, createProject } = useLiveStore();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const [name, setName] = useState("");
  const [manager, setManager] = useState("");
  const [status, setStatus] = useState<"planning" | "active">("planning");
  const [color, setColor] = useState(COLORS[projects.length % COLORS.length]);
  const [newSites, setNewSites] = useState<NewProjectSiteInput[]>([]);
  const [attachIds, setAttachIds] = useState<string[]>([]);
  const [draftName, setDraftName] = useState("");
  const [draftManager, setDraftManager] = useState("");
  const [draftStatus, setDraftStatus] = useState<"planning" | "active">("planning");
  const [draftError, setDraftError] = useState<string | undefined>();

  const nameError = projectNameProblem(name, projects) ?? undefined;
  const unassigned = sites.filter(s => !s.projectId);
  const taken = sites.filter(s => !!s.projectId);
  const projectName = (id?: string) => projects.find(p => p.id === id)?.name ?? "another project";

  /** Validates and queues the draft site. Returns false if it was invalid (error shown). */
  const addDraft = (): boolean => {
    const problem = siteNameProblem(draftName, sites, newSites.map(s => s.name));
    if (problem) {
      setDraftError(problem);
      return false;
    }
    setNewSites(list => [...list, { name: draftName.trim(), manager: draftManager.trim(), status: draftStatus }]);
    setDraftName("");
    setDraftManager("");
    setDraftError(undefined);
    return true;
  };

  const go = (delta: number) => {
    if (delta > 0 && step === 0 && nameError) {
      setTouched(true);
      return;
    }
    // Never lose a typed-but-not-added site: queue it, or stay and show why it can't be.
    if (delta > 0 && step === 1 && draftName.trim() && !addDraft()) return;
    setDir(delta);
    setStep(s => s + delta);
  };

  const submit = async () => {
    setBusy(true);
    const result = await attempt(
      "Creating the project",
      () =>
        createProject({
          name: name.trim(),
          manager: manager.trim(),
          status,
          color,
          existingSiteIds: attachIds,
          newSites,
        }),
      {
        targetType: "project",
        note: name.trim(),
        changes: describeFields([
          { label: "name", value: name.trim() },
          { label: "status", value: status },
          { label: "manager", value: manager.trim() },
          { label: "sites attached", value: attachIds.length },
          { label: "sites created", value: newSites.length },
        ]),
      }
    );
    setBusy(false);
    if (!result) return;
    const total = attachIds.length + newSites.length;
    toast.success(`${name.trim()} created`, {
      description: total ? `${total} site${total === 1 ? "" : "s"} added.` : "Add sites from the project page.",
      action: { label: "Open", onClick: () => router.push(`/projects/${result.value}`) },
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-[600px]">
        <div className="border-b border-border px-6 pt-6 pb-5">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-primary">
              <FolderKanban className="size-5" />
            </span>
            <div>
              <DialogTitle className="text-lg font-semibold">Create project</DialogTitle>
              <DialogDescription className="text-sm">Group sites under one job. Each site belongs to one project only.</DialogDescription>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2">
            {STEPS.map((label, i) => (
              <div key={label}>
                <div className="h-1 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className="h-full rounded-full bg-primary"
                    initial={false}
                    animate={{ width: i <= step ? "100%" : "0%" }}
                    transition={{ duration: 0.45, ease: EASE_OUT }}
                  />
                </div>
                <div className={cn("mt-1.5 text-[11px] font-semibold", i <= step ? "text-foreground" : "text-faint")}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative max-h-[60dvh] min-h-[330px] overflow-x-hidden overflow-y-auto px-6 py-6 scrollbar-thin">
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.div
              key={step}
              custom={dir}
              variants={slide}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.28, ease: EASE_OUT }}
              className="space-y-5"
            >
              {step === 0 && (
                <>
                  <Field label="Project name" htmlFor="project-name" error={touched ? nameError : undefined}>
                    <TextInput
                      id="project-name"
                      autoFocus
                      placeholder="e.g. Riverside Apartments"
                      value={name}
                      invalid={touched && !!nameError}
                      onChange={e => setName(e.target.value)}
                    />
                  </Field>
                  <Field label="Project manager (optional)" htmlFor="project-manager">
                    <TextInput id="project-manager" placeholder="Name" value={manager} onChange={e => setManager(e.target.value)} />
                  </Field>
                  <Field label="Status">
                    <div className="flex gap-2">
                      {(["planning", "active"] as const).map(s => (
                        <ChoiceChip key={s} selected={status === s} onClick={() => setStatus(s)}>
                          {s === "planning" ? "Planning" : "Active"}
                        </ChoiceChip>
                      ))}
                    </div>
                  </Field>
                  <Field label="Colour">
                    <div className="flex gap-2">
                      {COLORS.map(c => (
                        <button
                          key={c}
                          type="button"
                          aria-label={`Colour ${c}`}
                          aria-pressed={color === c}
                          onClick={() => setColor(c)}
                          className={cn("size-8 rounded-full border-2 transition-transform", color === c ? "scale-110 border-foreground" : "border-transparent")}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </Field>
                </>
              )}

              {step === 1 && (
                <>
                  <div className="space-y-3 rounded-2xl border border-border bg-muted/40 p-4">
                    <div className="text-sm font-semibold">Create a new site for this project</div>
                    <Field label="Site name" htmlFor="draft-site-name" error={draftError}>
                      <TextInput
                        id="draft-site-name"
                        placeholder="e.g. Sector 75 · Phase 2"
                        value={draftName}
                        invalid={!!draftError}
                        onChange={e => {
                          setDraftName(e.target.value);
                          setDraftError(undefined);
                        }}
                        onKeyDown={e => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addDraft();
                          }
                        }}
                      />
                    </Field>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Site manager (optional)" htmlFor="draft-site-manager">
                        <TextInput id="draft-site-manager" placeholder="Name" value={draftManager} onChange={e => setDraftManager(e.target.value)} />
                      </Field>
                      <Field label="Status">
                        <div className="flex gap-2">
                          {(["planning", "active"] as const).map(s => (
                            <ChoiceChip key={s} selected={draftStatus === s} onClick={() => setDraftStatus(s)}>
                              {s === "planning" ? "Planning" : "Active"}
                            </ChoiceChip>
                          ))}
                        </div>
                      </Field>
                    </div>
                    <Button type="button" variant="outline" className="rounded-xl" onClick={addDraft} disabled={!draftName.trim()}>
                      <Plus /> Add site
                    </Button>
                  </div>

                  {newSites.length > 0 && (
                    <ul className="space-y-2">
                      {newSites.map((s, i) => (
                        <li key={`${s.name}-${i}`} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                          <Building2 className="size-4 text-muted-foreground" />
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{s.name}</span>
                          <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">New</span>
                          <button
                            type="button"
                            aria-label={`Remove ${s.name}`}
                            className="text-muted-foreground hover:text-danger"
                            onClick={() => setNewSites(list => list.filter((_, idx) => idx !== i))}
                          >
                            <X className="size-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="space-y-2">
                    <div className="text-sm font-semibold">
                      Attach existing sites{attachIds.length ? ` · ${attachIds.length} selected` : ""}
                    </div>
                    {unassigned.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No unassigned sites available.</p>
                    ) : (
                      <div className="grid gap-2">
                        {unassigned.map(site => (
                          <SelectCard
                            key={site.id}
                            selected={attachIds.includes(site.id)}
                            onClick={() => setAttachIds(ids => (ids.includes(site.id) ? ids.filter(x => x !== site.id) : [...ids, site.id]))}
                            className="p-3"
                          >
                            <div className="pr-8">
                              <div className="truncate text-sm font-bold">{site.name}</div>
                              <div className="truncate text-xs text-muted-foreground">{site.code}</div>
                            </div>
                          </SelectCard>
                        ))}
                      </div>
                    )}
                  </div>

                  {taken.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-sm font-semibold text-muted-foreground">Already in another project</div>
                      <ul className="space-y-1.5 opacity-60">
                        {taken.map(site => (
                          <li key={site.id} className="flex items-center gap-2 rounded-xl border border-dashed border-border p-2.5 text-sm">
                            <span className="min-w-0 flex-1 truncate">{site.name}</span>
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold">{projectName(site.projectId)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 rounded-2xl border border-border bg-muted/50 p-4">
                    <span className="flex size-11 items-center justify-center rounded-xl text-white" style={{ backgroundColor: color }}>
                      <FolderKanban className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-lg font-semibold">{name.trim()}</div>
                      <div className="truncate text-sm text-muted-foreground">
                        {status === "planning" ? "Planning" : "Active"} · {manager.trim() || "No project manager"}
                      </div>
                    </div>
                  </div>
                  <dl className="grid grid-cols-[130px_1fr] gap-x-4 gap-y-2.5 text-sm">
                    <dt className="text-muted-foreground">New sites</dt>
                    <dd className="flex flex-wrap gap-1.5">
                      {newSites.length === 0 && <span className="text-muted-foreground">None</span>}
                      {newSites.map((s, i) => (
                        <span key={i} className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">{s.name}</span>
                      ))}
                    </dd>
                    <dt className="text-muted-foreground">Attached sites</dt>
                    <dd className="flex flex-wrap gap-1.5">
                      {attachIds.length === 0 && <span className="text-muted-foreground">None</span>}
                      {attachIds.map(id => (
                        <span key={id} className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">
                          {sites.find(s => s.id === id)?.name}
                        </span>
                      ))}
                    </dd>
                  </dl>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/40 px-6 py-4">
          <Button variant="ghost" size="lg" className="rounded-xl" onClick={() => (step === 0 ? onOpenChange(false) : go(-1))}>
            {step === 0 ? "Cancel" : (
              <>
                <ArrowLeft /> Back
              </>
            )}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button size="lg" className="rounded-xl px-4 shadow-glow" onClick={() => go(1)}>
              Continue <ArrowRight />
            </Button>
          ) : (
            <Button size="lg" className="rounded-xl px-4 shadow-glow" onClick={submit} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Sparkles />} Create project
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

