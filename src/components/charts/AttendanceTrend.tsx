"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatDay, formatWeekday } from "@/lib/format";
import type { DailyStat } from "@/lib/insights";

import { ChartTooltip } from "./ChartTooltip";

/** Crew on shift vs hours worked per day — the overview's main chart. */
export function AttendanceTrend({ data, height = 280 }: { data: DailyStat[]; height?: number }) {
  const rows = data.map(d => ({ ...d, label: formatWeekday(d.day), hours: Math.round(d.hours * 10) / 10 }));
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="fill-hours" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.32} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="fill-crew" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.25} />
              <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 6" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} dy={8} />
          <YAxis yAxisId="h" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
          <YAxis yAxisId="c" orientation="right" hide />
          <Tooltip
            cursor={{ stroke: "var(--primary)", strokeOpacity: 0.25, strokeWidth: 28 }}
            content={({ active, payload }) => {
              const row = payload?.[0]?.payload as (typeof rows)[number] | undefined;
              return (
                <ChartTooltip
                  active={active}
                  label={row ? formatDay(row.day) : undefined}
                  rows={
                    row
                      ? [
                          { name: "Hours worked", value: `${row.hours}h`, color: "var(--chart-1)" },
                          { name: "Crew on shift", value: String(row.crewOnline), color: "var(--chart-2)" },
                          { name: "Photos", value: String(row.photos), color: "var(--chart-4)" },
                        ]
                      : []
                  }
                />
              );
            }}
          />
          <Area
            yAxisId="h"
            type="monotone"
            dataKey="hours"
            stroke="var(--chart-1)"
            strokeWidth={2.5}
            fill="url(#fill-hours)"
            animationDuration={1200}
            activeDot={{ r: 5, strokeWidth: 3, stroke: "var(--card)" }}
          />
          <Area
            yAxisId="c"
            type="monotone"
            dataKey="crewOnline"
            stroke="var(--chart-2)"
            strokeWidth={2}
            strokeDasharray="5 5"
            fill="url(#fill-crew)"
            animationDuration={1400}
            activeDot={{ r: 4, strokeWidth: 3, stroke: "var(--card)" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
