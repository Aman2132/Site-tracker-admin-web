"use client";

import { Clock, Loader2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { SessionChanges } from "@/lib/admin";
import { fromLocalInput, sessionTimesProblem, TZ_LABEL, toLocalInput } from "@/lib/time";

import type { PresenceSession, Site } from "@/types/domain";

import { ChoiceChip, Field, TextInput } from "./FormBits";

/** firestore.rules caps an audit note at 500 characters. */
const NOTE_MAX = 500;

/**
 * Correct one check-in/check-out. The note goes to the superadmin's audit log
 * only; the session itself just gets marked as corrected.
 */
export function SessionEditDialog({
  session,
  sites,
  personName,
  now,
  onSave,
  onClose,
}: {
  /** null = closed. */
  session: PresenceSession | null;
  sites: Site[];
  personName: string;
  now: number;
  /** Resolves true when saved. */
  onSave: (changes: SessionChanges, note: string) => Promise<boolean>;
  onClose: () => void;
}) {
  return (
    <Dialog open={session != null} onOpenChange={open => !open && onClose()}>
      <DialogContent className="gap-0 overflow-hidden rounded-xl p-0 sm:max-w-[520px]">
        {session && (
          <SessionForm key={session.id} session={session} sites={sites} personName={personName} now={now} onSave={onSave} onClose={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function SessionForm({
  session,
  sites,
  personName,
  now,
  onSave,
  onClose,
}: {
  session: PresenceSession;
  sites: Site[];
  personName: string;
  now: number;
  onSave: (changes: SessionChanges, note: string) => Promise<boolean>;
  onClose: () => void;
}) {
  // A "timeout" end is only an estimate (never stored), so the session is really still open.
  const storedEnd = session.endReason === "timeout" ? undefined : session.end;
  const [start, setStart] = useState(toLocalInput(session.start));
  const [end, setEnd] = useState(storedEnd != null ? toLocalInput(storedEnd) : "");
  const [siteId, setSiteId] = useState(session.siteId);
  const [note, setNote] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const changes: SessionChanges = { start: fromLocalInput(start), siteId, ...(end ? { end: fromLocalInput(end) } : {}) };
    const issue = sessionTimesProblem(changes.start, changes.end, Date.now()) ?? (siteId ? null : "Pick a site.");
    setProblem(issue);
    if (issue) return;
    setBusy(true);
    const saved = await onSave(changes, note);
    setBusy(false);
    if (saved) onClose();
  };

  const maxInput = toLocalInput(now);

  return (
    <div className="max-h-[88dvh] space-y-5 overflow-y-auto p-6 scrollbar-thin">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-primary">
          <Clock className="size-5" />
        </span>
        <div>
          <DialogTitle className="text-lg font-semibold">Edit check-in / check-out</DialogTitle>
          <DialogDescription>{personName} · times in {TZ_LABEL}</DialogDescription>
        </div>
      </div>

      <Field label="Site">
        <div className="flex flex-wrap gap-2">
          {sites.map(s => (
            <ChoiceChip key={s.id} selected={siteId === s.id} onClick={() => setSiteId(s.id)}>
              {s.name}
            </ChoiceChip>
          ))}
        </div>
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Checked in" htmlFor="session-start">
          <TextInput id="session-start" type="datetime-local" max={maxInput} value={start} onChange={e => setStart(e.target.value)} />
        </Field>
        <Field label="Checked out" htmlFor="session-end" hint="Leave empty if still on shift.">
          <TextInput id="session-end" type="datetime-local" max={maxInput} value={end} onChange={e => setEnd(e.target.value)} />
        </Field>
      </div>

      <Field label="Reason (optional)" htmlFor="session-note" hint="Only the superadmin sees this, in the audit log.">
        <Textarea
          id="session-note"
          rows={3}
          maxLength={NOTE_MAX}
          placeholder="e.g. Forgot to check out, confirmed by supervisor"
          value={note}
          onChange={e => setNote(e.target.value)}
          className="rounded-lg bg-card"
        />
      </Field>

      {problem && <p className="text-sm font-medium text-danger">{problem}</p>}

      <div className="flex gap-2 pt-1">
        <Button variant="outline" size="lg" className="flex-1 rounded-lg" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button size="lg" className="flex-1 rounded-lg" onClick={submit} disabled={busy}>
          {busy && <Loader2 className="animate-spin" />} Save changes
        </Button>
      </div>
    </div>
  );
}
