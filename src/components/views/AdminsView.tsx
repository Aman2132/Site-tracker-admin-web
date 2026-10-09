"use client";

import { Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { useAdmin } from "@/components/auth/AuthProvider";
import { SuperadminOnly } from "@/components/auth/AuthGate";
import { PageHeader } from "@/components/domain/PageHeader";
import { PersonAvatar } from "@/components/domain/PersonAvatar";
import { StatusChip } from "@/components/domain/StatusDot";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { roleLabel } from "@/lib/format";
import { attempt, useLiveStore } from "@/lib/store";

import type { CrewMember } from "@/types/domain";

const ROLE_ORDER = { superadmin: 0, owner: 1, worker: 2 } as const;

export function AdminsView() {
  return (
    <SuperadminOnly>
      <Admins />
    </SuperadminOnly>
  );
}

function Admins() {
  const { crew, setAppRole } = useLiveStore();
  const me = useAdmin().uid;
  const [pending, setPending] = useState<CrewMember | null>(null);
  const [busy, setBusy] = useState(false);

  const rows = useMemo(
    () => [...crew].sort((a, b) => ROLE_ORDER[a.appRole] - ROLE_ORDER[b.appRole] || a.name.localeCompare(b.name)),
    [crew]
  );

  const grant = pending?.appRole === "worker";
  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    const role = grant ? "owner" : "worker";
    const done = await attempt(grant ? "Granting admin" : "Revoking admin", () => setAppRole(pending.id, role), {
      targetType: "person",
      targetId: pending.id,
    });
    setBusy(false);
    if (!done) return;
    toast.success(grant ? `${pending.name} is now an admin` : `${pending.name} is now a worker`, {
      description: "Takes effect next time they open the app or dashboard.",
    });
    setPending(null);
  };

  return (
    <>
      <PageHeader title="Admins" description="Who can use the dashboard and the owner screens in the app. Only you can change this." />

      <div className="surface overflow-hidden rounded-2xl">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-bold tracking-wide text-muted-foreground uppercase">
                <th className="px-5 py-3.5">Person</th>
                <th className="px-3 py-3.5">Role</th>
                <th className="px-3 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Access</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(p => {
                const locked = p.id === me || p.appRole === "superadmin";
                return (
                  <tr key={p.id} className="border-b border-border/70 last:border-0">
                    <td className="px-5 py-3">
                      <Link href={`/crew/${p.id}`} className="group flex items-center gap-3">
                        <PersonAvatar person={p} size="md" />
                        <div className="min-w-0">
                          <div className="truncate font-bold group-hover:text-primary">{p.name}</div>
                          <div className="truncate text-xs text-muted-foreground">{p.email || p.jobTitle}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-3 py-3 font-semibold">{roleLabel(p.appRole)}</td>
                    <td className="px-3 py-3">
                      <StatusChip status={p.status} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button
                        variant={p.appRole === "worker" ? "outline" : "ghost"}
                        size="sm"
                        className="rounded-lg"
                        disabled={locked}
                        title={locked ? "The superadmin role can't be changed here." : undefined}
                        onClick={() => setPending(p)}
                      >
                        {p.appRole === "worker" ? <ShieldCheck /> : <ShieldOff />}
                        {p.appRole === "worker" ? "Grant admin" : "Revoke admin"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={pending != null} onOpenChange={open => !open && !busy && setPending(null)}>
        <DialogContent className="rounded-xl p-6 sm:max-w-[440px]">
          <DialogTitle className="text-lg font-semibold">
            {grant ? `Make ${pending?.name} an admin?` : `Remove ${pending?.name}'s admin access?`}
          </DialogTitle>
          <DialogDescription>
            {grant
              ? "Admins see everyone on the map, every photo, can manage sites and crew, and can use this dashboard."
              : "They lose the dashboard and the owner screens, and get the worker app."}
          </DialogDescription>
          <div className="mt-2 flex gap-2">
            <Button variant="outline" size="lg" className="flex-1 rounded-lg" onClick={() => setPending(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant={grant ? "default" : "destructive"} size="lg" className="flex-1 rounded-lg" onClick={confirm} disabled={busy}>
              {busy && <Loader2 className="animate-spin" />} {grant ? "Grant admin" : "Revoke admin"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
