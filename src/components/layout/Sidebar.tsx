"use client";

import { ChevronsLeft, MapPinned } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CountUp, SPRING } from "@/components/motion";
import { useLiveStore } from "@/lib/store";
import { cn } from "@/lib/utils";

import { NAV_ITEMS, isActive } from "./nav";

export const SIDEBAR_WIDTH = { open: 264, closed: 76 };

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="relative inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-hero text-primary-foreground shadow-glow">
        <MapPinned className="size-5" strokeWidth={2.4} />
      </span>
      <AnimatePresence initial={false}>
        {!compact && (
          <motion.div
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={{ duration: 0.18 }}
            className="leading-tight whitespace-nowrap"
          >
            <div className="text-[15px] font-semibold tracking-tight">Site Tracker</div>
            <div className="text-[11px] font-semibold tracking-[0.14em] text-faint uppercase">Admin console</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Nav list, shared by the desktop rail and the mobile drawer. */
export function NavList({ collapsed = false, onNavigate, layoutKey }: { collapsed?: boolean; onNavigate?: () => void; layoutKey: string }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map(item => {
        const active = isActive(pathname, item.href);
        const link = (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
              active ? "text-sidebar-accent-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {active && (
              <motion.span
                layoutId={`nav-active-${layoutKey}`}
                transition={SPRING}
                className="absolute inset-0 rounded-xl bg-sidebar-accent ring-1 ring-primary/10"
              />
            )}
            {active && (
              <motion.span
                layoutId={`nav-bar-${layoutKey}`}
                transition={SPRING}
                className="absolute top-2.5 bottom-2.5 -left-3 w-1 rounded-r-full bg-primary"
              />
            )}
            <item.icon
              className={cn(
                "relative size-[19px] shrink-0 transition-transform duration-300 group-hover:scale-110",
                active && "text-primary"
              )}
              strokeWidth={2.2}
            />
            {!collapsed && <span className="relative truncate">{item.label}</span>}
          </Link>
        );
        if (!collapsed) return link;
        return (
          <Tooltip key={item.href}>
            <TooltipTrigger render={<div />}>{link}</TooltipTrigger>
            <TooltipContent side="right">{item.label}</TooltipContent>
          </Tooltip>
        );
      })}
    </nav>
  );
}

function LiveCrewCard({ collapsed }: { collapsed: boolean }) {
  const { crew } = useLiveStore();
  const online = crew.filter(c => c.status === "online").length;
  const total = crew.filter(c => c.status !== "invited" && c.status !== "deactivated").length;

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-1 rounded-lg border border-border bg-card py-3">
        <span className="relative inline-flex size-2 rounded-full bg-success">
          <span className="absolute inset-0 animate-ping-soft rounded-full bg-success" />
        </span>
        <span className="text-sm font-semibold">{online}</span>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div>
        <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
          <span className="relative inline-flex size-2 rounded-full bg-success">
            <span className="absolute inset-0 animate-ping-soft rounded-full bg-success" />
          </span>
          Live now
        </div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <CountUp value={online} className="text-3xl font-semibold tracking-tight" />
          <span className="text-sm text-muted-foreground">/ {total} crew on shift</span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full bg-success"
            initial={{ width: 0 }}
            animate={{ width: `${(online / Math.max(total, 1)) * 100}%` }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
          />
        </div>
      </div>
    </div>
  );
}

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? SIDEBAR_WIDTH.closed : SIDEBAR_WIDTH.open }}
      transition={SPRING}
      className="sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex"
    >
      <div className={cn("flex h-[60px] items-center px-5", collapsed && "justify-center px-0")}>
        <BrandMark compact={collapsed} />
      </div>
      <div className={cn("flex-1 overflow-y-auto px-4 py-3 scrollbar-thin", collapsed && "px-3")}>
        <div
          className={cn(
            "mb-2 px-3 text-[11px] font-bold tracking-[0.14em] text-faint uppercase transition-opacity",
            collapsed && "opacity-0"
          )}
        >
          Workspace
        </div>
        <NavList collapsed={collapsed} layoutKey="desktop" />
      </div>
      <div className={cn("space-y-3 p-4", collapsed && "px-3")}>
        <LiveCrewCard collapsed={collapsed} />
        <button
          type="button"
          onClick={onToggle}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <motion.span animate={{ rotate: collapsed ? 180 : 0 }} transition={SPRING} className="inline-flex">
            <ChevronsLeft className="size-4" />
          </motion.span>
          {!collapsed && "Collapse"}
        </button>
      </div>
    </motion.aside>
  );
}
