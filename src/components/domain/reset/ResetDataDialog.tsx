"use client";

import { Loader2, RotateCcw, ShieldCheck, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ResetDoneStep, ResetReviewStep, ResetRunStep } from "@/components/domain/reset/ResetFinishSteps";
import { ResetSelectStep, type ResetGroup } from "@/components/domain/reset/ResetSelectStep";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { describeFields } from "@/lib/auditLog";
import {
  CONFIRM_RESET_WORD,
  describeTotals,
  isNothingSelected,
  selectEverything,
  totalsFor,
  type ResetPreview,
  type ResetSelection,
} from "@/lib/reset";
import { executeReset, fetchResetPreview, type ResetProgress, type ResetReport } from "@/lib/resetClient";
import { attempt } from "@/lib/store";

type Stage =
  | { name: "loading" }
  | { name: "failed"; message: string }
  | { name: "select"; preview: ResetPreview; selection: ResetSelection }
  | { name: "review"; preview: ResetPreview; selection: ResetSelection }
  | { name: "running"; progress: ResetProgress }
  | { name: "done"; report: ResetReport };

/**
 * The superadmin's "Reset all data" window: pick what to delete (everything
 * starts ticked), review, type DELETE, watch it run. The admin and superadmin
 * sign-ins and profiles are never offered for deletion. The server does the
 * deleting and re-checks that the caller is the superadmin on every request.
 */
export function ResetDataDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [stage, setStage] = useState<Stage>({ name: "loading" });
  const [active, setActive] = useState<ResetGroup>("people");
  const [typed, setTyped] = useState("");
  /** Bumped to read the data again (on open, and after a reset). */
  const [reload, setReload] = useState(0);

  const running = stage.name === "running";

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const preview = await fetchResetPreview();
        if (!cancelled) setStage({ name: "select", preview, selection: selectEverything(preview) });
      } catch (error) {
        if (!cancelled) setStage({ name: "failed", message: error instanceof Error ? error.message : "Couldn't read the data." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, reload]);

  const close = () => {
    if (running) return;
    setTyped("");
    setStage({ name: "loading" });
    onClose();
  };

  const startReset = async (preview: ResetPreview, selection: ResetSelection) => {
    setStage({ name: "running", progress: { label: "Starting", done: 0, total: 0 } });
    const outcome = await attempt(
      "Reset all data",
      () => executeReset(preview, selection, progress => setStage({ name: "running", progress })),
      report => ({
        changes: describeFields([{ label: "deleted", value: describeTotals({ ...report.deleted, records: report.deleted.records }) }]),
        note: report.failed.length ? `${report.failed.length} could not be deleted` : undefined,
      })
    );
    setTyped("");
    if (!outcome) {
      // Stopped part-way (for example the connection dropped): what is already deleted stays deleted. Show what is left.
      setStage({ name: "loading" });
      setReload(count => count + 1);
      return;
    }
    toast.success("Reset finished");
    setStage({ name: "done", report: outcome.value });
  };

  const selecting = stage.name === "select" ? stage : null;
  const reviewing = stage.name === "review" ? stage : null;
  const current = selecting ?? reviewing;
  const totals = current ? totalsFor(current.preview, current.selection) : null;

  return (
    <Dialog open={open} onOpenChange={next => !next && close()}>
      <DialogContent
        showCloseButton={!running}
        className="flex h-[min(46rem,calc(100dvh-2rem))] w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-5xl"
      >
        <header className="flex items-start gap-3 border-b px-5 py-4 pr-12 sm:px-6">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-danger-soft text-danger">
            <RotateCcw className="size-5" />
          </span>
          <div className="min-w-0">
            <DialogTitle className="text-lg font-bold tracking-tight">Reset all data</DialogTitle>
            <DialogDescription className="mt-0.5 flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 shrink-0 text-primary" />
              Admin and superadmin sign-ins and profiles are always kept.
            </DialogDescription>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {stage.name === "loading" && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-muted-foreground">
              <Loader2 className="size-7 animate-spin" />
              <p className="text-sm">Looking at what is in the database…</p>
            </div>
          )}
          {stage.name === "failed" && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
              <TriangleAlert className="size-8 text-danger" />
              <p className="max-w-md text-sm">{stage.message}</p>
              <Button variant="outline" onClick={() => { setStage({ name: "loading" }); setReload(count => count + 1); }}>
                Try again
              </Button>
            </div>
          )}
          {selecting && (
            <ResetSelectStep
              preview={selecting.preview}
              selection={selecting.selection}
              active={active}
              onActive={setActive}
              onChange={selection => setStage({ name: "select", preview: selecting.preview, selection })}
            />
          )}
          {reviewing && totals && <ResetReviewStep totals={totals} typed={typed} onTyped={setTyped} />}
          {stage.name === "running" && <ResetRunStep progress={stage.progress} />}
          {stage.name === "done" && <ResetDoneStep report={stage.report} />}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/40 px-5 py-3.5 sm:px-6">
          <p className="min-w-0 text-sm text-muted-foreground">
            {totals ? (isNothingSelected(totals) ? "Nothing selected." : <>Will delete <b className="text-foreground">{describeTotals(totals)}</b></>) : ""}
          </p>
          <div className="flex gap-2">
            {selecting && totals && (
              <>
                <Button variant="outline" size="lg" onClick={close}>
                  Cancel
                </Button>
                <Button variant="destructive" size="lg" disabled={isNothingSelected(totals)} onClick={() => setStage({ name: "review", preview: selecting.preview, selection: selecting.selection })}>
                  Review and delete
                </Button>
              </>
            )}
            {reviewing && (
              <>
                <Button variant="outline" size="lg" onClick={() => { setTyped(""); setStage({ name: "select", preview: reviewing.preview, selection: reviewing.selection }); }}>
                  Back
                </Button>
                <Button
                  variant="destructive"
                  size="lg"
                  disabled={typed.trim() !== CONFIRM_RESET_WORD}
                  onClick={() => void startReset(reviewing.preview, reviewing.selection)}
                >
                  Delete everything selected
                </Button>
              </>
            )}
            {stage.name === "done" && (
              <Button size="lg" onClick={close}>
                Close
              </Button>
            )}
            {stage.name === "failed" && (
              <Button variant="outline" size="lg" onClick={close}>
                Close
              </Button>
            )}
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
