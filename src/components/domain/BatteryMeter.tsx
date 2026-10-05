import { BatteryFull, BatteryLow, BatteryMedium } from "lucide-react";

import { LOW_BATTERY } from "@/lib/insights";
import { cn } from "@/lib/utils";

export function BatteryMeter({ value }: { value?: number }) {
  if (value == null) return <span className="text-xs text-faint">—</span>;
  const low = value <= LOW_BATTERY;
  const Icon = low ? BatteryLow : value > 0.6 ? BatteryFull : BatteryMedium;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold", low ? "text-danger" : "text-muted-foreground")}>
      <Icon className="size-4" />
      {Math.round(value * 100)}%
    </span>
  );
}
