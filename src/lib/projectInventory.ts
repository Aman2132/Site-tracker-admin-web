import type { InventoryUsageRecord, ProjectInventoryItem, SiteInventoryAllocation } from "../types/domain.ts";

/** Inventory arithmetic shared by the dashboard and the future mobile integration. */
export const EPSILON = 1e-9;

export const availableToAllocate = (item: Pick<ProjectInventoryItem, "quantity" | "allocatedQuantity">) =>
  Math.max(0, item.quantity - item.allocatedQuantity);

export const availableAtSite = (allocation: Pick<SiteInventoryAllocation, "quantity" | "usedQuantity">) =>
  Math.max(0, allocation.quantity - allocation.usedQuantity);

/** A human-readable refusal that keeps the allocation limit visible to the user. */
export function usageProblem(available: number, requested: number): string | null {
  if (!Number.isFinite(requested) || requested <= 0) return "Usage must be a number above 0.";
  if (requested > available + EPSILON) return `Only ${round(available)} item${available === 1 ? " is" : "s are"} available at this site.`;
  return null;
}

export function allocationProblem(available: number, requested: number): string | null {
  if (!Number.isFinite(requested) || requested <= 0) return "Allocation must be a number above 0.";
  if (requested > available + EPSILON) return `Only ${round(available)} remain unallocated in this project.`;
  return null;
}

const round = (value: number) => Math.round(value * 1000) / 1000;

const text = (value: unknown) => (typeof value === "string" ? value : "");
const number = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

export function toProjectInventoryItem(id: string, data: Record<string, unknown>): ProjectInventoryItem {
  return { id, projectId: text(data.projectId), name: text(data.name), unit: text(data.unit), quantity: number(data.quantity), allocatedQuantity: number(data.allocatedQuantity), usedQuantity: number(data.usedQuantity), note: text(data.note) || undefined, receivedAt: number(data.receivedAt) };
}

export function toSiteInventoryAllocation(id: string, data: Record<string, unknown>): SiteInventoryAllocation {
  return { id, projectId: text(data.projectId), projectItemId: text(data.projectItemId), siteId: text(data.siteId), name: text(data.name), unit: text(data.unit), quantity: number(data.quantity), usedQuantity: number(data.usedQuantity), allocatedAt: number(data.allocatedAt) };
}

export function toInventoryUsageRecord(id: string, data: Record<string, unknown>): InventoryUsageRecord {
  return {
    id, projectId: text(data.projectId), siteId: text(data.siteId), allocationId: text(data.allocationId), projectItemId: text(data.projectItemId), name: text(data.name), unit: text(data.unit), quantity: number(data.quantity), note: text(data.note) || undefined,
    proofPhotoIds: Array.isArray(data.proofPhotoIds) ? data.proofPhotoIds.filter((value): value is string => typeof value === "string") : [],
    actorId: text(data.actorId), actorName: text(data.actorName), actorRole: data.actorRole === "admin" ? "admin" : "crew", at: number(data.at),
  };
}
