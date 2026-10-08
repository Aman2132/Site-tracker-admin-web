import type { InventoryEntry } from "../types/domain.ts";

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
    editedAt: typeof data.editedAt === "number" ? data.editedAt : undefined,
    editedBy: typeof data.editedBy === "string" ? data.editedBy : undefined,
  };
}

export interface ItemTotal {
  /** The most recent spelling of the name. */
  name: string;
  unit: string;
  quantity: number;
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
      map.set(key, { name: cleanText(e.name), unit: e.unit, quantity: e.quantity, deliveries: 1, lastReceivedAt: e.receivedAt });
      continue;
    }
    t.quantity += e.quantity;
    t.deliveries += 1;
    if (e.receivedAt > t.lastReceivedAt) Object.assign(t, { name: cleanText(e.name), lastReceivedAt: e.receivedAt });
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** What's wrong with an owner's change, or null when it can be saved. */
export function changesProblem(c: { siteId: string; name: string; quantity: number; unit: string; note?: string }): string | null {
  if (!c.siteId) return "Pick a site.";
  if (!cleanText(c.name)) return "Name the item.";
  if (cleanText(c.name).length > LIMITS.maxNameChars) return "Item name is too long.";
  if (!(c.quantity > 0) || !Number.isFinite(c.quantity)) return "Quantity must be a number above 0.";
  if (c.quantity > LIMITS.maxQuantity) return "Quantity is too large.";
  if (!cleanText(c.unit)) return "Pick a unit.";
  if (cleanText(c.unit).length > LIMITS.maxUnitChars) return "Unit is too long.";
  if ((c.note ?? "").trim().length > LIMITS.maxNoteChars) return "Note is too long.";
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
