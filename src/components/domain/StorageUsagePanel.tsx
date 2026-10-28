"use client";

import { Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatBytes, formatLimit, formatShare, LIMITS, share } from "@/lib/usage";
import { useStorageUsage } from "@/lib/useStorageUsage";
import { cn } from "@/lib/utils";

/** Bar colour by how full it is: calm, then a warning, then danger. */
const tone = (fraction: number) => (fraction >= 0.9 ? "bg-danger" : fraction >= 0.7 ? "bg-warning" : "bg-primary");

function Meter({ label, detail, bytes, limit, note }: { label: string; detail: string; bytes: number; limit: number; note?: string }) {
  const fraction = share(bytes, limit);
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-sm font-semibold">{label}</div>
        <div className="text-sm tabular-nums">
          <span className="font-semibold">{formatBytes(bytes)}</span>
          <span className="text-muted-foreground"> of {formatLimit(limit)} · {formatShare(fraction)}</span>
        </div>
      </div>
      <div
        className="h-2.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fraction * 100)}
      >
        <div className={cn("h-full rounded-full transition-[width]", tone(fraction))} style={{ width: `${Math.max(fraction * 100, bytes > 0 ? 1 : 0)}%` }} />
      </div>
      <div className="text-xs text-muted-foreground">{detail}</div>
      {note && <div className="text-xs text-muted-foreground">{note}</div>}
    </div>
  );
}

/** Opening the page re-reads if the shared numbers are over 5 minutes old (the sidebar keeps them within the hour). */
const PAGE_MAX_AGE_MS = 5 * 60 * 1000;

/**
 * How much of the free allowances the project uses: Firestore documents and the
 * live-position database (estimated, because Firebase doesn't expose exact
 * stored size to an app), and the photo files (exact, from the file store).
 */
export function StorageUsagePanel() {
  const { firebaseUsage, files, filesError, error, busy, at, refresh } = useStorageUsage(PAGE_MAX_AGE_MS);

  const visible = firebaseUsage?.collections.filter(c => !c.unavailable) ?? [];
  const biggest = [...visible].sort((a, b) => b.bytes - a.bytes).slice(0, 5);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Free-plan allowances. {at ? `Checked ${new Date(at).toLocaleTimeString()}.` : busy ? "Checking…" : ""}
        </p>
        <Button variant="outline" size="sm" className="rounded-lg" onClick={() => void refresh()} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <RefreshCw />} Refresh
        </Button>
      </div>

      {error && <p className="text-sm font-medium text-danger">{error}</p>}

      {firebaseUsage && (
        <>
          <Meter
            label="Firestore (crew, sites, check-ins, photo records, inventory, activity)"
            detail={`${visible.reduce((n, c) => n + c.count, 0).toLocaleString()} documents · estimated`}
            bytes={firebaseUsage.firestoreBytes}
            limit={LIMITS.firestoreBytes}
            note="An estimate from document counts and sizes, including indexes. Exact figure: Firebase console → Firestore → Usage."
          />
          <Meter
            label="Realtime Database (live positions)"
            detail="Where each crew member is right now · estimated"
            bytes={firebaseUsage.realtimeBytes}
            limit={LIMITS.realtimeBytes}
          />
        </>
      )}

      {files ? (
        <Meter
          label="Photo files (originals and thumbnails)"
          detail={`${files.files.toLocaleString()} files · exact`}
          bytes={files.bytes}
          limit={LIMITS.photoFilesBytes}
          note="Deleting a photo from the Photos tab frees this space."
        />
      ) : (
        filesError && <p className="text-sm text-muted-foreground">Photo files: {filesError}</p>
      )}

      {biggest.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Largest in Firestore</div>
          <table className="w-full text-sm">
            <tbody>
              {biggest.map(c => (
                <tr key={c.name} className="border-t border-border">
                  <td className="py-1.5 font-medium">{c.name}</td>
                  <td className="py-1.5 text-right tabular-nums text-muted-foreground">{c.count.toLocaleString()} docs</td>
                  <td className="py-1.5 text-right tabular-nums text-muted-foreground">~{formatBytes(c.avgBytes)} each</td>
                  <td className="py-1.5 text-right font-semibold tabular-nums">{formatBytes(c.bytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {firebaseUsage && <p className="mt-1.5 text-xs text-muted-foreground">This check read about {firebaseUsage.reads} documents.</p>}
        </div>
      )}
    </div>
  );
}
