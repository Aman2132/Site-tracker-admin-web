"use client";

import { Loader2, Package } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { changesProblem, LIMITS, UNITS } from "@/lib/inventory";

import type { InventoryChanges, InventoryEntry, Site } from "@/types/domain";

import { ChoiceChip, Field, TextInput } from "./FormBits";

/**
 * Add a delivery, or correct one the crew logged. `entry` null = add.
 * Validates the same way firestore.rules does, so a save doesn't bounce.
 */
export function InventoryEntryDialog({
  open,
  entry,
  sites,
  defaultSiteId,
  onSave,
  onOpenChange,
}: {
  open: boolean;
  entry: InventoryEntry | null;
  sites: Site[];
  defaultSiteId?: string;
  /** Resolves true when saved. */
  onSave: (changes: InventoryChanges) => Promise<boolean>;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden rounded-xl p-0 sm:max-w-[520px]">
        {/* Mounted per open, so the form starts from the entry each time and live updates don't reset typing. */}
        {open && (
          <EntryForm
            key={entry?.id ?? "new"}
            entry={entry}
            sites={sites}
            defaultSiteId={defaultSiteId}
            onSave={onSave}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EntryForm({
  entry,
  sites,
  defaultSiteId,
  onSave,
  onClose,
}: {
  entry: InventoryEntry | null;
  sites: Site[];
  defaultSiteId?: string;
  onSave: (changes: InventoryChanges) => Promise<boolean>;
  onClose: () => void;
}) {
  const [siteId, setSiteId] = useState(entry?.siteId ?? defaultSiteId ?? sites[0]?.id ?? "");
  const [name, setName] = useState(entry?.name ?? "");
  const [quantity, setQuantity] = useState(entry ? String(entry.quantity) : "");
  const [unit, setUnit] = useState(entry?.unit ?? "");
  const [note, setNote] = useState(entry?.note ?? "");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const changes = { siteId, name, quantity: Number(quantity.replace(",", ".")), unit, note };
    const issue = changesProblem(changes);
    setProblem(issue);
    if (issue) return;
    setBusy(true);
    const saved = await onSave(changes);
    setBusy(false);
    if (saved) onClose();
  };

  const customUnit = unit !== "" && !UNITS.includes(unit);

  return (
    <div className="max-h-[88dvh] space-y-5 overflow-y-auto p-6 scrollbar-thin">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-primary">
          <Package className="size-5" />
        </span>
        <div>
          <DialogTitle className="text-lg font-semibold">{entry ? "Correct entry" : "Add received item"}</DialogTitle>
          <DialogDescription>
            {entry
              ? `Logged by ${entry.personName || "crew"}. The crew will see it marked as corrected.`
              : "Logged under your name, received now."}
          </DialogDescription>
        </div>
      </div>

      <Field label="Site">
        <div className="flex flex-wrap gap-2">
          {sites.map(s => (
            <ChoiceChip key={s.id} selected={siteId === s.id} onClick={() => setSiteId(s.id)}>
              {s.name}
            </ChoiceChip>
          ))}
        </div>
      </Field>

      <Field label="Item" htmlFor="inv-name">
        <TextInput
          id="inv-name"
          autoFocus
          placeholder="e.g. Cement (OPC 53)"
          maxLength={LIMITS.maxNameChars}
          value={name}
          onChange={e => setName(e.target.value)}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-[140px_1fr]">
        <Field label="Quantity" htmlFor="inv-qty">
          <TextInput
            id="inv-qty"
            inputMode="decimal"
            placeholder="0"
            value={quantity}
            onChange={e => setQuantity(e.target.value)}
            className="text-base font-semibold"
          />
        </Field>
        <Field label="Unit">
          <div className="flex flex-wrap gap-1.5">
            {UNITS.map(u => (
              <ChoiceChip key={u} selected={unit === u} onClick={() => setUnit(u)}>
                {u}
              </ChoiceChip>
            ))}
          </div>
          <TextInput
            placeholder="Other unit…"
            maxLength={LIMITS.maxUnitChars}
            value={customUnit ? unit : ""}
            onChange={e => setUnit(e.target.value)}
            className="mt-2 h-9"
          />
        </Field>
      </div>

      <Field label="Note (optional)" htmlFor="inv-note">
        <Textarea
          id="inv-note"
          rows={3}
          maxLength={LIMITS.maxNoteChars}
          placeholder="Supplier, challan no., condition…"
          value={note}
          onChange={e => setNote(e.target.value)}
          className="rounded-lg bg-card"
        />
      </Field>

      {problem && <p className="text-sm font-medium text-danger">{problem}</p>}

      <div className="flex gap-2 pt-1">
        <Button variant="outline" size="lg" className="flex-1 rounded-lg" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button size="lg" className="flex-1 rounded-lg" onClick={submit} disabled={busy}>
          {busy && <Loader2 className="animate-spin" />} {entry ? "Save changes" : "Add item"}
        </Button>
      </div>
    </div>
  );
}
