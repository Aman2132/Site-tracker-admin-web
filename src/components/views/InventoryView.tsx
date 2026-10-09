"use client";

import { Building2, Camera, Download, Package, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { DeletableLightbox } from "@/components/domain/DeletableLightbox";
import { InventoryEntryDialog } from "@/components/domain/InventoryEntryDialog";
import { TextInput } from "@/components/domain/FormBits";
import { PageHeader } from "@/components/domain/PageHeader";
import { PersonAvatar } from "@/components/domain/PersonAvatar";
import { EmptyState, Panel } from "@/components/domain/Panel";
import { SegmentedControl } from "@/components/domain/SegmentedControl";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { firebase } from "@/lib/firebase";
import { formatDateTime, formatDay } from "@/lib/format";
import { formatPack, formatQuantity, isUsedUp, itemKey, remaining, toCsv, totalsByItem } from "@/lib/inventory";
import { attempt, useLiveStore, useLookups, useNow } from "@/lib/store";
import { DAY, dayStart } from "@/lib/time";

import type { InventoryChanges, InventoryEntry, SitePhoto } from "@/types/domain";

type Range = "today" | "7d" | "30d" | "all";

const RANGES: { value: Range; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "all", label: "All" },
];

function rangeStart(range: Range, now: number): number {
  const today = dayStart(now);
  if (range === "today") return today;
  if (range === "7d") return today - 6 * DAY;
  if (range === "30d") return today - 29 * DAY;
  return 0;
}

function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: filename });
  link.click();
  URL.revokeObjectURL(url);
}

