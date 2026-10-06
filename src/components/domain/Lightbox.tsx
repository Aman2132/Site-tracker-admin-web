"use client";

import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Crosshair,
  Download,
  Hash,
  MapPin,
  Play,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { Button, buttonVariants } from "@/components/ui/button";
import { formatCoord, formatDateTime, formatDuration } from "@/lib/format";
import { useLookups } from "@/lib/store";
import { useMounted } from "@/lib/useMounted";
import { cn } from "@/lib/utils";

import type { SitePhoto } from "@/types/domain";

import { PersonAvatar } from "./PersonAvatar";

/** Accuracy at/under this is precise enough not to flag (same as the app's GEOTAG_ACCURACY.goodMeters). */
const GOOD_ACCURACY_M = 20;

/**
 * Full-screen viewer. Shows the already-loaded thumbnail instantly (shared
 * layout zoom from the grid), then swaps in the full-resolution file once
 * it arrives. Arrow keys move, Esc closes.
 */
export function Lightbox({
  photos,
  openId,
  onClose,
  onChange,
}: {
  photos: SitePhoto[];
  openId: string | null;
  onClose: () => void;
  onChange: (id: string) => void;
}) {
  const mounted = useMounted();
  const index = photos.findIndex(p => p.id === openId);
  const photo = index >= 0 ? photos[index] : null;

  const step = useCallback(
    (delta: number) => {
      if (index < 0) return;
      const next = photos[(index + delta + photos.length) % photos.length];
      onChange(next.id);
    },
    [index, photos, onChange]
  );

  useEffect(() => {
    if (!photo) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [photo, onClose, step]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {photo && (
        <motion.div
          key="lightbox"
          className="fixed inset-0 z-50 flex flex-col bg-[color-mix(in_oklab,var(--ink)_94%,transparent)] backdrop-blur-md lg:flex-row"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          role="dialog"
          aria-modal="true"
          aria-label={photo.task}
        >
          <div className="relative flex min-h-0 flex-1 items-center justify-center p-4 sm:p-10" onClick={onClose}>
            <FullImage key={photo.id} photo={photo} />

            <div className="absolute top-4 left-4 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80 backdrop-blur">
              {index + 1} / {photos.length}
            </div>
            <NavButton side="left" onClick={() => step(-1)} />
            <NavButton side="right" onClick={() => step(1)} />
          </div>

          <MetaPanel photo={photo} onClose={onClose} />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

function FullImage({ photo }: { photo: SitePhoto }) {
  const [fullLoaded, setFullLoaded] = useState(false);
  const ratio = photo.width / photo.height;
  if (photo.mediaType === "video") {
    return (
      <motion.div
        layoutId={`photo-${photo.id}`}
        className="relative max-h-full overflow-hidden rounded-2xl bg-black shadow-2xl"
        style={{ aspectRatio: ratio, height: ratio < 1 ? "100%" : undefined, width: ratio >= 1 ? "min(100%, 1200px)" : undefined }}
        onClick={e => e.stopPropagation()}
      >
        <video key={photo.id} src={photo.fullUrl} controls autoPlay playsInline className="size-full object-contain" />
      </motion.div>
    );
  }
  return (
    <motion.div
      layoutId={`photo-${photo.id}`}
      className="relative max-h-full overflow-hidden rounded-2xl shadow-2xl"
      style={{ aspectRatio: ratio, height: ratio < 1 ? "100%" : undefined, width: ratio >= 1 ? "min(100%, 1200px)" : undefined }}
      transition={{ type: "spring", stiffness: 260, damping: 30 }}
      onClick={e => e.stopPropagation()}
    >
      {/* Thumbnail is already cached by the grid, so it paints instantly. */}
      <Image src={photo.thumbUrl} alt="" fill sizes="100vw" className="object-cover" priority />
      <Image
        src={photo.fullUrl}
        alt={photo.task}
        fill
        sizes="100vw"
        onLoad={() => setFullLoaded(true)}
        className={cn("object-cover transition-opacity duration-500", fullLoaded ? "opacity-100" : "opacity-0")}
      />
      <AnimatePresence>
        {!fullLoaded && (
          <motion.div
            exit={{ opacity: 0 }}
            className="absolute right-3 bottom-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur"
          >
            Loading full resolution…
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function NavButton({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={side === "left" ? "Previous photo" : "Next photo"}
      onClick={e => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "absolute top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/15 backdrop-blur transition hover:scale-105 hover:bg-white/20",
        side === "left" ? "left-4" : "right-4"
      )}
    >
      <Icon className="size-5" />
    </button>
  );
}

function MetaPanel({ photo, onClose }: { photo: SitePhoto; onClose: () => void }) {
  const { personById, siteById } = useLookups();
  const person = personById.get(photo.personId);
  const site = siteById.get(photo.siteId);
  const precise = photo.accuracy <= GOOD_ACCURACY_M;

  return (
    <motion.aside
      initial={{ x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 40, opacity: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="w-full shrink-0 overflow-y-auto border-t border-white/10 bg-card p-6 text-card-foreground lg:w-[380px] lg:border-t-0 lg:border-l"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold tracking-[0.14em] text-faint uppercase">{photo.mediaType === "video" ? "Video" : "Photo"}</div>
          <h2 className="mt-1 text-xl font-extrabold tracking-tight">{photo.task}</h2>
        </div>
        <Button variant="ghost" size="icon-lg" className="rounded-xl" onClick={onClose} aria-label="Close">
          <X />
        </Button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={photo.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="mt-6 space-y-5"
        >
          {person && (
            <Link
              href={`/crew/${person.id}`}
              className="flex items-center gap-3 rounded-2xl border border-border p-3 transition-colors hover:border-primary/40 hover:bg-accent/40"
            >
              <PersonAvatar person={person} size="md" showStatus />
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">Taken by</div>
                <div className="truncate font-bold">{person.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {[person.jobTitle, person.team].filter(Boolean).join(" · ")}
                </div>
              </div>
            </Link>
          )}

          <dl className="space-y-3.5 text-sm">
            <MetaRow icon={Building2} label="Site">
              {site ? (
                <Link href={`/sites/${site.id}`} className="font-semibold hover:text-primary">
                  {site.name}
                </Link>
              ) : (
                "—"
              )}
            </MetaRow>
            <MetaRow icon={Clock} label="Captured">
              {formatDateTime(photo.takenAt)}
            </MetaRow>
            <MetaRow icon={Crosshair} label="GPS accuracy">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-bold",
                  precise ? "bg-success-soft text-success" : "bg-warning-soft text-warning"
                )}
              >
                ±{photo.accuracy} m · {precise ? "precise" : "check location"}
              </span>
            </MetaRow>
            <MetaRow icon={Hash} label="Plus code">
              <span className="font-mono text-xs font-semibold">{photo.plusCode}</span>
            </MetaRow>
            <MetaRow icon={MapPin} label="Coordinates">
              <span className="font-mono text-xs">
                {formatCoord(photo.lat, photo.lng)}
              </span>
              <a
                href={`https://www.openstreetmap.org/?mlat=${photo.lat}&mlon=${photo.lng}#map=18/${photo.lat}/${photo.lng}`}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block text-xs font-semibold text-primary hover:underline"
              >
                View on map
              </a>
            </MetaRow>
            {photo.mediaType === "video" && (
              <MetaRow icon={Play} label="Length">
                {formatDuration(photo.durationMs ?? 0)}
              </MetaRow>
            )}
          </dl>

          <div className="rounded-2xl bg-muted/70 p-3 text-xs text-muted-foreground">
            GPS is written into the file&apos;s EXIF on the phone at capture, so the location travels with the original.
          </div>

          <a
            href={photo.fullUrl}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ size: "lg" }), "w-full rounded-xl")}
          >
            <Download /> Open original ({photo.width}×{photo.height})
          </a>
        </motion.div>
      </AnimatePresence>
    </motion.aside>
  );
}

function MetaRow({ icon: Icon, label, children }: { icon: typeof MapPin; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <dt className="w-24 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 truncate">{children}</dd>
    </div>
  );
}
