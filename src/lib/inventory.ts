import type { InventoryEntry, InventoryUsage } from "../types/domain.ts";

/**
 * Inventory helpers. Pure and free of app imports (relative paths only) so
 * they can be checked with `node --test`. Mirrors the app's src/utils/inventory.ts.
 */

/** Unit chips offered when adding or correcting an entry (same list as the app). */
export const UNITS = ["pcs", "bags", "kg", "tonne", "m", "ft", "sq ft", "litre", "box", "roll", "set"];

/** Same limits firestore.rules enforces. */
export const LIMITS = { maxNameChars: 80, maxUnitChars: 20, maxNoteChars: 300, maxQuantity: 1_000_000 };

export const cleanText = (text: string) => text.trim().replace(/\s+/g, " ");

/** Case- and spacing-insensitive identity of an item name. */
export const itemKey = (name: string) => cleanText(name).toLowerCase();

export function formatQuantity(quantity: number): string {
  return String(Math.round(quantity * 1000) / 1000);
}

export function toInventory(id: string, data: Record<string, unknown>): InventoryEntry {
  return {
    id,
    personId: String(data.personId ?? ""),
    personName: String(data.personName ?? ""),
    siteId: String(data.siteId ?? ""),
    name: String(data.name ?? ""),
    quantity: Number(data.quantity ?? 0),
    unit: String(data.unit ?? ""),
    note: typeof data.note === "string" && data.note.trim() ? data.note.trim() : undefined,
    receivedAt: Number(data.receivedAt ?? 0),
    usedQuantity: typeof data.usedQuantity === "number" ? data.usedQuantity : 0,
    packCount: typeof data.packCount === "number" ? data.packCount : undefined,
    packSize: typeof data.packSize === "number" ? data.packSize : undefined,
    usage: Array.isArray(data.usage)
      ? (data.usage as Record<string, unknown>[])
          .filter(u => typeof u?.quantity === "number")
          .map(u => ({
            quantity: u.quantity as number,
            at: Number(u.at ?? 0),
            note: typeof u.note === "string" && u.note.trim() ? u.note.trim() : undefined,
          }))
      : ([] as InventoryUsage[]),
    editedAt: typeof data.editedAt === "number" ? data.editedAt : undefined,
  };
}

/** "5 × 5 m" for an entry that arrived as equal pieces, else null. */
export function formatPack(e: Pick<InventoryEntry, "packCount" | "packSize" | "unit">): string | null {
  return e.packCount && e.packSize ? `${formatQuantity(e.packCount)} × ${formatQuantity(e.packSize)} ${e.unit}` : null;
}

/** Everything received has been logged as used (allowing for rounding). */
export const isUsedUp = (e: Pick<InventoryEntry, "quantity" | "usedQuantity">) => e.usedQuantity >= e.quantity - 1e-9;

/** What's left of a delivery, never below zero. */
export const remaining = (e: Pick<InventoryEntry, "quantity" | "usedQuantity">) => Math.max(0, e.quantity - e.usedQuantity);

export interface ItemTotal {
  /** The most recent spelling of the name. */
  name: string;
  unit: string;
  quantity: number;
  used: number;
  left: number;
  deliveries: number;
  lastReceivedAt: number;
}

/**
 * Totals per item and unit. "Cement · bags" and "Cement · kg" stay separate:
 * there is no conversion between units (that needs an item catalogue).
 */
export function totalsByItem(entries: InventoryEntry[]): ItemTotal[] {
  const map = new Map<string, ItemTotal>();
  for (const e of entries) {
    const key = `${itemKey(e.name)}|${itemKey(e.unit)}`;
    const t = map.get(key);
    if (!t) {
      map.set(key, {
        name: cleanText(e.name),
        unit: e.unit,
        quantity: e.quantity,
        used: e.usedQuantity,
        left: remaining(e),
        deliveries: 1,
        lastReceivedAt: e.receivedAt,
      });
      continue;
    }
    t.quantity += e.quantity;
    t.used += e.usedQuantity;
    t.left += remaining(e);
    t.deliveries += 1;
    if (e.receivedAt > t.lastReceivedAt) Object.assign(t, { name: cleanText(e.name), lastReceivedAt: e.receivedAt });
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** What's wrong with an owner's change, or null when it can be saved. */
export function changesProblem(c: {
  siteId: string;
  name: string;
  quantity: number;
  unit: string;
  note?: string;
  usedQuantity?: number;
}): string | null {
  if (!c.siteId) return "Pick a site.";
  if (!cleanText(c.name)) return "Name the item.";
  if (cleanText(c.name).length > LIMITS.maxNameChars) return "Item name is too long.";
  if (!(c.quantity > 0) || !Number.isFinite(c.quantity)) return "Quantity must be a number above 0.";
  if (c.quantity > LIMITS.maxQuantity) return "Quantity is too large.";
  if (!cleanText(c.unit)) return "Pick a unit.";
  if (cleanText(c.unit).length > LIMITS.maxUnitChars) return "Unit is too long.";
  if ((c.note ?? "").trim().length > LIMITS.maxNoteChars) return "Note is too long.";
  if (c.usedQuantity != null && (!Number.isFinite(c.usedQuantity) || c.usedQuantity < 0)) return "Used must be 0 or more.";
  return null;
}

const csvCell = (value: string | number) => {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** CSV of the given rows (already formatted), header first. */
export function toCsv(header: string[], rows: (string | number)[][]): string {
  return [header, ...rows].map(row => row.map(csvCell).join(",")).join("\n");
}
