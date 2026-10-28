"use client";

import { Check, Lock } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";
import type { ResetPhoto } from "@/lib/reset";

/** How many thumbnails are drawn at a time; "Show more" adds the next page. */
const PAGE = 120;

/**
 * The photos that can be deleted, as a grid of thumbnails you tick. A photo
 * that belongs to a ticked person or site is ticked and locked: it goes with
 * them whatever its own box says.
 */
export function ResetPhotoGrid({
  photos,
  selected,
  forced,
  onToggle,
}: {
  photos: ResetPhoto[];
  selected: Set<string>;
  /** Photos that go because their person or site is ticked. */
  forced: Set<string>;
  onToggle: (id: string) => void;
}) {
  const [shown, setShown] = useState(PAGE);

  if (photos.length === 0) return <p className="py-10 text-center text-sm text-muted-foreground">There are no photos.</p>;

  return (
    <div>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {photos.slice(0, shown).map(photo => {
          const locked = forced.has(photo.id);
          const checked = locked || selected.has(photo.id);
          return (
            <li key={photo.id}>
              <button
                type="button"
                disabled={locked}
                onClick={() => onToggle(photo.id)}
                aria-pressed={checked}
                aria-label={locked ? "Goes with its person or site" : checked ? "Keep this photo" : "Delete this photo"}
                title={locked ? "Goes with its person or site" : undefined}
                className={cn(
                  "group relative block aspect-square w-full overflow-hidden rounded-lg bg-muted outline-none ring-offset-2 transition focus-visible:ring-2 focus-visible:ring-ring",
                  !checked && "opacity-60 hover:opacity-100",
                  locked && "cursor-not-allowed"
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.thumbUrl} alt="" loading="lazy" className="size-full object-cover" />
                <span
                  className={cn(
                    "absolute top-1.5 left-1.5 flex size-5 items-center justify-center rounded-md border text-white shadow-sm",
                    checked ? "border-danger bg-danger" : "border-white/80 bg-black/30"
                  )}
                >
                  {locked ? <Lock className="size-3" /> : checked ? <Check className="size-3.5" /> : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {shown < photos.length && (
        <button
          type="button"
          onClick={() => setShown(count => count + PAGE)}
          className="mx-auto mt-4 block rounded-lg px-4 py-2 text-sm font-semibold text-primary hover:bg-accent"
        >
          Show {Math.min(PAGE, photos.length - shown)} more ({photos.length - shown} not shown)
        </button>
      )}
    </div>
  );
}
