"use client";

import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatDay, formatWeekday } from "@/lib/format";
import type { DailyStat } from "@/lib/insights";

import { ChartTooltip } from "./ChartTooltip";

const TICK = { fill: "var(--muted-foreground)", fontSize: 12 };

/**
 * Hours worked (bars, left axis) and crew on shift (line, right axis) per day.
 * Two axes because the units differ; straight segments so nothing is drawn between real values.
 */
export function AttendanceTrend({ data, height = 280 }: { data: DailyStat[]; height?: number }) {
  const rows = data.map(d => ({ ...d, label: formatWeekday(d.day), hours: Math.round(d.hours * 10) / 10 }));
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 10, right: 0, left: -18, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 6" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={TICK} dy={8} />
          <YAxis yAxisId="h" tickLine={false} axisLine={false} tick={TICK} tickFormatter={v => `${v}h`} />
          <YAxis yAxisId="c" orientation="right" tickLine={false} axisLine={false} tick={TICK} allowDecimals={false} width={32} />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.6 }}
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
          <Bar yAxisId="h" dataKey="hours" fill="var(--chart-1)" radius={[6, 6, 0, 0]} maxBarSize={36} animationDuration={900} />
          <Line
            yAxisId="c"
            type="linear"
            dataKey="crewOnline"
            stroke="var(--chart-2)"
            strokeWidth={2.5}
            dot={{ r: 3.5, strokeWidth: 2, fill: "var(--card)" }}
            activeDot={{ r: 5, strokeWidth: 3, stroke: "var(--card)" }}
            animationDuration={1100}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
