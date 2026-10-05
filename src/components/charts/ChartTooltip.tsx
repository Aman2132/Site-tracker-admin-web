"use client";

/** Shared tooltip body for Recharts charts, styled like the rest of the app. */
export function ChartTooltip({
  active,
  label,
  rows,
}: {
  active?: boolean;
  label?: string;
  rows: { name: string; value: string; color: string }[];
}) {
  if (!active || rows.length === 0) return null;
  return (
    <div className="min-w-40 rounded-xl border border-border bg-popover px-3 py-2.5 text-popover-foreground shadow-lift">
      {label && <div className="mb-1.5 text-xs font-bold text-muted-foreground">{label}</div>}
      <div className="space-y-1">
        {rows.map(row => (
          <div key={row.name} className="flex items-center justify-between gap-4 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="size-2 rounded-full" style={{ backgroundColor: row.color }} />
              {row.name}
            </span>
            <span className="font-bold tabular-nums">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
