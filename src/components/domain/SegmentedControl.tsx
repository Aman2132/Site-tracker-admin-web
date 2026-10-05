"use client";

import { motion } from "motion/react";
import { useId } from "react";

import { SPRING } from "@/components/motion";
import { cn } from "@/lib/utils";

/** Pill tabs with a sliding highlight. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  size = "md",
}: {
  options: { value: T; label: React.ReactNode; count?: number }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  const id = useId();
  return (
    <div
      role="tablist"
      className={cn("inline-flex items-center gap-0.5 rounded-xl bg-muted p-1", className)}
    >
      {options.map(opt => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative inline-flex items-center gap-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
              size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-sm",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                transition={SPRING}
                className="absolute inset-0 rounded-lg bg-card shadow-card ring-1 ring-border"
              />
            )}
            <span className="relative inline-flex items-center gap-1.5">
              {opt.label}
              {opt.count != null && (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[10px] leading-4 font-bold",
                    active ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"
                  )}
                >
                  {opt.count}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
