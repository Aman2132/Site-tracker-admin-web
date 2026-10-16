"use client";

import { describeChanges, describeFields } from "@/lib/auditLog";
import { Building2, Camera, ChevronRight, Download, MoreHorizontal, Package, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
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
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { firebase } from "@/lib/firebase";
import { formatDateTime, formatDay, plural } from "@/lib/format";
import { formatPack, formatQuantity, isUsedUp, itemKey, remaining, toCsv, totalsByItem } from "@/lib/inventory";
import { attempt, logAction, useLiveStore, useLookups, useNow } from "@/lib/store";
import { defaultSiteAmong } from "@/lib/prefs";
import { DAY, dayStart } from "@/lib/time";
import { cn } from "@/lib/utils";

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
  const [site, setSite] = useState(() => defaultSiteAmong(sites));
  const [range, setRange] = useState<Range>("30d");
  const [query, setQuery] = useState("");
  /** undefined = dialog closed, null = adding, entry = correcting it. */
  const [editing, setEditing] = useState<InventoryEntry | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<InventoryEntry | null>(null);
  const [busy, setBusy] = useState(false);
  /** Proof photos open in the viewer: the entry's photos + which one is shown. */
  const [proof, setProof] = useState<{ photos: SitePhoto[]; openId: string } | null>(null);
  /** Deliveries whose usage history and proof photos are unfolded. */
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) =>
    setExpanded(previous => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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
  const loggedBy = (e: InventoryEntry) => e.personName || personById.get(e.personId)?.name || "—";
  const proofOf = (e: InventoryEntry) => proofByEntry.get(e.id) ?? [];
  const hasDetails = (e: InventoryEntry) => e.usage.length > 0 || proofOf(e).length > 0;
  const detailsLabel = (e: InventoryEntry) =>
    [e.usage.length && `Used ${plural(e.usage.length, "time")}`, proofOf(e).length && plural(proofOf(e).length, "photo")]
      .filter(Boolean)
      .join(" · ");

  const quantity = (e: InventoryEntry) => (
    <div className="font-semibold tabular-nums">
      {formatQuantity(e.quantity)} <span className="font-normal text-muted-foreground">{e.unit}</span>
      {formatPack(e) && <div className="text-xs font-normal text-muted-foreground">{formatPack(e)}</div>}
      {isUsedUp(e) ? (
        <div className="mt-1 inline-flex rounded bg-success-soft px-1.5 text-[11px] font-semibold text-success">All used</div>
      ) : (
        e.usedQuantity > 0 && <div className="text-xs font-normal text-muted-foreground">{formatQuantity(remaining(e))} left</div>
      )}
    </div>
  );

  /** Usage history and proof photos, shown when a delivery is unfolded. */
  const entryDetails = (e: InventoryEntry) => (
    <div className="space-y-2">
      {e.usage.length > 0 && (
        <ul className="space-y-0.5 border-l-2 border-border pl-2 text-xs text-muted-foreground">
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
      {proofOf(e).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {proofOf(e).map(photo => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setProof({ photos: proofOf(e), openId: photo.id })}
              className="relative size-14 overflow-hidden rounded-md border border-border"
              aria-label="Open proof photo"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- remote thumbnail */}
              <img src={photo.thumbUrl} alt="" className="size-full object-cover" />
              <Camera className="absolute right-0.5 bottom-0.5 size-3 text-white drop-shadow" />
            </button>
          ))}
        </div>
      )}
    </div>
  );

  /** Correct and Delete live behind one menu; Delete still asks before it does anything. */
  const entryActions = (e: InventoryEntry) => (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" className="rounded-lg" aria-label={`Actions for ${e.name}`} />}>
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={() => setEditing(e)}>
          <Pencil /> Correct entry
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={() => setDeleting(e)}>
          <Trash2 /> Delete…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

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
      {
        targetType: "inventory",
        targetId: target?.id,
        note: reason,
        changes: target
          ? describeChanges([
              { label: "item", before: target.name, after: changes.name.trim() },
              { label: "quantity", before: target.quantity, after: changes.quantity },
              { label: "unit", before: target.unit, after: changes.unit.trim() },
              { label: "used", before: target.usedQuantity, after: changes.usedQuantity ?? target.usedQuantity },
              { label: "site", before: siteName(target.siteId), after: siteName(changes.siteId) },
              { label: "note", before: target.note, after: changes.note?.trim() },
            ])
          : describeFields([
              { label: "item", value: changes.name.trim() },
              { label: "quantity", value: `${changes.quantity} ${changes.unit.trim()}` },
              { label: "site", value: siteName(changes.siteId) },
            ]),
      }
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
      {
        targetType: "inventory",
        targetId: deleting.id,
        changes: describeFields([
          { label: "deleted item", value: deleting.name },
          { label: "quantity", value: `${deleting.quantity} ${deleting.unit}` },
          { label: "used", value: deleting.usedQuantity },
          { label: "site", value: siteName(deleting.siteId) },
          { label: "logged by", value: deleting.personName },
          { label: "received", value: formatDateTime(deleting.receivedAt) },
        ]),
      }
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
    logAction("Exported inventory CSV", {
      kind: "export",
      changes: describeFields([
        { label: "rows", value: rows.length },
        { label: "site", value: site === "all" ? "all sites" : siteName(site) },
        { label: "range", value: range },
        { label: "search", value: query.trim() },
      ]),
    });
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
        <div className="grid gap-5">
          <Panel title="Totals" description={`${plural(totals.length, "item")} · click one to see its deliveries`} bodyClassName="p-0 sm:px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5 sm:pl-6">Item</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Used</TableHead>
                  <TableHead className="text-right">Left</TableHead>
                  <TableHead className="hidden pr-5 text-right sm:table-cell sm:pr-6">Last</TableHead>
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
                    <TableCell className="hidden pr-5 text-right text-muted-foreground sm:table-cell sm:pr-6">{formatDay(t.lastReceivedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>

          <Panel title="Deliveries" description={plural(filtered.length, "entry", "entries")} bodyClassName="p-0 sm:px-0">
            {/* Phone: one card per delivery instead of a table that can't fit. */}
            <ul className="divide-y divide-border sm:hidden">
              {filtered.map(e => (
                <li key={e.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold">{e.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDateTime(e.receivedAt)} · {siteName(e.siteId)}
                      </div>
                    </div>
                    {entryActions(e)}
                  </div>
                  <div className="mt-2 flex items-baseline justify-between gap-3">
                    {quantity(e)}
                    <span className="truncate text-xs text-muted-foreground">by {loggedBy(e)}</span>
                  </div>
                  {e.note && <div className="mt-1 text-xs whitespace-pre-line text-muted-foreground">{e.note}</div>}
                  {hasDetails(e) && (
                    <details className="group mt-2">
                      <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-semibold text-primary [&::-webkit-details-marker]:hidden">
                        <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" /> {detailsLabel(e)}
                      </summary>
                      <div className="mt-2">{entryDetails(e)}</div>
                    </details>
                  )}
                </li>
              ))}
            </ul>

            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5 sm:pl-6">Received</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Qty / left</TableHead>
                    <TableHead>Logged by</TableHead>
                    <TableHead className="w-12 pr-5 sm:pr-6" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(e => {
                    const open = expanded.has(e.id);
                    return (
                      <Fragment key={e.id}>
                        <TableRow className={cn(open && "border-b-0")}>
                          <TableCell className="pl-5 align-top whitespace-nowrap sm:pl-6">
                            <div className="text-sm">{formatDateTime(e.receivedAt)}</div>
                            <div className="text-xs text-muted-foreground">{siteName(e.siteId)}</div>
                          </TableCell>
                          <TableCell className="min-w-56 align-top whitespace-normal">
                            <div className="font-semibold">{e.name}</div>
                            {e.note && <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{e.note}</div>}
                            {e.editedAt && (
                              <div className="mt-1 inline-flex rounded bg-accent px-1.5 text-[11px] font-semibold text-accent-foreground">
                                Corrected {formatDateTime(e.editedAt)}
                              </div>
                            )}
                            {hasDetails(e) && (
                              <button
                                type="button"
                                onClick={() => toggleExpanded(e.id)}
                                aria-expanded={open}
                                className="mt-1 flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                              >
                                <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} /> {detailsLabel(e)}
                              </button>
                            )}
                          </TableCell>
                          <TableCell className="text-right align-top whitespace-nowrap">{quantity(e)}</TableCell>
                          <TableCell className="align-top">
                            <div className="flex items-center gap-2">
                              {personById.get(e.personId) && <PersonAvatar person={personById.get(e.personId)!} size="xs" />}
                              <div className="min-w-0">
                                <div className="font-semibold">{loggedBy(e)}</div>
                                {personById.get(e.personId)?.jobTitle && (
                                  <div className="text-xs text-muted-foreground">{personById.get(e.personId)!.jobTitle}</div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="pr-5 text-right align-top sm:pr-6">{entryActions(e)}</TableCell>
                        </TableRow>
                        {open && (
                          <TableRow className="bg-muted/40 hover:bg-muted/40">
                            <TableCell colSpan={5} className="pb-4 pl-5 whitespace-normal sm:pl-6">
                              {entryDetails(e)}
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
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
