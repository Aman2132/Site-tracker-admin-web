"use client";

import { CheckCircle2, Loader2, ShieldCheck, TriangleAlert } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { CONFIRM_RESET_WORD, describeTotals, type ResetTotals } from "@/lib/reset";
import type { ResetProgress, ResetReport } from "@/lib/resetClient";

/** Step two: the final list, and the word to type before anything is deleted. */
export function ResetReviewStep({
  totals,
  typed,
  onTyped,
}: {
  totals: ResetTotals;
  typed: string;
  onTyped: (typed: string) => void;
}) {
  const lines: [number, string][] = [
    [totals.people, "people and their sign-ins"],
    [totals.sites, "sites"],
    [totals.photos, "photos (file, thumbnail and record)"],
    [totals.records, "other records (check-ins, inventory, activity, page views, audit entries)"],
  ];
  return (
    <div className="mx-auto w-full max-w-xl space-y-5 p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-danger-soft text-danger">
          <TriangleAlert className="size-5" />
        </span>
        <div>
          <h3 className="text-lg font-bold tracking-tight">This will permanently delete</h3>
          <p className="text-sm text-muted-foreground">It can&apos;t be undone and there is no backup.</p>
        </div>
      </div>
      <ul className="divide-y rounded-xl border">
        {lines
          .filter(([count]) => count > 0)
          .map(([count, label]) => (
            <li key={label} className="flex items-baseline gap-3 px-4 py-3">
              <span className="w-14 text-right text-lg font-bold tabular-nums text-danger">{count}</span>
              <span className="text-sm">{label}</span>
            </li>
          ))}
      </ul>
      <p className="flex items-start gap-2 rounded-xl bg-muted p-3 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
        Admin and superadmin sign-ins and profiles stay, and so does anything you left unticked.
      </p>
      <div className="space-y-1.5">
        <label htmlFor="reset-confirm" className="text-sm font-medium">
          Type <b>{CONFIRM_RESET_WORD}</b> to confirm ({describeTotals(totals)})
        </label>
        <Input id="reset-confirm" value={typed} onChange={event => onTyped(event.target.value)} autoComplete="off" autoFocus />
      </div>
    </div>
  );
}

/** Step three: a progress bar while the server works. Can't be closed. */
export function ResetRunStep({ progress }: { progress: ResetProgress }) {
  const percent = progress.total === 0 ? 100 : Math.round((progress.done / progress.total) * 100);
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-5 p-8 text-center">
      <Loader2 className="size-9 animate-spin text-primary" />
      <div>
        <h3 className="text-lg font-bold tracking-tight">{progress.label}…</h3>
        <p className="mt-1 text-sm text-muted-foreground">Keep this window open until it finishes.</p>
      </div>
      <Progress value={percent} className="w-full" />
      <p className="text-sm tabular-nums text-muted-foreground">
        {progress.done} of {progress.total} · {percent}%
      </p>
    </div>
  );
}

/** Step four: what was deleted, and anything that wasn't. */
export function ResetDoneStep({ report }: { report: ResetReport }) {
  const { deleted, failed } = report;
  return (
    <div className="mx-auto w-full max-w-xl space-y-5 p-6">
      <div className="flex items-start gap-3">
        <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${failed.length ? "bg-danger-soft text-danger" : "bg-success-soft text-success"}`}>
          {failed.length ? <TriangleAlert className="size-5" /> : <CheckCircle2 className="size-5" />}
        </span>
        <div>
          <h3 className="text-lg font-bold tracking-tight">{failed.length ? "Finished, with problems" : "All clean"}</h3>
          <p className="text-sm text-muted-foreground">{describeTotals({ ...deleted, records: deleted.records }) || "Nothing was deleted."} deleted.</p>
        </div>
      </div>
      {failed.length > 0 && (
        <div className="space-y-2 rounded-xl border border-danger/30 bg-danger-soft/40 p-4">
          <p className="text-sm font-semibold">{failed.length} could not be deleted. Close this and press Reset again to retry them.</p>
          <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-muted-foreground">
            {failed.slice(0, 20).map(failure => (
              <li key={`${failure.what}-${failure.id}`}>
                <span className="font-semibold">{failure.what}</span> {failure.id}: {failure.reason}
              </li>
            ))}
            {failed.length > 20 && <li>…and {failed.length - 20} more.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
