import { cn } from "@/lib/utils";

import type { SiteStatus } from "@/types/domain";

const META: Record<SiteStatus, { label: string; className: string; bar: string }> = {
  active: { label: "Active", className: "bg-success-soft text-success", bar: "bg-success" },
  planning: { label: "Planning", className: "bg-accent text-accent-foreground", bar: "bg-primary" },
  paused: { label: "Paused", className: "bg-warning-soft text-warning", bar: "bg-warning" },
  completed: { label: "Completed", className: "bg-stale-soft text-muted-foreground", bar: "bg-stale" },
};

/** Solid colour for a status (the strip across a site card), matching its badge. */
export const siteStatusBar = (status: SiteStatus) => META[status].bar;

export function SiteStatusBadge({ status, className }: { status: SiteStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold", META[status].className, className)}>
      {META[status].label}
    </span>
  );
}
