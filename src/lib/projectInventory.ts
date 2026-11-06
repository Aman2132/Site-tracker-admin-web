import type { InventoryUsageRecord, Project, ProjectInventoryItem, Site, SiteInventoryAllocation } from "../types/domain.ts";

/** Normalises a project or site name for case- and whitespace-insensitive uniqueness checks. */
export const normalizeEntityName = (name: string): string =>
  name.trim().replace(/\s+/g, " ").toLowerCase();

/** Validates a project name: at least 3 chars and unique across all projects. */
export function projectNameProblem(
  name: string,
  existingProjects: Pick<Project, "id" | "name">[],
  excludeId?: string
): string | null {
  const trimmed = name.trim();
  if (trimmed.length < 3) return "Give the project a name (at least 3 characters)";
  const norm = normalizeEntityName(trimmed);
  if (existingProjects.some(p => p.id !== excludeId && normalizeEntityName(p.name) === norm)) {
    return "A project with this name already exists";
  }
  return null;
}

/** Validates a site name: at least 3 chars and unique across existing and queued sites. */
export function siteNameProblem(
  name: string,
  existingSites: Pick<Site, "id" | "name">[],
  pendingSiteNames: string[] = [],
  excludeId?: string
): string | null {
  const trimmed = name.trim();
  if (trimmed.length < 3) return "Give the site a name your crew will recognise";
  const norm = normalizeEntityName(trimmed);
  if (existingSites.some(s => s.id !== excludeId && normalizeEntityName(s.name) === norm)) {
    return "A site with this name already exists";
  }
  if (pendingSiteNames.some(pending => normalizeEntityName(pending) === norm)) {
    return "You already added a site with this name";
  }
  return null;
}

/** One site can belong to at most one project: only unassigned sites (or sites already in `targetProjectId`) may attach. */
export function canAttachSiteToProject(site: Pick<Site, "projectId">, targetProjectId?: string): boolean {
  return !site.projectId || (targetProjectId != null && site.projectId === targetProjectId);
}

/** Inventory arithmetic shared by the dashboard and the future mobile integration. */
export const EPSILON = 1e-9;

export const availableToAllocate = (item: Pick<ProjectInventoryItem, "quantity" | "allocatedQuantity">) =>
  Math.max(0, item.quantity - item.allocatedQuantity);

export const availableAtSite = (allocation: Pick<SiteInventoryAllocation, "quantity" | "usedQuantity">) =>
  Math.max(0, allocation.quantity - allocation.usedQuantity);

export type StockLevel = "out" | "critical" | "low" | "ok";

export interface StockAlert {
  level: StockLevel;
  percent: number;
  label: string;
}

/** Evaluates stock health for project stock and site allocations. */
export function getStockAlert(total: number, available: number): StockAlert {
  if (total <= 0) return { level: "ok", percent: 100, label: "No stock set" };
  const percent = Math.round((Math.max(0, available) / total) * 100);
  if (available <= 0) return { level: "out", percent: 0, label: "Out of stock" };
  if (percent <= 10) return { level: "critical", percent, label: `Critical (${percent}% left)` };
  if (percent <= 25) return { level: "low", percent, label: `Low stock (${percent}% left)` };
  return { level: "ok", percent, label: `${percent}% available` };
}

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
