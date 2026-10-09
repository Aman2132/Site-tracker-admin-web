"use client";

import { useState } from "react";
import { toast } from "sonner";

import { DeletePhotosDialog } from "@/components/domain/DeletePhotosDialog";
import { Lightbox } from "@/components/domain/Lightbox";
import { attempt, useLiveStore } from "@/lib/store";

import type { SitePhoto } from "@/types/domain";

/** The photo viewer with its Delete button wired up, for views that don't have Photos' multi-select. */
export function DeletableLightbox({
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
  const { deletePhotos } = useLiveStore();
  const [pending, setPending] = useState<SitePhoto[]>([]);
  const [deleting, setDeleting] = useState(false);

  const confirm = async () => {
    setDeleting(true);
    const outcome = await attempt("Deleting photos", () => deletePhotos(pending), {
      targetType: "photo",
      targetId: pending.length === 1 ? pending[0].id : undefined,
      note: `${pending.length} photo(s)`,
    });
    setDeleting(false);
    setPending([]);
    if (!outcome) return;
    const { deleted, failed } = outcome.value;
    if (deleted.length) {
      toast.success("Photo deleted", { description: "File, thumbnail and record are all gone." });
      onClose();
    }
    if (failed.length) toast.error("Could not be deleted", { description: failed[0].reason });
  };

  return (
    <>
      <Lightbox photos={photos} openId={openId} onClose={onClose} onChange={onChange} onDelete={photo => setPending([photo])} />
      <DeletePhotosDialog count={pending.length} busy={deleting} onConfirm={confirm} onCancel={() => setPending([])} />
    </>
  );
}
