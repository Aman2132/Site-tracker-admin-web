"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartTooltip } from "./ChartTooltip";

/** Simple vertical bars, each in its own colour (e.g. photos per site). */
export function BarCompare({
  data,
  height = 240,
  valueLabel,
  formatValue = v => String(v),
}: {
  data: { label: string; value: number; color: string; full?: string }[];
  height?: number;
  valueLabel: string;
  formatValue?: (v: number) => string;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -22, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 6" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} dy={6} interval={0} />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "var(--muted)", radius: 10 }}
            content={({ active, payload }) => {
              const row = payload?.[0]?.payload as (typeof data)[number] | undefined;
              return (
                <ChartTooltip
                  active={active}
                  label={row?.full ?? row?.label}
                  rows={row ? [{ name: valueLabel, value: formatValue(row.value), color: row.color }] : []}
                />
              );
            }}
          />
          <Bar dataKey="value" radius={[10, 10, 4, 4]} animationDuration={1100}>
            {data.map(d => (
              <Cell key={d.label} fill={d.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
