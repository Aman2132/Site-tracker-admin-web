"use client";

import { Check, MapPin, Play } from "lucide-react";
import { motion } from "motion/react";
import Image from "next/image";
import { useState } from "react";

import { formatDuration, formatTime, timeAgo } from "@/lib/format";
import { useLookups } from "@/lib/store";
import { cn } from "@/lib/utils";

import type { SitePhoto } from "@/types/domain";

import { PersonAvatar } from "./PersonAvatar";

/**
 * Grid cell. Loads the small thumbnail only; the full-resolution file is
 * fetched when the lightbox opens. Shares a layoutId with the lightbox
 * image so opening it zooms from this exact spot.
 */
export function PhotoThumb({
  photo,
  onOpen,
  className,
  showMeta = true,
  index = 0,
  selecting = false,
  selected = false,
  onToggle,
}: {
  photo: SitePhoto;
  onOpen: (photo: SitePhoto) => void;
  className?: string;
  showMeta?: boolean;
  index?: number;
  /** In selection mode a click toggles the photo instead of opening it. */
  selecting?: boolean;
  selected?: boolean;
  onToggle?: (photo: SitePhoto) => void;
}) {
  const { personById, siteById } = useLookups();
  const [loaded, setLoaded] = useState(false);
  const person = personById.get(photo.personId);
  const site = siteById.get(photo.siteId);

  return (
    <motion.button
      type="button"
      onClick={() => (selecting && onToggle ? onToggle(photo) : onOpen(photo))}
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: Math.min(index, 18) * 0.03 }}
      whileHover="hover"
      className={cn(
        "group relative block w-full overflow-hidden rounded-lg bg-muted text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        selected && "ring-2 ring-primary",
        className
      )}
      aria-label={`${photo.task} by ${person?.name ?? "unknown"}`}
    >
      <motion.div layoutId={`photo-${photo.id}`} className="absolute inset-0">
        <motion.div
          className="absolute inset-0"
          variants={{ hover: { scale: 1.06 } }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          {photo.mediaType === "video" && photo.thumbUrl === photo.fullUrl ? (
            // Videos have no preview image; the first frame of the clip stands in.
            <video
              src={`${photo.fullUrl}#t=0.1`}
              preload="metadata"
              muted
              playsInline
              onLoadedData={() => setLoaded(true)}
              className="absolute inset-0 size-full object-cover"
            />
          ) : (
            <Image
              src={photo.thumbUrl}
              alt={photo.task}
              fill
              sizes="(min-width: 1280px) 20vw, (min-width: 768px) 33vw, 50vw"
              onLoad={() => setLoaded(true)}
              className={cn(
                "object-cover transition-[filter,opacity] duration-700",
                loaded ? "blur-0 opacity-100" : "scale-105 opacity-0 blur-md"
              )}
            />
          )}
        </motion.div>
      </motion.div>
      {!loaded && <div className="shimmer absolute inset-0 bg-muted" />}

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent opacity-80 transition-opacity duration-300 group-hover:opacity-100" />

      {selecting && (
        <span
          className={cn(
            "absolute top-2.5 left-2.5 z-10 flex size-6 items-center justify-center rounded-md border-2",
            selected ? "border-primary bg-primary text-primary-foreground" : "border-white bg-black/30"
          )}
        >
          {selected && <Check className="size-4" strokeWidth={3} />}
        </span>
      )}
      {photo.mediaType === "video" && (
        <span
          className={cn(
            "absolute top-3 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur",
            selecting ? "left-11" : "left-3"
          )}
        >
          <Play className="size-3 fill-white" /> {formatDuration(photo.durationMs ?? 0)}
        </span>
      )}
      {photo.accuracy > 20 && (
        <span className="absolute top-3 right-3 rounded-full bg-warning px-2 py-0.5 text-[10px] font-bold text-white">
          ±{photo.accuracy} m
        </span>
      )}

      {showMeta && (
        <div className="absolute inset-x-0 bottom-0 p-3 text-white">
          <div className="truncate text-sm font-bold drop-shadow">{photo.task}</div>
          {photo.note && <div className="mt-0.5 line-clamp-2 text-[11px] text-white/85">{photo.note}</div>}
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-white/80">
            {person && <PersonAvatar person={person} size="xs" className="[&>span]:ring-0" />}
            <span className="truncate">{person?.name.split(" ")[0]}</span>
            <span className="size-0.5 rounded-full bg-white/60" />
            <span className="truncate">{timeAgo(photo.takenAt) === "just now" ? formatTime(photo.takenAt) : timeAgo(photo.takenAt)}</span>
          </div>
          <motion.div
            className="flex items-center gap-1 overflow-hidden text-[11px] text-white/75"
            initial={{ height: 0, opacity: 0 }}
            variants={{ hover: { height: 18, opacity: 1 } }}
          >
            <MapPin className="size-3" />
            <span className="truncate">{site?.name ?? "No site"}</span>
          </motion.div>
        </div>
      )}
    </motion.button>
  );
}
