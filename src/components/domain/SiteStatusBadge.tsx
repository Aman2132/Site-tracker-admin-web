import { cn } from "@/lib/utils";

import type { SiteStatus } from "@/types/domain";

const META: Record<SiteStatus, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-success-soft text-success" },
  planning: { label: "Planning", className: "bg-accent text-accent-foreground" },
  paused: { label: "Paused", className: "bg-warning-soft text-warning" },
  completed: { label: "Completed", className: "bg-stale-soft text-muted-foreground" },
};

export function SiteStatusBadge({ status, className }: { status: SiteStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold", META[status].className, className)}>
      {META[status].label}
    </span>
  );
}
