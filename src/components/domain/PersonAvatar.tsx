import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

import type { CrewMember } from "@/types/domain";

import { StatusDot } from "./StatusDot";

const SIZES = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-[11px]",
  md: "size-10 text-sm",
  lg: "size-14 text-lg",
  xl: "size-20 text-2xl",
} as const;

/**
 * Initials on the person's own colour (the same `color` the mobile app's
 * map marker uses), with an optional presence dot.
 */
export function PersonAvatar({
  person,
  size = "md",
  showStatus = false,
  className,
}: {
  person: Pick<CrewMember, "name" | "color" | "status">;
  size?: keyof typeof SIZES;
  showStatus?: boolean;
  className?: string;
}) {
  const muted = person.status === "invited" || person.status === "deactivated";
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full font-bold tracking-tight text-white ring-2 ring-card select-none",
          SIZES[size],
          muted && "opacity-55 grayscale"
        )}
        style={{
          backgroundImage: `linear-gradient(135deg, color-mix(in oklab, ${person.color} 78%, white) 0%, ${person.color} 100%)`,
        }}
      >
        {initials(person.name)}
      </span>
      {showStatus && (
        <StatusDot status={person.status} className="absolute -right-0.5 -bottom-0.5 ring-2 ring-card" />
      )}
    </span>
  );
}

export function AvatarStack({
  people,
  max = 4,
  size = "sm",
}: {
  people: Pick<CrewMember, "id" | "name" | "color" | "status">[];
  max?: number;
  size?: keyof typeof SIZES;
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <div className="flex -space-x-2">
      {shown.map(p => (
        <PersonAvatar key={p.id} person={p} size={size} />
      ))}
      {rest > 0 && (
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground ring-2 ring-card",
            SIZES[size]
          )}
        >
          +{rest}
        </span>
      )}
    </div>
  );
}
