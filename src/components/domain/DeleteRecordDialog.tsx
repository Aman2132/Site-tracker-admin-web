"use client";

import { Loader2, Trash2, TriangleAlert } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface DeleteRecordDialogProps {
  open: boolean;
  title: string;
  /** Typed to enable the delete button: the person's or site's name. */
  confirmWord: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** What will be removed and what will stay. */
  children: ReactNode;
}

/**
 * Confirmation before a person or a site is removed for good. The delete button
 * stays off until the name is typed, so it can't be hit by accident.
 */
export function DeleteRecordDialog({ open, onCancel, busy, ...body }: DeleteRecordDialogProps) {
  return (
    <Dialog open={open} onOpenChange={next => !next && !busy && onCancel()}>
      <DialogContent className="gap-0 rounded-xl p-0 sm:max-w-[460px]">
        <ConfirmBody busy={busy} onCancel={onCancel} {...body} />
      </DialogContent>
    </Dialog>
  );
}

/** Mounted only while the dialog is open, so the typed text starts empty every time. */
function ConfirmBody({
  title,
  confirmWord,
  busy,
  onConfirm,
  onCancel,
  children,
}: Omit<DeleteRecordDialogProps, "open">) {
  const [typed, setTyped] = useState("");
  const matches = typed.trim().toLowerCase() === confirmWord.trim().toLowerCase();

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-danger-soft text-danger">
          <TriangleAlert className="size-5" />
        </span>
        <div>
          <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
          <DialogDescription className="mt-1">It can&apos;t be undone.</DialogDescription>
        </div>
      </div>
      <div className="space-y-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground">{children}</div>
      <div className="space-y-1.5">
        <label htmlFor="delete-confirm" className="text-sm font-medium">
          Type <b>{confirmWord}</b> to confirm
        </label>
        <Input id="delete-confirm" value={typed} onChange={event => setTyped(event.target.value)} autoComplete="off" disabled={busy} />
      </div>
      <div className="flex gap-2 pt-1">
        <Button variant="outline" size="lg" className="flex-1" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button variant="destructive" size="lg" className="flex-1" onClick={onConfirm} disabled={busy || !matches}>
          {busy ? <Loader2 className="animate-spin" /> : <Trash2 />} Delete
        </Button>
      </div>
    </div>
  );
}
