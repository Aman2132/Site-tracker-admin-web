"use client";

import { RotateCcw } from "lucide-react";
import { useState } from "react";

import { ResetDataDialog } from "@/components/domain/reset/ResetDataDialog";
import { Button } from "@/components/ui/button";

/** The Storage page's entry to the full reset: a short explanation and the button that opens the window. */
export function ResetDataPanel() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <p className="max-w-md text-sm text-muted-foreground">
        Delete everything in the app — crew accounts, sites, photos, check-ins and logs — so it can start fresh. Admin and superadmin sign-ins and
        profiles stay. You choose what goes.
      </p>
      <Button variant="destructive" size="lg" className="rounded-xl" onClick={() => setOpen(true)}>
        <RotateCcw /> Reset all data
      </Button>
      <ResetDataDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
