"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useId } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { CrewMember } from "@/types/domain";

import { PersonAvatar } from "./PersonAvatar";

/** Largest radius the schematic is scaled for; bigger fences just fill the frame. */
const MAX_RADIUS = 400;

/**
 * Stylised site plan — a blueprint grid, building footprints and the
 * geofence ring, with crew pins floating on top. It stands in for real map
 * tiles in this static prototype (no API key needed).
 */
export function SiteMap({
  radius,
  color,
  crew = [],
  className,
  interactive = true,
  aspect = 16 / 9,
}: {
  radius: number;
  color: string;
  crew?: CrewMember[];
  className?: string;
  interactive?: boolean;
  /** Width / height of the frame; pins are placed inside the ring using it. */
  aspect?: number;
}) {
  const id = useId();
  /** Ring diameter as a % of the frame height. */
  const ringH = 48 + (Math.min(radius, MAX_RADIUS) / MAX_RADIUS) * 40;
  const ry = ringH / 2;
  const rx = ry / aspect;

  /**
   * Even "sunflower" spread inside the fence, so pins never stack on top of
   * each other; idle people drift towards the edge.
   */
  const pinAt = (person: CrewMember, i: number, n: number) => {
    const angle = i * 2.39996 + 0.6;
    const r = Math.sqrt((i + 0.6) / Math.max(n, 1)) * (person.status === "idle" ? 0.9 : 0.78);
    return { left: 50 + Math.cos(angle) * r * rx, top: 50 + Math.sin(angle) * r * ry };
  };

  return (
    <div
      className={cn("relative isolate overflow-hidden rounded-2xl bg-[color-mix(in_oklab,var(--primary)_5%,var(--card))]", className)}
      style={{ aspectRatio: aspect }}
    >
      <div className="bg-grid absolute inset-0" />
      <svg className="absolute inset-0 size-full" viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <pattern id={`hatch-${id}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--border)" strokeWidth="2" />
          </pattern>
        </defs>
        {/* Roads */}
        <path d="M-10 196 C 120 180, 260 214, 410 188" stroke="var(--card)" strokeWidth="18" fill="none" />
        <path d="M-10 196 C 120 180, 260 214, 410 188" stroke="var(--border)" strokeWidth="1" strokeDasharray="8 8" fill="none" />
        <path d="M300 -10 L 318 270" stroke="var(--card)" strokeWidth="14" fill="none" />
        {/* Building footprints */}
        {[
          [70, 54, 72, 46],
          [168, 40, 54, 70],
          [236, 70, 46, 38],
          [96, 120, 60, 40],
          [186, 128, 70, 34],
          [336, 40, 50, 60],
          [338, 120, 46, 44],
          [20, 222, 80, 30],
        ].map(([x, y, w, h], i) => (
          <rect key={i} x={x} y={y} width={w} height={h} rx={4} fill={`url(#hatch-${id})`} stroke="var(--border)" strokeWidth={1.2} />
        ))}
      </svg>

      {/* Geofence */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          className="absolute rounded-full border-2 border-dashed"
          style={{ borderColor: color, backgroundColor: `color-mix(in oklab, ${color} 9%, transparent)`, aspectRatio: "1 / 1" }}
          initial={false}
          animate={{ height: `${ringH}%` }}
          transition={{ type: "spring", stiffness: 160, damping: 22 }}
        />
        <motion.div
          className="absolute rounded-full"
          style={{ backgroundColor: color, aspectRatio: "1 / 1" }}
          initial={{ height: "6%", opacity: 0.35 }}
          animate={{ height: `${ringH}%`, opacity: 0 }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeOut" }}
        />
        <span className="relative flex size-3.5 items-center justify-center rounded-full ring-4 ring-card" style={{ backgroundColor: color }} />
      </div>

      {/* Crew pins */}
      {crew.map((person, i) => {
        if (person.mapX == null || person.mapY == null) return null;
        const at = pinAt(person, i, crew.length);
        const pin = (
          <motion.div
            initial={{ opacity: 0, scale: 0.4, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: [0, -4, 0] }}
            transition={{
              opacity: { delay: 0.3 + i * 0.07 },
              scale: { delay: 0.3 + i * 0.07, type: "spring", stiffness: 400, damping: 18 },
              y: { duration: 3 + (i % 3), repeat: Infinity, ease: "easeInOut", delay: i * 0.2 },
            }}
            className="flex flex-col items-center"
          >
            <span className="rounded-full p-0.5 shadow-lift" style={{ backgroundColor: person.color }}>
              <PersonAvatar person={person} size="sm" />
            </span>
            <span className="-mt-1 size-2 rotate-45 rounded-[2px]" style={{ backgroundColor: person.color }} />
          </motion.div>
        );
        return (
          <div
            key={person.id}
            className="absolute -translate-x-1/2 -translate-y-full"
            style={{ left: `${at.left}%`, top: `${at.top}%` }}
          >
            {interactive ? (
              <Tooltip>
                <TooltipTrigger render={<Link href={`/crew/${person.id}`} aria-label={person.name} />}>{pin}</TooltipTrigger>
                <TooltipContent>
                  <span className="font-semibold">{person.name}</span>
                  <span className="opacity-70">· {person.status === "idle" ? `idle, last fix ${timeAgo(person.lastSeenAt)}` : `±${person.accuracy} m`}</span>
                </TooltipContent>
              </Tooltip>
            ) : (
              pin
            )}
          </div>
        );
      })}

      <div className="absolute bottom-3 left-3 rounded-full bg-card/90 px-2.5 py-1 text-[11px] font-bold text-muted-foreground shadow-card backdrop-blur">
        Geofence · {radius} m
      </div>
    </div>
  );
}
