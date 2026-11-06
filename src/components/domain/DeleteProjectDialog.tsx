"use client";

import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Project, ProjectInventoryItem, Site, SiteInventoryAllocation, SitePhoto, PresenceSession, CrewMember } from "@/types/domain";
import { isOnShift } from "@/lib/insights";

interface DeleteProjectDialogProps {
  open: boolean;
  project: Project;
  projectSites: Site[];
  items: ProjectInventoryItem[];
  allocations: SiteInventoryAllocation[];
  sessions: PresenceSession[];
  photos: SitePhoto[];
  crew: CrewMember[];
  busy: boolean;
  onCancel: () => void;
  onConfirm: (deleteSites: boolean) => Promise<void>;
}

export function DeleteProjectDialog({
  open,
  project,
  projectSites,
  items,
  allocations,
  sessions,
  photos,
  crew,
  busy,
  onCancel,
  onConfirm,
}: DeleteProjectDialogProps) {
  const [deleteSites, setDeleteSites] = useState(false);
  const [typed, setTyped] = useState("");

  const matches = typed.trim().toLowerCase() === project.name.trim().toLowerCase();

  // Aggregate stats across all attached sites
  const siteIds = new Set(projectSites.map(s => s.id));
  const attachedPhotosCount = photos.filter(p => siteIds.has(p.siteId)).length;
  const attachedSessionsCount = sessions.filter(s => siteIds.has(s.siteId)).length;
  const activeWorkers = crew.filter(c => isOnShift(c) && c.currentSiteId && siteIds.has(c.currentSiteId));

  const handleConfirm = async () => {
    if (!matches || busy) return;
    await onConfirm(deleteSites);
  };

  return (
    <Dialog open={open} onOpenChange={next => !next && !busy && onCancel()}>
      <DialogContent className="gap-0 rounded-2xl p-0 sm:max-w-[540px]">
        <div className="space-y-4 p-6">
          {/* Header */}
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-danger-soft text-danger">
              <Trash2 className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg font-semibold tracking-tight">
                Delete {project.name}?
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-muted-foreground">
                This will permanently delete the project. Choose how to handle its attached sites.
              </DialogDescription>
            </div>
          </div>

          {/* Site handling option */}
          {projectSites.length > 0 ? (
            <div className="space-y-2 rounded-xl border border-border bg-card p-3.5">
              <label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Attached Sites ({projectSites.length})
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setDeleteSites(false)}
                  className={cn(
                    "flex flex-col items-start rounded-xl border p-3 text-left transition-all",
                    !deleteSites
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "border-border hover:border-primary/40"
                  )}
                >
                  <span className="text-xs font-bold text-foreground">Keep sites independent</span>
                  <span className="mt-1 text-[11px] text-muted-foreground">
                    Remove {projectSites.length} site{projectSites.length === 1 ? "" : "s"} from project. They remain as standalone unassigned sites with all history intact.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setDeleteSites(true)}
                  className={cn(
                    "flex flex-col items-start rounded-xl border p-3 text-left transition-all",
                    deleteSites
                      ? "border-danger bg-danger/5 ring-2 ring-danger/20"
                      : "border-border hover:border-danger/40"
                  )}
                >
                  <span className="text-xs font-bold text-danger">Delete sites too</span>
                  <span className="mt-1 text-[11px] text-muted-foreground">
                    Cascade delete all {projectSites.length} attached site{projectSites.length === 1 ? "" : "s"} and all their contents.
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              This project has no attached sites. Only project stock items and allocations will be deleted.
            </div>
          )}

          {/* Active warnings and deletion details */}
          <div className="space-y-2.5 rounded-xl bg-muted/60 p-3.5 text-xs text-muted-foreground">
            {deleteSites && activeWorkers.length > 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-soft p-2.5 text-danger font-semibold">
                <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Active crew on shift: {activeWorkers.length}</div>
                  <div className="font-normal opacity-90">
                    {activeWorkers.map(c => c.name.split(" ")[0]).join(", ")} will be disconnected from their working sites immediately.
                  </div>
                </div>
              </div>
            )}

            {deleteSites ? (
              <div className="space-y-1.5">
                <div className="font-semibold text-danger">
                  The following data across {projectSites.length} site{projectSites.length === 1 ? "" : "s"} will be permanently destroyed:
                </div>
                <ul className="list-disc pl-4 space-y-1">
                  <li>
                    <b>{attachedPhotosCount} geotagged site photos</b> (image files will be deleted from cloud storage)
                  </li>
                  <li>
                    <b>{attachedSessionsCount} attendance check-ins & work sessions</b>
                  </li>
                  <li>
                    <b>{items.length} project stock items & {allocations.length} allocations</b>
                  </li>
                  <li>
                    <b>Sites:</b> {projectSites.map(s => s.name).join(", ")}
                  </li>
                </ul>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="font-semibold text-foreground">
                  What happens upon deletion:
                </div>
                <ul className="list-disc pl-4 space-y-1">
                  <li>
                    {projectSites.length > 0 ? (
                      <>
                        <b>{projectSites.length} site{projectSites.length === 1 ? "" : "s"}</b> ({projectSites.map(s => s.name).join(", ")}) will be <b>kept safe</b> and unassigned from this project.
                      </>
                    ) : (
                      "No sites are attached to this project."
                    )}
                  </li>
                  <li>
                    <b>{items.length} project stock items & {allocations.length} allocations</b> will be wiped.
                  </li>
                  <li>
                    Historical records for detached sites remain available under their respective site pages.
                  </li>
                </ul>
              </div>
            )}
          </div>

          {/* Confirmation input */}
          <div className="space-y-1.5">
            <label htmlFor="delete-project-confirm" className="text-xs font-medium">
              Type <b>{project.name}</b> to confirm deletion
            </label>
            <Input
              id="delete-project-confirm"
              value={typed}
              onChange={e => setTyped(e.target.value)}
              placeholder={project.name}
              autoComplete="off"
              disabled={busy}
              className="h-10 text-sm"
            />
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" size="lg" className="flex-1 rounded-xl" onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="lg"
              className="flex-1 rounded-xl shadow-glow"
              onClick={handleConfirm}
              disabled={busy || !matches}
            >
              {busy ? <Loader2 className="animate-spin" /> : <Trash2 />}
              {deleteSites ? "Delete project & sites" : "Delete project"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

