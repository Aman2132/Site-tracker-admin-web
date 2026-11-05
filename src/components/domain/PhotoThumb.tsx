"use client";

import { Check, Download, Play } from "lucide-react";
import { toast } from "sonner";
import { downloadPhotoFile } from "@/lib/photoDownload";
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
  priority = false,
  selecting = false,
  selected = false,
  onToggle,
}: {
  photo: SitePhoto;
  onOpen: (photo: SitePhoto) => void;
  className?: string;
  showMeta?: boolean;
  index?: number;
  priority?: boolean;
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
    <motion.div
      role="button"
      tabIndex={0}
      onClick={() => (selecting && onToggle ? onToggle(photo) : onOpen(photo))}
      onKeyDown={e => {
        if (e.key === "Enter" || e.key === " ") {
          if (e.target === e.currentTarget) {
            e.preventDefault();
            if (selecting && onToggle) onToggle(photo);
            else onOpen(photo);
          }
        }
      }}
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: Math.min(index, 18) * 0.03 }}
      whileHover="hover"
      className="group flex w-full cursor-pointer flex-col justify-start rounded-lg text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      aria-label={`${photo.task} by ${person?.name ?? "unknown"}`}
      title={site?.name ?? "No site"}
    >
      {/* `className` sizes the image (aspect ratio); the caption sits below it, never over the photo. */}
      <div className={cn("relative overflow-hidden rounded-lg bg-muted", selected && "ring-2 ring-primary", className)}>
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
                onLoadedData={() => setLoaded(prev => (prev ? prev : true))}
                className="absolute inset-0 size-full object-cover"
              />
            ) : (
              <Image
                src={photo.thumbUrl}
                alt={photo.task}
                fill
                sizes="(min-width: 1280px) 20vw, (min-width: 768px) 33vw, 50vw"
                priority={priority}
                onLoad={() => setLoaded(prev => (prev ? prev : true))}
                className={cn(
                  "object-cover transition-[filter,opacity] duration-700",
                  loaded ? "blur-0 opacity-100" : "scale-105 opacity-0 blur-md"
                )}
              />
            )}
          </motion.div>
        </motion.div>
        {!loaded && <div className="shimmer absolute inset-0 bg-muted" />}

        <div className="pointer-events-none absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/10" />

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
          <span className="absolute bottom-2 left-2 z-10 rounded-full bg-warning/90 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs backdrop-blur-xs">
            ±{photo.accuracy} m
          </span>
        )}

        <button
          type="button"
          aria-label="Download photo"
          title="Download photo"
          onClick={async e => {
            e.stopPropagation();
            try {
              toast.loading("Downloading photo…", { id: `dl-${photo.id}` });
              await downloadPhotoFile(photo);
              toast.success("Photo downloaded", { id: `dl-${photo.id}` });
            } catch {
              toast.error("Download failed", { id: `dl-${photo.id}` });
            }
          }}
          className="absolute top-2 right-2 z-20 flex size-7 items-center justify-center rounded-lg bg-black/60 text-white opacity-0 shadow-sm backdrop-blur-xs transition hover:scale-110 hover:bg-black/85 group-hover:opacity-100"
        >
          <Download className="size-3.5" />
        </button>

      </div>

      {showMeta && (
        <div className="px-0.5 pt-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-semibold transition-colors group-hover:text-primary">{photo.task}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {timeAgo(photo.takenAt) === "just now" ? formatTime(photo.takenAt) : timeAgo(photo.takenAt)}
            </span>
          </div>
          {photo.note && <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{photo.note}</div>}
          <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            {person && <PersonAvatar person={person} size="xs" />}
            <span className="min-w-0 truncate">{person?.name ?? "Unknown"}</span>
          </div>
        </div>
      )}
    </motion.div>
  );
}
