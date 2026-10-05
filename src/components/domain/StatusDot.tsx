import { cn } from "@/lib/utils";

import type { PresenceStatus } from "@/types/domain";

export const STATUS_META: Record<PresenceStatus, { label: string; dot: string; chip: string }> = {
  online: { label: "Online", dot: "bg-success", chip: "bg-success-soft text-success" },
  idle: { label: "Idle 1h+", dot: "bg-warning", chip: "bg-warning-soft text-warning" },
  offline: { label: "Offline", dot: "bg-stale", chip: "bg-stale-soft text-muted-foreground" },
  invited: { label: "Invited", dot: "bg-primary-bright", chip: "bg-accent text-accent-foreground" },
  deactivated: { label: "Deactivated", dot: "bg-danger", chip: "bg-danger-soft text-danger" },
};

/** Presence dot; online pulses so "live" reads at a glance. */
export function StatusDot({ status, className }: { status: PresenceStatus; className?: string }) {
  return (
    <span className={cn("relative inline-flex size-2.5 rounded-full", STATUS_META[status].dot, className)}>
      {status === "online" && (
        <span className={cn("absolute inset-0 rounded-full animate-ping-soft", STATUS_META[status].dot)} />
      )}
    </span>
  );
}

export function StatusChip({ status, className }: { status: PresenceStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        STATUS_META[status].chip,
        className
      )}
    >
      <StatusDot status={status} className="size-1.5" />
      {STATUS_META[status].label}
    </span>
  );
}
