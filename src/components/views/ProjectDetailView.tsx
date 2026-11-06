"use client";

import { AlertTriangle, ArrowLeft, Boxes, Building2, ChevronDown, Loader2, PackagePlus, Plus, Trash2, Warehouse, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { useAdmin } from "@/components/auth/AuthProvider";
import { DeleteProjectDialog } from "@/components/domain/DeleteProjectDialog";
import { SiteStatusBadge } from "@/components/domain/SiteStatusBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { describeChanges } from "@/lib/auditLog";
import type { SiteStatus } from "@/types/domain";
import { ChoiceChip, Field, TextInput } from "@/components/domain/FormBits";
import { EmptyState, Panel } from "@/components/domain/Panel";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useDialogs } from "@/components/layout/DialogsProvider";
import { formatDateTime } from "@/lib/format";
import { formatQuantity } from "@/lib/inventory";
import { availableAtSite, availableToAllocate, getStockAlert } from "@/lib/projectInventory";
import { attempt, useLiveStore } from "@/lib/store";

export function ProjectDetailView({ id }: { id: string }) {
  const router = useRouter();
  const admin = useAdmin();
  const { openCreateSite } = useDialogs();
  const {
    projects,
    sites,
    setSiteProject,
    setProjectStatus,
    projectInventory,
    siteInventory,
    inventoryUsage,
    photos,
    sessions,
    roster: crew,
    addProjectStock,
    allocateProjectStock,
    recordInventoryUsage,
    deleteProject,
  } = useLiveStore();

  const project = projects.find(value => value.id === id);
  const [attachOpen, setAttachOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const [allocationOpen, setAllocationOpen] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [siteToRemove, setSiteToRemove] = useState<(typeof sites)[number] | null>(null);
  const [removingSite, setRemovingSite] = useState(false);

  const projectSites = useMemo(() => sites.filter(site => site.projectId === id), [sites, id]);
  const items = useMemo(() => projectInventory.filter(item => item.projectId === id), [projectInventory, id]);
  const allocations = useMemo(() => siteInventory.filter(item => item.projectId === id), [siteInventory, id]);
  const usage = useMemo(() => inventoryUsage.filter(item => item.projectId === id), [inventoryUsage, id]);

  if (!project) {
    return (
      <EmptyState
        icon={<Warehouse className="size-6" />}
        title="Project not found"
        description="It may have been removed or the link is incorrect."
        action={
          <Link href="/projects">
            <Button variant="outline">Back to projects</Button>
          </Link>
        }
      />
    );
  }

  const siteName = (siteId: string) => projectSites.find(site => site.id === siteId)?.name ?? "Unknown site";

  const onConfirmDelete = async (deleteSites: boolean) => {
    setDeleting(true);
    const result = await attempt(
      deleteSites ? "Deleting project and sites" : "Deleting project",
      () => deleteProject(project.id, deleteSites),
      {
        targetType: "project",
        targetId: project.id,
        note: `${project.name} (${deleteSites ? `cascaded to ${projectSites.length} sites` : "sites detached"})`,
      }
    );
    setDeleting(false);
    if (!result) return;
    setConfirmingDelete(false);
    toast.success(`${project.name} deleted`, {
      description: deleteSites
        ? `Project and ${projectSites.length} site(s) were permanently deleted.`
        : `Project deleted. ${projectSites.length} site(s) are now independent.`,
    });
    router.push("/projects");
  };

  return (
    <>
      <Link
        href="/projects"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All projects
      </Link>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-center gap-4">
          <span
            className="flex size-14 items-center justify-center rounded-2xl text-white"
            style={{ backgroundColor: project.color }}
          >
            <Warehouse className="size-7" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-3xl font-semibold tracking-tight">{project.name}</h1>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      aria-label="Change project status"
                    />
                  }
                >
                  <SiteStatusBadge status={project.status} /> <ChevronDown className="size-3.5 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-44">
                  <DropdownMenuRadioGroup
                    value={project.status}
                    onValueChange={v =>
                      attempt("Updating project status", () => setProjectStatus(project.id, v as SiteStatus), {
                        targetType: "project",
                        targetId: project.id,
                        changes: describeChanges([{ label: "status", before: project.status, after: String(v) }]),
                      })
                    }
                  >
                    {(["planning", "active", "paused", "completed"] as const).map(status => (
                      <DropdownMenuRadioItem key={status} value={status} className="capitalize">
                        {status}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {projectSites.length} sites · {project.manager || "No project manager"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setStockOpen(true)}>
            <PackagePlus /> Add project stock
          </Button>
          <Button
            variant="outline"
            onClick={() => setAllocationOpen(true)}
            disabled={!items.length || !projectSites.length}
          >
            <Boxes /> Allocate to site
          </Button>
          <Button onClick={() => setUsageOpen(true)} disabled={!allocations.some(item => availableAtSite(item) > 0)}>
            <Plus /> Record usage
          </Button>
          <Button
            variant="outline"
            className="rounded-xl bg-card text-danger hover:bg-danger/10 hover:text-danger"
            onClick={() => setConfirmingDelete(true)}
          >
            <Trash2 className="size-4" /> Delete project
          </Button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel
          title="Project stock"
          description="Stock is available to the crew only after it is allocated to a site."
        >
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No stock has been added yet.</p>
          ) : (
            <ul className="divide-y">
              {items.map(item => {
                const available = availableToAllocate(item);
                const alert = getStockAlert(item.quantity, available);
                return (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{item.name}</span>
                        {alert.level === "out" && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-danger/30 bg-danger-soft px-2 py-0.5 text-[11px] font-bold text-danger">
                            <AlertTriangle className="size-3" /> Fully allocated
                          </span>
                        )}
                        {(alert.level === "critical" || alert.level === "low") && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning-soft px-2 py-0.5 text-[11px] font-bold text-warning-foreground">
                            <AlertTriangle className="size-3" /> {alert.label}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatQuantity(available)} {item.unit} unallocated ·{" "}
                        {formatQuantity(item.usedQuantity)} used
                      </div>
                    </div>
                    <div className="text-right font-semibold">
                      {formatQuantity(item.quantity)}{" "}
                      <span className="font-normal text-muted-foreground">{item.unit}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel
          title="Site allocations"
          description="Crew can select only these items at their current site."
        >
          {allocations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Allocate project stock to a site to make it available there.</p>
          ) : (
            <ul className="divide-y">
              {allocations.map(item => {
                const left = availableAtSite(item);
                const alert = getStockAlert(item.quantity, left);
                return (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{item.name}</span>
                        {alert.level === "out" && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-danger/30 bg-danger-soft px-2 py-0.5 text-[11px] font-bold text-danger">
                            <AlertTriangle className="size-3" /> Depleted
                          </span>
                        )}
                        {(alert.level === "critical" || alert.level === "low") && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning-soft px-2 py-0.5 text-[11px] font-bold text-warning-foreground">
                            <AlertTriangle className="size-3" /> {alert.label}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">{siteName(item.siteId)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">
                        {formatQuantity(left)} {item.unit} left
                      </div>
                      <div className="text-xs text-muted-foreground">of {formatQuantity(item.quantity)}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel
          title="Usage history"
          description="Every consumption record is retained with its actor, site and proof photos."
          bodyClassName="p-0"
        >
          <ul className="divide-y">
            {usage.length === 0 ? (
              <li className="p-5 text-sm text-muted-foreground">No usage recorded yet.</li>
            ) : (
              usage.map(entry => (
                <li key={entry.id} className="p-4">
                  <div className="flex justify-between gap-3">
                    <div>
                      <div className="font-semibold">
                        −{formatQuantity(entry.quantity)} {entry.unit} · {entry.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {siteName(entry.siteId)} · {entry.actorName || "Unknown"} ({entry.actorRole}) ·{" "}
                        {formatDateTime(entry.at)}
                      </div>
                      {entry.note && <p className="mt-1 text-sm text-muted-foreground">{entry.note}</p>}
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                      {entry.proofPhotoIds.length} photo{entry.proofPhotoIds.length === 1 ? "" : "s"}
                    </span>
                  </div>
                </li>
              ))
            )}
          </ul>
        </Panel>

        <Panel
          title="Sites"
          description="Sites under this project."
          action={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => openCreateSite(id)}>
                <Plus /> Create site
              </Button>
              <Button variant="outline" size="sm" onClick={() => setAttachOpen(true)}>
                Attach existing
              </Button>
            </div>
          }
        >
          {projectSites.length === 0 ? (
            <p className="text-sm text-muted-foreground">Create a site and select this project.</p>
          ) : (
            <ul className="divide-y">
              {projectSites.map(site => {
                const siteAllocations = allocations.filter(a => a.siteId === site.id);
                const hasAllocations = siteAllocations.length > 0;

                return (
                  <li key={site.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <Link href={`/sites/${site.id}`} className="font-semibold hover:text-primary">
                        {site.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {site.code} · {site.manager || "No manager"}
                        {hasAllocations && (
                          <span className="ml-2 inline-flex items-center gap-1 font-medium text-warning">
                            <Boxes className="size-3" /> {siteAllocations.length} stock item(s)
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-lg text-muted-foreground hover:bg-muted hover:text-danger"
                      title={`Remove ${site.name} from this project`}
                      onClick={() => setSiteToRemove(site)}
                    >
                      <X className="size-3.5" /> Remove
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <Dialog open={attachOpen} onOpenChange={setAttachOpen}>
        <DialogContent>
          <DialogTitle>Attach unassigned site</DialogTitle>
          <DialogDescription>
            Only sites that are not in a project can be attached; a site belongs to one project.
          </DialogDescription>
          <div className="space-y-2 pt-2">
            {sites.filter(site => !site.projectId).length === 0 ? (
              <p className="text-sm text-muted-foreground">No unassigned sites available.</p>
            ) : (
              sites
                .filter(site => !site.projectId)
                .map(site => (
                  <Button
                    key={site.id}
                    variant="outline"
                    className="w-full justify-start"
                    onClick={async () => {
                      const result = await attempt(
                        "Attaching site",
                        () => setSiteProject(site.id, id),
                        { targetType: "site", targetId: site.id, note: site.name }
                      );
                      if (result) setAttachOpen(false);
                    }}
                  >
                    {site.name}
                  </Button>
                ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <StockDialog open={stockOpen} onOpenChange={setStockOpen} projectId={id} onSave={addProjectStock} />
      <AllocationDialog
        open={allocationOpen}
        onOpenChange={setAllocationOpen}
        sites={projectSites}
        items={items}
        onSave={allocateProjectStock}
      />
      <UsageDialog
        open={usageOpen}
        onOpenChange={setUsageOpen}
        allocations={allocations}
        photos={photos.filter(photo => projectSites.some(site => site.id === photo.siteId))}
        actor={{ id: admin.uid, name: admin.profile.name, role: "admin" }}
        onSave={recordInventoryUsage}
      />

      <Dialog open={siteToRemove != null} onOpenChange={open => !open && !removingSite && setSiteToRemove(null)}>
        <DialogContent className="sm:max-w-md">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
              <Building2 className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg font-semibold">
                Remove {siteToRemove?.name} from project?
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-muted-foreground">
                The site will become an independent unassigned site. None of its photos, check-in history, or crew assignments will be deleted.
              </DialogDescription>
            </div>
          </div>

          {siteToRemove && allocations.filter(a => a.siteId === siteToRemove.id).length > 0 && (
            <div className="flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning-soft p-3 text-xs text-warning-foreground font-semibold">
              <Boxes className="size-4 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">Active project material allocations</div>
                <div className="mt-0.5 font-normal opacity-90">
                  This site has {allocations.filter(a => a.siteId === siteToRemove.id).length} active project stock allocation(s). Please move or clear those allocations before removing it from this project.
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1 rounded-xl"
              onClick={() => setSiteToRemove(null)}
              disabled={removingSite}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1 rounded-xl shadow-glow"
              disabled={
                removingSite ||
                (siteToRemove != null && allocations.some(a => a.siteId === siteToRemove.id))
              }
              onClick={async () => {
                if (!siteToRemove) return;
                setRemovingSite(true);
                const target = siteToRemove;
                const result = await attempt(
                  "Removing site from project",
                  () => setSiteProject(target.id, undefined),
                  {
                    targetType: "site",
                    targetId: target.id,
                    note: `${target.name} removed from ${project.name}`,
                  }
                );
                setRemovingSite(false);
                if (result) {
                  setSiteToRemove(null);
                  toast.success(`${target.name} removed from project`, {
                    description: `${target.name} is now an unassigned independent site.`,
                  });
                }
              }}
            >
              {removingSite ? <Loader2 className="animate-spin size-4" /> : <X className="size-4" />}
              Remove from project
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteProjectDialog
        open={confirmingDelete}
        project={project}
        projectSites={projectSites}
        items={items}
        allocations={allocations}
        sessions={sessions}
        photos={photos}
        crew={crew}
        busy={deleting}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={onConfirmDelete}
      />
    </>
  );
}

function StockDialog({
  open,
  onOpenChange,
  projectId,
  onSave,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  projectId: string;
  onSave: (input: { projectId: string; name: string; unit: string; quantity: number; note?: string }) => Promise<string>;
}) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const save = async () => {
    const value = Number(quantity);
    const result = await attempt("Adding project stock", () => onSave({ projectId, name, unit, quantity: value, note }), {});
    if (result) onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Add project stock</DialogTitle>
        <DialogDescription>
          Stock starts at project level and must be allocated before a site can use it.
        </DialogDescription>
        <div className="space-y-4 pt-2">
          <Field label="Item">
            <TextInput value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Cement" />
          </Field>
          <Field label="Unit">
            <TextInput value={unit} onChange={event => setUnit(event.target.value)} />
          </Field>
          <Field label="Quantity">
            <TextInput inputMode="decimal" value={quantity} onChange={event => setQuantity(event.target.value)} />
          </Field>
          <Field label="Description / source">
            <Textarea value={note} onChange={event => setNote(event.target.value)} />
          </Field>
          <Button className="w-full" disabled={!name.trim() || !(Number(quantity) > 0)} onClick={save}>
            Add stock
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AllocationDialog({
  open,
  onOpenChange,
  sites,
  items,
  onSave,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  sites: { id: string; name: string }[];
  items: { id: string; name: string; unit: string; quantity: number; allocatedQuantity: number }[];
  onSave: (input: { projectItemId: string; siteId: string; quantity: number }) => Promise<string>;
}) {
  const [itemId, setItemId] = useState(items[0]?.id ?? "");
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [quantity, setQuantity] = useState("");
  const item = items.find(value => value.id === itemId);
  const save = async () => {
    const result = await attempt("Allocating stock", () => onSave({ projectItemId: itemId, siteId, quantity: Number(quantity) }), {});
    if (result) onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Allocate stock to a site</DialogTitle>
        <DialogDescription>The allocation is the maximum the crew can consume at that site.</DialogDescription>
        <div className="space-y-4 pt-2">
          <Field label="Project item">
            <div className="flex flex-wrap gap-2">
              {items.map(value => (
                <ChoiceChip key={value.id} selected={itemId === value.id} onClick={() => setItemId(value.id)}>
                  {value.name} · {formatQuantity(availableToAllocate(value))} {value.unit} free
                </ChoiceChip>
              ))}
            </div>
          </Field>
          <Field label="Site">
            <div className="flex flex-wrap gap-2">
              {sites.map(value => (
                <ChoiceChip key={value.id} selected={siteId === value.id} onClick={() => setSiteId(value.id)}>
                  {value.name}
                </ChoiceChip>
              ))}
            </div>
          </Field>
          <Field label={`Quantity${item ? ` (${item.unit})` : ""}`}>
            <TextInput inputMode="decimal" value={quantity} onChange={event => setQuantity(event.target.value)} />
          </Field>
          <Button className="w-full" disabled={!itemId || !siteId || !(Number(quantity) > 0)} onClick={save}>
            Allocate
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function UsageDialog({
  open,
  onOpenChange,
  allocations,
  photos,
  actor,
  onSave,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  allocations: { id: string; name: string; unit: string; siteId: string; quantity: number; usedQuantity: number }[];
  photos: { id: string; task: string; siteId: string }[];
  actor: { id: string; name: string; role: "admin" };
  onSave: (
    input: { allocationId: string; quantity: number; note?: string; proofPhotoIds?: string[] },
    actor: { id: string; name: string; role: "admin" }
  ) => Promise<string>;
}) {
  const [allocationId, setAllocationId] = useState(allocations[0]?.id ?? "");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [proof, setProof] = useState<string[]>([]);
  const allocation = allocations.find(value => value.id === allocationId);
  const save = async () => {
    const result = await attempt(
      "Recording inventory usage",
      () => onSave({ allocationId, quantity: Number(quantity), note, proofPhotoIds: proof }, actor),
      {}
    );
    if (result) onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogTitle>Record usage</DialogTitle>
        <DialogDescription>Usage is blocked if it exceeds this site&apos;s remaining allocation.</DialogDescription>
        <div className="space-y-4 pt-2">
          <Field label="Allocated site item">
            <div className="flex flex-wrap gap-2">
              {allocations
                .filter(value => availableAtSite(value) > 0)
                .map(value => (
                  <ChoiceChip key={value.id} selected={allocationId === value.id} onClick={() => setAllocationId(value.id)}>
                    {value.name} · {formatQuantity(availableAtSite(value))} {value.unit} left
                  </ChoiceChip>
                ))}
            </div>
          </Field>
          <Field label={`Used now${allocation ? ` (${allocation.unit})` : ""}`}>
            <TextInput inputMode="decimal" value={quantity} onChange={event => setQuantity(event.target.value)} />
          </Field>
          <Field label="Description">
            <Textarea value={note} onChange={event => setNote(event.target.value)} placeholder="What was used and why?" />
          </Field>
          <Field label="Proof photos" hint="Choose photos already uploaded for this project's sites.">
            <div className="space-y-2">
              {photos.length ? (
                photos.slice(0, 12).map(photo => (
                  <label key={photo.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={proof.includes(photo.id)}
                      onCheckedChange={checked =>
                        setProof(previous => (checked ? [...previous, photo.id] : previous.filter(id => id !== photo.id)))
                      }
                    />{" "}
                    {photo.task || "Site photo"}
                  </label>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No site photos available yet.</p>
              )}
            </div>
          </Field>
          <Button className="w-full" disabled={!allocationId || !(Number(quantity) > 0)} onClick={save}>
            Record usage
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