/** What the crew logged as received at each site: totals per item, and every delivery (editable). */
export function InventoryView() {
  const { inventory, photos, sites, addInventoryEntry, updateInventoryEntry, deleteInventoryEntry } = useLiveStore();
  const { siteById, personById } = useLookups();
  const now = useNow();
  const [site, setSite] = useState("all");
  const [range, setRange] = useState<Range>("30d");
  const [query, setQuery] = useState("");
  /** undefined = dialog closed, null = adding, entry = correcting it. */
  const [editing, setEditing] = useState<InventoryEntry | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<InventoryEntry | null>(null);
  const [busy, setBusy] = useState(false);
  /** Proof photos open in the viewer: the entry's photos + which one is shown. */
  const [proof, setProof] = useState<{ photos: SitePhoto[]; openId: string } | null>(null);

  /** Photos the crew attached as proof, by inventory entry id. */
  const proofByEntry = useMemo(() => {
    const map = new Map<string, SitePhoto[]>();
    for (const photo of photos) {
      if (photo.inventoryId) map.set(photo.inventoryId, [...(map.get(photo.inventoryId) ?? []), photo]);
    }
    return map;
  }, [photos]);

  const filtered = useMemo(() => {
    const from = rangeStart(range, now);
    const q = query.trim().toLowerCase();
    return inventory.filter(
      e =>
        (site === "all" || e.siteId === site) &&
        e.receivedAt >= from &&
        (!q || [e.name, e.personName, e.note ?? "", e.unit].some(text => text.toLowerCase().includes(q)))
    );
  }, [inventory, site, range, query, now]);

  const totals = useMemo(() => totalsByItem(filtered), [filtered]);
  const siteName = (id: string) => siteById.get(id)?.name ?? "Unknown site";

  const save = async (changes: InventoryChanges, reason: string) => {
    const target = editing;
    const myName = personById.get(firebase().auth.currentUser?.uid ?? "")?.name ?? "Admin";
    // The label is also the audit-trail line the superadmin reads, so it says what changed.
    const label = target
      ? `Corrected inventory "${target.name}" at ${siteName(target.siteId)}: ` +
        `${formatQuantity(target.quantity)} ${target.unit} → ${formatQuantity(changes.quantity)} ${changes.unit}, ` +
        `used ${formatQuantity(target.usedQuantity)} → ${formatQuantity(changes.usedQuantity ?? target.usedQuantity)}`
      : `Added inventory "${changes.name}" ${formatQuantity(changes.quantity)} ${changes.unit} at ${siteName(changes.siteId)}`;
    const outcome = await attempt(
      label,
      () => (target ? updateInventoryEntry(target.id, changes) : addInventoryEntry(changes, myName)),
      { targetType: "inventory", targetId: target?.id, note: reason }
    );
    if (outcome) toast.success(target ? "Entry corrected" : "Item added");
    return outcome != null;
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    const outcome = await attempt(
      `Deleted inventory "${deleting.name}" ${formatQuantity(deleting.quantity)} ${deleting.unit} at ${siteName(deleting.siteId)} (logged by ${deleting.personName || "crew"})`,
      () => deleteInventoryEntry(deleting.id),
      { targetType: "inventory", targetId: deleting.id }
    );
    setBusy(false);
    if (outcome) toast.success("Entry deleted");
    setDeleting(null);
  };

  const exportCsv = () => {
    const rows = filtered.map(e => [
      formatDateTime(e.receivedAt),
      siteName(e.siteId),
      e.name,
      formatQuantity(e.quantity),
      e.unit,
      formatQuantity(e.usedQuantity),
      formatQuantity(remaining(e)),
      e.personName,
      e.note ?? "",
      e.editedAt ? `Corrected ${formatDateTime(e.editedAt)}` : "",
    ]);
    download(
      `inventory-${new Date(now).toISOString().slice(0, 10)}.csv`,
      toCsv(["Received", "Site", "Item", "Quantity", "Unit", "Used", "Left", "Logged by", "Note", "Edited"], rows)
    );
  };

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Everything the crew logged as received on site. Totals add up per item and unit; correct or remove any entry."
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" size="lg" className="bg-card" />}>
                <Building2 /> {site === "all" ? "All sites" : siteName(site)}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuRadioGroup value={site} onValueChange={v => setSite(String(v))}>
                  <DropdownMenuRadioItem value="all">All sites</DropdownMenuRadioItem>
                  {sites.map(s => (
                    <DropdownMenuRadioItem key={s.id} value={s.id}>
                      <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} /> {s.name}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="lg" className="bg-card" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download /> Export CSV
            </Button>
            <Button size="lg" onClick={() => setEditing(null)} disabled={sites.length === 0}>
              <Plus /> Add item
            </Button>
          </>
        }
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <TextInput
            placeholder="Search item, person or note"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="pl-10"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <SegmentedControl options={RANGES} value={range} onChange={setRange} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Package className="size-6" />}
          title="Nothing received"
          description={
            inventory.length === 0
              ? "When the crew log a delivery from the app's Items tab, it shows up here."
              : "No entries match these filters."
          }
        />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <Panel title="Totals" description={`${totals.length} items · click one to see its deliveries`} bodyClassName="p-0 sm:px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5 sm:pl-6">Item</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Used</TableHead>
                  <TableHead className="text-right">Left</TableHead>
                  <TableHead className="pr-5 text-right sm:pr-6">Last</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {totals.map(t => (
                  <TableRow
                    key={`${itemKey(t.name)}|${t.unit}`}
                    className="cursor-pointer"
                    onClick={() => setQuery(t.name)}
                  >
                    <TableCell className="pl-5 font-semibold sm:pl-6">{t.name}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatQuantity(t.quantity)} <span className="font-normal text-muted-foreground">{t.unit}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatQuantity(t.used)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{formatQuantity(t.left)}</TableCell>
                    <TableCell className="pr-5 text-right text-muted-foreground sm:pr-6">{formatDay(t.lastReceivedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>

          <Panel title="Deliveries" description={`${filtered.length} entries`} bodyClassName="p-0 sm:px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5 sm:pl-6">Received</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Qty / left</TableHead>
                  <TableHead>Logged by</TableHead>
                  <TableHead className="pr-5 sm:pr-6" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(e => (
                  <TableRow key={e.id}>
                    <TableCell className="pl-5 align-top whitespace-nowrap sm:pl-6">
                      <div className="text-sm">{formatDateTime(e.receivedAt)}</div>
                      <div className="text-xs text-muted-foreground">{siteName(e.siteId)}</div>
                    </TableCell>
                    <TableCell className="max-w-[280px] align-top whitespace-normal">
                      <div className="font-semibold">{e.name}</div>
                      {e.note && <div className="mt-0.5 text-xs whitespace-pre-line text-muted-foreground">{e.note}</div>}
                      {e.usage.length > 0 && (
                        <ul className="mt-1.5 space-y-0.5 border-l-2 border-border pl-2 text-xs text-muted-foreground">
                          {e.usage.map((u, i) => (
                            <li key={i}>
                              <span className="font-semibold text-foreground">
                                −{formatQuantity(u.quantity)} {e.unit}
                              </span>{" "}
                              · {formatDateTime(u.at)}
                              {u.note && <> · {u.note}</>}
                            </li>
                          ))}
                        </ul>
                      )}
                      {(proofByEntry.get(e.id)?.length ?? 0) > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {(proofByEntry.get(e.id) ?? []).map(photo => (
                            <button
                              key={photo.id}
                              type="button"
                              onClick={() => setProof({ photos: proofByEntry.get(e.id) ?? [], openId: photo.id })}
                              className="relative size-12 overflow-hidden rounded-md border border-border"
                              aria-label="Open proof photo"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element -- remote thumbnail */}
                              <img src={photo.thumbUrl} alt="" className="size-full object-cover" />
                              <Camera className="absolute right-0.5 bottom-0.5 size-3 text-white drop-shadow" />
                            </button>
                          ))}
                        </div>
                      )}
                      {e.editedAt && (
                        <div className="mt-1 inline-flex rounded bg-accent px-1.5 text-[11px] font-semibold text-accent-foreground">
                          Corrected {formatDateTime(e.editedAt)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right align-top font-semibold whitespace-nowrap tabular-nums">
                      {formatQuantity(e.quantity)} <span className="font-normal text-muted-foreground">{e.unit}</span>
                      {formatPack(e) && <div className="text-xs font-normal text-muted-foreground">{formatPack(e)}</div>}
                      {isUsedUp(e) ? (
                        <div className="mt-1 inline-flex rounded bg-success-soft px-1.5 text-[11px] font-semibold text-success">
                          All used
                        </div>
                      ) : (
                        e.usedQuantity > 0 && (
                          <div className="text-xs font-normal text-muted-foreground">{formatQuantity(remaining(e))} left</div>
                        )
                      )}
                    </TableCell>
                    <TableCell className="align-top">
                      {(() => {
                        const person = personById.get(e.personId);
                        return (
                          <div className="flex items-center gap-2">
                            {person && <PersonAvatar person={person} size="xs" />}
                            <div className="min-w-0">
                              <div className="font-semibold">{e.personName || person?.name || "—"}</div>
                              {person?.jobTitle && <div className="text-xs text-muted-foreground">{person.jobTitle}</div>}
                            </div>
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="pr-5 text-right align-top whitespace-nowrap sm:pr-6">
                      <Button variant="ghost" size="icon-sm" aria-label="Correct entry" onClick={() => setEditing(e)}>
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Delete entry"
                        className="text-danger hover:text-danger"
                        onClick={() => setDeleting(e)}
                      >
                        <Trash2 />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
        </div>
      )}

      {proof && (
        <DeletableLightbox
          photos={proof.photos}
          openId={proof.openId}
          onClose={() => setProof(null)}
          onChange={id => setProof(p => (p ? { ...p, openId: id } : p))}
        />
      )}

      <InventoryEntryDialog
        open={editing !== undefined}
        entry={editing ?? null}
        sites={sites}
        defaultSiteId={site === "all" ? undefined : site}
        onSave={save}
        onOpenChange={open => !open && setEditing(undefined)}
      />

      <Dialog open={deleting != null} onOpenChange={open => !open && !busy && setDeleting(null)}>
        <DialogContent className="rounded-xl sm:max-w-[420px]">
          <DialogTitle>Delete this entry?</DialogTitle>
          <DialogDescription>
            {deleting && `${formatQuantity(deleting.quantity)} ${deleting.unit} ${deleting.name}, logged by ${deleting.personName || "crew"}. `}
            It disappears from the crew&apos;s app too. This can&apos;t be undone.
          </DialogDescription>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleting(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" className="flex-1" onClick={confirmDelete} disabled={busy}>
              <Trash2 /> Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
