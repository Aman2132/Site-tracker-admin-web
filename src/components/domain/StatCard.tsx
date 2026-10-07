"use client";

import { motion } from "motion/react";
import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";

import { Sparkline } from "@/components/charts/Sparkline";
import { CountUp } from "@/components/motion";
import { cn } from "@/lib/utils";

const TONES = {
  primary: { icon: "bg-accent text-primary", line: "var(--chart-1)" },
  success: { icon: "bg-success-soft text-success", line: "var(--chart-2)" },
  warning: { icon: "bg-warning-soft text-warning", line: "var(--chart-3)" },
  violet: { icon: "bg-accent text-chart-4", line: "var(--chart-4)" },
} as const;

export function StatCard({
  label,
  value,
  decimals = 0,
  suffix,
  icon: Icon,
  tone = "primary",
  delta,
  deltaLabel = "vs last week",
  trend,
  footnote,
}: {
  label: string;
  value: number;
  decimals?: number;
  suffix?: string;
  icon: LucideIcon;
  tone?: keyof typeof TONES;
  /** Fractional change, e.g. 0.12 for +12%. */
  delta?: number;
  deltaLabel?: string;
  trend?: number[];
  footnote?: string;
}) {
  const up = (delta ?? 0) >= 0;
  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className="surface group relative overflow-hidden rounded-2xl p-5 transition-shadow hover:shadow-lift"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-semibold text-muted-foreground">{label}</div>
        <span
          className={cn(
            "flex size-10 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6",
            TONES[tone].icon
          )}
        >
          <Icon className="size-5" strokeWidth={2.2} />
        </span>
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <CountUp value={value} decimals={decimals} className="text-[32px] leading-none font-semibold tracking-tight" />
        {suffix && <span className="text-lg font-bold text-muted-foreground">{suffix}</span>}
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col items-start gap-1 text-xs">
          {delta != null && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-bold",
                up ? "bg-success-soft text-success" : "bg-danger-soft text-danger"
              )}
            >
              {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
              {up ? "+" : ""}
              {Math.round(delta * 100)}%
            </span>
          )}
          <span className="whitespace-nowrap text-muted-foreground">{footnote ?? deltaLabel}</span>
        </div>
        {trend && <Sparkline data={trend} color={TONES[tone].line} className="h-9 w-20 shrink-0" />}
      </div>
    </motion.div>
  );
}
