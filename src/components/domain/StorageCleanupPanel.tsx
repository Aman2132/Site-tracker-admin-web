"use client";

import { CheckCircle2, Eye, Loader2, Trash2, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { auditLine, AGE_CHOICES, CONFIRM_WORD, confirmMatches, DEFAULT_AGE_DAYS, KIND_INFO, type CleanupKind, type CleanupPreview, type CleanupResult } from "@/lib/cleanup";
import { previewCleanup, runCleanup } from "@/lib/cleanupApi";
import { attempt } from "@/lib/store";
import { formatBytes } from "@/lib/usage";
import { refreshStorageUsage } from "@/lib/useStorageUsage";

import { TextInput } from "./FormBits";
import { SegmentedControl } from "./SegmentedControl";

const KINDS: CleanupKind[] = ["photos", "orphans", "events", "sessions", "inventory", "views"];

interface Row {
  days: number;
  busy: boolean;
  progress: number | null;
  preview: CleanupPreview | null;
  result: CleanupResult | null;
  error: string | null;
}

const blank = (): Row => ({ days: DEFAULT_AGE_DAYS, busy: false, progress: null, preview: null, result: null, error: null });

const sizeText = (p: CleanupPreview) => (p.bytes == null ? "" : ` · ${p.bytesExact ? "" : "about "}${formatBytes(p.bytes)} freed`);

/**
 * Superadmin-only bulk cleanup. Nothing is deleted until a preview has shown
 * what would go and the person has typed DELETE. Deletion happens in the
 * database and the file store (not just on screen); afterwards the data is
 * looked up again and the result says how many records are left.
 */
export function StorageCleanupPanel() {
  const [rows, setRows] = useState<Record<CleanupKind, Row>>(() => Object.fromEntries(KINDS.map(k => [k, blank()])) as Record<CleanupKind, Row>);
  const [confirming, setConfirming] = useState<CleanupKind | null>(null);
  const [typed, setTyped] = useState("");

  const patch = (kind: CleanupKind, change: Partial<Row>) => setRows(prev => ({ ...prev, [kind]: { ...prev[kind], ...change } }));
  const daysFor = (kind: CleanupKind) => (KIND_INFO[kind].usesAge ? rows[kind].days : null);

  const preview = async (kind: CleanupKind) => {
    patch(kind, { busy: true, error: null, result: null, preview: null });
    try {
      patch(kind, { preview: await previewCleanup(kind, daysFor(kind)), busy: false });
    } catch (e) {
      patch(kind, { busy: false, error: e instanceof Error ? e.message : "Couldn't check." });
    }
  };

  const run = async (kind: CleanupKind) => {
    const row = rows[kind];
    const before = row.preview;
    setConfirming(null);
    setTyped("");
    patch(kind, { busy: true, progress: 0, error: null, result: null });
    const outcome = await attempt(
      `Cleanup: ${KIND_INFO[kind].title.toLowerCase()}`,
      () => runCleanup(kind, daysFor(kind), progress => patch(kind, { progress })),
      result => ({
        label: auditLine(result, daysFor(kind), before?.bytes != null ? `${before.bytesExact ? "" : "about "}${formatBytes(before.bytes)}` : null),
        targetType: "cleanup",
        note: result.failed.length ? `${result.failed.length} failed; ${result.remaining} left` : `${result.remaining} left after the run`,
      })
    );
    patch(kind, { busy: false, progress: null, result: outcome?.value ?? null, preview: null });
    void refreshStorageUsage();
  };

  const target = confirming ? rows[confirming] : null;
  const info = confirming ? KIND_INFO[confirming] : null;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger-soft p-3.5 text-sm">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" />
        <p>
          <b>Deleting here is permanent.</b> It removes the data from the database and the file store, not just from this screen, and it can&apos;t be
          undone. Every run is recorded in the audit log.
        </p>
      </div>

      {KINDS.map(kind => {
        const row = rows[kind];
        const k = KIND_INFO[kind];
        return (
          <div key={kind} className="rounded-xl border border-border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{k.title}</div>
                <p className="mt-0.5 text-sm text-muted-foreground">{k.removes}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Frees {k.frees} space.</p>
              </div>
              {k.usesAge && (
                <SegmentedControl
                  size="sm"
                  options={AGE_CHOICES.map(d => ({ value: String(d), label: `${d}d` }))}
                  value={String(row.days)}
                  onChange={v => patch(kind, { days: Number(v), preview: null, result: null })}
                />
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" className="rounded-lg" onClick={() => void preview(kind)} disabled={row.busy}>
                {row.busy && row.progress == null ? <Loader2 className="animate-spin" /> : <Eye />} Preview
              </Button>
              {row.preview && (
                <>
                  <span className="text-sm">
                    <b>{row.preview.count.toLocaleString()}</b> {kind === "orphans" ? "files" : "records"} would be deleted{sizeText(row.preview)}
                  </span>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="ml-auto rounded-lg"
                    disabled={row.busy || row.preview.count === 0}
                    onClick={() => {
                      setTyped("");
                      setConfirming(kind);
                    }}
                  >
                    <Trash2 /> Delete…
                  </Button>
                </>
              )}
              {row.busy && row.progress != null && (
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Deleting… {row.progress.toLocaleString()} so far
                </span>
              )}
            </div>

            {row.error && <p className="mt-2 text-sm font-medium text-danger">{row.error}</p>}
            {row.result && (
              <p className={`mt-2 flex items-start gap-1.5 text-sm ${row.result.remaining === 0 && row.result.failed.length === 0 ? "text-success" : "text-danger"}`}>
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                <span>
                  Deleted {row.result.deleted.toLocaleString()}.{" "}
                  {row.result.remaining === 0 && row.result.failed.length === 0
                    ? "Checked again: none left."
                    : `${row.result.remaining.toLocaleString()} still left${row.result.failed.length ? `; ${row.result.failed.length} failed (${row.result.failed[0].reason})` : ""}.`}
                </span>
              </p>
            )}
          </div>
        );
      })}

      <Dialog open={confirming != null} onOpenChange={open => !open && setConfirming(null)}>
        <DialogContent className="gap-0 rounded-xl p-0 sm:max-w-[480px]">
          {confirming && info && target?.preview && (
            <div className="space-y-4 p-6">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-danger-soft text-danger">
                  <TriangleAlert className="size-5" />
                </span>
                <div>
                  <DialogTitle className="text-lg font-semibold">
                    Delete {target.preview.count.toLocaleString()} {confirming === "orphans" ? "files" : "records"} permanently?
                  </DialogTitle>
                  <DialogDescription className="mt-1">
                    {info.title}
                    {info.usesAge ? `, older than ${target.days} days` : ""}
                    {sizeText(target.preview)}.
                  </DialogDescription>
                </div>
              </div>
              <p className="rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm font-medium text-danger">{info.loses}</p>
              {confirming === "photos" && (
                <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                  Each photo&apos;s file, thumbnail and record are all removed. A worker&apos;s phone keeps its own saved copy; that isn&apos;t touched.
                </p>
              )}
              <label className="block space-y-1.5 text-sm">
                <span>
                  Type <b>{CONFIRM_WORD}</b> to confirm
                </span>
                <TextInput value={typed} onChange={e => setTyped(e.target.value)} autoFocus placeholder={CONFIRM_WORD} aria-label="Type DELETE to confirm" />
              </label>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="lg" className="flex-1" onClick={() => setConfirming(null)}>
                  Cancel
                </Button>
                <Button variant="destructive" size="lg" className="flex-1" disabled={!confirmMatches(typed)} onClick={() => void run(confirming)}>
                  <Trash2 /> Delete permanently
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
