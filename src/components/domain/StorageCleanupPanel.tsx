"use client";

import { CheckCircle2, Eye, Loader2, Trash2, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  CLEANUP_PRESETS,
  CONFIRM_WORD,
  KIND_INFO,
  auditLine,
  confirmMatches,
  type CleanupKind,
  type CleanupPreview,
  type CleanupResult,
} from "@/lib/cleanup";
import { previewCleanup, runCleanup, type CleanupParam } from "@/lib/cleanupApi";
import { DAY } from "@/lib/time";
import { attempt } from "@/lib/store";
import { formatBytes } from "@/lib/usage";
import { refreshStorageUsage } from "@/lib/useStorageUsage";

import { TextInput } from "./FormBits";
import { SegmentedControl } from "./SegmentedControl";

const KINDS: CleanupKind[] = ["photos", "orphans", "events", "sessions", "inventory", "views"];

type ScopeMode = "preset" | "beforeDate" | "range";

interface Row {
  scopeMode: ScopeMode;
  preset: string; // "1h" | "1d" | "7d" | "30d" | "90d" | "180d" | "365d"
  singleDate: string; // YYYY-MM-DD
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  busy: boolean;
  progress: number | null;
  preview: CleanupPreview | null;
  result: CleanupResult | null;
  error: string | null;
}

function toDateInputString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const now = new Date();
const defaultThirtyDaysAgo = toDateInputString(new Date(now.getTime() - 30 * DAY));
const defaultToday = toDateInputString(now);

const blank = (): Row => ({
  scopeMode: "preset",
  preset: "90d",
  singleDate: defaultThirtyDaysAgo,
  startDate: defaultThirtyDaysAgo,
  endDate: defaultToday,
  busy: false,
  progress: null,
  preview: null,
  result: null,
  error: null,
});

const sizeText = (p: CleanupPreview) => (p.bytes == null ? "" : ` · ${p.bytesExact ? "" : "about "}${formatBytes(p.bytes)} freed`);

function resolveCleanupParam(row: Row): CleanupParam {
  const currentNow = Date.now();
  if (row.scopeMode === "preset") {
    const preset = CLEANUP_PRESETS.find(p => p.id === row.preset);
    if (!preset) return { before: currentNow - 90 * DAY, label: "older than 90 days" };
    return { before: currentNow - preset.ms, label: `older than ${preset.label}` };
  }

  if (row.scopeMode === "beforeDate") {
    const [y, m, d] = row.singleDate.split("-").map(Number);
    const before = new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
    return { before, label: `older than ${row.singleDate}` };
  }

  // Range
  const [sy, sm, sd] = row.startDate.split("-").map(Number);
  const [ey, em, ed] = row.endDate.split("-").map(Number);
  const after = new Date(sy, sm - 1, sd, 0, 0, 0, 0).getTime();
  const before = new Date(ey, em - 1, ed, 23, 59, 59, 999).getTime();
  return { before, after, label: `between ${row.startDate} and ${row.endDate}` };
}

/**
 * Superadmin-only bulk cleanup. Flexible time scoping (1 hour, 24h, presets, custom date, or date range).
 * Nothing is deleted until a preview has shown what would go and the person has typed DELETE.
 */
