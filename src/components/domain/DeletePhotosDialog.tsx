"use client";

import { Loader2, Trash2, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

/**
 * Confirmation before photos are removed for good. States plainly what goes:
 * the file, its thumbnail AND the record, so nobody expects only the list entry
 * to disappear.
 */
export function DeletePhotosDialog({
  count,
  busy,
  onConfirm,
  onCancel,
}: {
  /** How many photos are about to be deleted; 0 keeps the dialog closed. */
  count: number;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={count > 0} onOpenChange={open => !open && !busy && onCancel()}>
      <DialogContent className="gap-0 rounded-xl p-0 sm:max-w-[440px]">
        <div className="space-y-4 p-6">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-danger-soft text-danger">
              <TriangleAlert className="size-5" />
            </span>
            <div>
              <DialogTitle className="text-lg font-semibold">
                Delete {count} {count === 1 ? "photo" : "photos"} permanently?
              </DialogTitle>
              <DialogDescription className="mt-1">
                This removes each photo&apos;s <b>file</b>, its <b>thumbnail</b> and its <b>record</b>. It can&apos;t be undone.
              </DialogDescription>
            </div>
          </div>
          <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            A worker&apos;s phone keeps its own saved copy; that isn&apos;t touched.
          </p>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" size="lg" className="flex-1" onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" size="lg" className="flex-1" onClick={onConfirm} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Trash2 />} Delete
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