export function StorageCleanupPanel() {
  const [rows, setRows] = useState<Record<CleanupKind, Row>>(() => Object.fromEntries(KINDS.map(k => [k, blank()])) as Record<CleanupKind, Row>);
  const [confirming, setConfirming] = useState<CleanupKind | null>(null);
  const [typed, setTyped] = useState("");

  const patch = (kind: CleanupKind, change: Partial<Row>) => setRows(prev => ({ ...prev, [kind]: { ...prev[kind], ...change } }));
  const paramFor = (kind: CleanupKind) => (KIND_INFO[kind].usesAge ? resolveCleanupParam(rows[kind]) : null);

  const preview = async (kind: CleanupKind) => {
    patch(kind, { busy: true, error: null, result: null, preview: null });
    try {
      const param = paramFor(kind);
      const res = await previewCleanup(kind, param);
      patch(kind, { preview: res, busy: false });
    } catch (e) {
      patch(kind, { busy: false, error: e instanceof Error ? e.message : "Couldn't check." });
    }
  };

  const run = async (kind: CleanupKind) => {
    const row = rows[kind];
    const before = row.preview;
    const param = paramFor(kind);
    const scopeLabel = typeof param === "object" && param ? param.label : row.preset;

    setConfirming(null);
    setTyped("");
    patch(kind, { busy: true, progress: 0, error: null, result: null });
    const outcome = await attempt(
      `Cleanup: ${KIND_INFO[kind].title.toLowerCase()}`,
      () => runCleanup(kind, param, progress => patch(kind, { progress })),
      result => ({
        label: auditLine(result, scopeLabel ?? null, before?.bytes != null ? `${before.bytesExact ? "" : "about "}${formatBytes(before.bytes)}` : null),
        targetType: "cleanup",
        note: result.failed.length ? `${result.failed.length} failed; ${result.remaining} left` : `${result.remaining} left after the run`,
      })
    );
    patch(kind, { busy: false, progress: null, result: outcome?.value ?? null, preview: null });
    void refreshStorageUsage();
  };

  const target = confirming ? rows[confirming] : null;
  const info = confirming ? KIND_INFO[confirming] : null;
  const targetScope = confirming ? paramFor(confirming) : null;
  const targetScopeLabel = typeof targetScope === "object" && targetScope ? targetScope.label : target ? target.preset : "";

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
        const isCustom = row.scopeMode !== "preset";

        return (
          <div key={kind} className="rounded-xl border border-border p-4 transition-colors">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{k.title}</div>
                <p className="mt-0.5 text-sm text-muted-foreground">{k.removes}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Frees {k.frees} space.</p>
              </div>

              {k.usesAge && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <SegmentedControl
                    size="sm"
                    options={[
                      { value: "1h", label: "1h" },
                      { value: "1d", label: "24h" },
                      { value: "7d", label: "7d" },
                      { value: "30d", label: "30d" },
                      { value: "90d", label: "90d" },
                      { value: "custom", label: "Calendar 📅" },
                    ]}
                    value={isCustom ? "custom" : row.preset}
                    onChange={v => {
                      if (v === "custom") {
                        patch(kind, { scopeMode: "beforeDate", preview: null, result: null, error: null });
                      } else {
                        patch(kind, { scopeMode: "preset", preset: v, preview: null, result: null, error: null });
                      }
                    }}
                  />
                </div>
              )}
            </div>

            {/* Custom Calendar controls */}
            {k.usesAge && isCustom && (
              <div className="mt-3.5 rounded-xl border border-border bg-card/60 p-3.5 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Button
                      variant={row.scopeMode === "beforeDate" ? "default" : "outline"}
                      size="sm"
                      className="h-8 rounded-lg text-xs"
                      onClick={() => patch(kind, { scopeMode: "beforeDate", preview: null, result: null })}
                    >
                      Older than date
                    </Button>
                    <Button
                      variant={row.scopeMode === "range" ? "default" : "outline"}
                      size="sm"
                      className="h-8 rounded-lg text-xs"
                      onClick={() => patch(kind, { scopeMode: "range", preview: null, result: null })}
                    >
                      Date range (from — to)
                    </Button>
                  </div>

                  <span className="text-xs font-semibold text-muted-foreground">
                    {(() => { const p = paramFor(kind); return typeof p === "object" && p && "label" in p ? p.label : ""; })()}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                  {row.scopeMode === "beforeDate" ? (
                    <label className="flex items-center gap-2 font-medium">
                      <span>Cutoff date:</span>
                      <input
                        type="date"
                        value={row.singleDate}
                        max={defaultToday}
                        onChange={e => patch(kind, { singleDate: e.target.value, preview: null, result: null })}
                        className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs text-foreground outline-hidden focus:ring-2 focus:ring-primary/40"
                      />
                    </label>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-2 font-medium">
                        <span>From:</span>
                        <input
                          type="date"
                          value={row.startDate}
                          max={row.endDate || defaultToday}
                          onChange={e => patch(kind, { startDate: e.target.value, preview: null, result: null })}
                          className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs text-foreground outline-hidden focus:ring-2 focus:ring-primary/40"
                        />
                      </label>
                      <label className="flex items-center gap-2 font-medium">
                        <span>To:</span>
                        <input
                          type="date"
                          value={row.endDate}
                          min={row.startDate}
                          max={defaultToday}
                          onChange={e => patch(kind, { endDate: e.target.value, preview: null, result: null })}
                          className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs text-foreground outline-hidden focus:ring-2 focus:ring-primary/40"
                        />
                      </label>
                    </div>
                  )}
                </div>
              </div>
            )}

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
              <p
                className={`mt-2 flex items-start gap-1.5 text-sm ${
                  row.result.remaining === 0 && row.result.failed.length === 0 ? "text-success" : "text-danger"
                }`}
              >
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                <span>
                  Deleted {row.result.deleted.toLocaleString()}.{" "}
                  {row.result.remaining === 0 && row.result.failed.length === 0
                    ? "Checked again: none left in scope."
                    : `${row.result.remaining.toLocaleString()} still left${
                        row.result.failed.length ? `; ${row.result.failed.length} failed (${row.result.failed[0].reason})` : ""
                      }.`}
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
                    {info.usesAge ? ` (${targetScopeLabel})` : ""}
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
                <TextInput
                  value={typed}
                  onChange={e => setTyped(e.target.value)}
                  autoFocus
                  placeholder={CONFIRM_WORD}
                  aria-label="Type DELETE to confirm"
                />
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
