"use client";

import { useState } from "react";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, TextInput } from "./FormBits";
import { attempt, useLiveStore } from "@/lib/store";
import { describeChanges } from "@/lib/auditLog";
import type { CrewMember } from "@/types/domain";

interface EditCrewDialogProps {
  person: CrewMember | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditCrewDialog({ person, open, onOpenChange }: EditCrewDialogProps) {
  if (!person) return null;
  return <EditCrewForm key={person.id} person={person} open={open} onOpenChange={onOpenChange} />;
}

function EditCrewForm({
  person,
  open,
  onOpenChange,
}: {
  person: CrewMember;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { updatePersonDetails } = useLiveStore();
  const [jobTitle, setJobTitle] = useState(person.jobTitle || "");
  const [team, setTeam] = useState(person.team || "");
  const [email, setEmail] = useState(person.email || "");
  const [phone, setPhone] = useState(person.phone || "");
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    const changes = describeChanges([
      { label: "role", before: person.jobTitle, after: jobTitle.trim() },
      { label: "team", before: person.team, after: team.trim() },
      { label: "email", before: person.email, after: email.trim() },
      { label: "phone", before: person.phone, after: phone.trim() },
    ]);

    const success = await attempt(
      "Updating crew details",
      () =>
        updatePersonDetails(person.id, {
          role: jobTitle.trim(),
          team: team.trim(),
          email: email.trim(),
          phone: phone.trim(),
        }),
      { targetType: "person", targetId: person.id, changes }
    );
    setBusy(false);

    if (success) {
      toast.success("Crew details updated", {
        description: `Updated contact info and details for ${person.name}.`,
      });
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-[480px]">
        <DialogHeader className="border-b border-border p-6">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-primary">
              <Pencil className="size-5" />
            </span>
            <div>
              <DialogTitle className="text-lg font-semibold">Edit {person.name}</DialogTitle>
              <DialogDescription>Update contact information, job title, and team.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={save}>
          <div className="space-y-4 p-6">
            <Field label="Email address" htmlFor="edit-crew-email" hint="Contact email for notifications and set-password invites">
              <TextInput
                id="edit-crew-email"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </Field>

            <Field label="Phone number" htmlFor="edit-crew-phone" hint="Mobile contact number">
              <TextInput
                id="edit-crew-phone"
                type="tel"
                placeholder="+977 98xxx xxxxx"
                value={phone}
                onChange={e => setPhone(e.target.value)}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Job title" htmlFor="edit-crew-job">
                <TextInput
                  id="edit-crew-job"
                  placeholder="e.g. Mason, Helper"
                  value={jobTitle}
                  onChange={e => setJobTitle(e.target.value)}
                />
              </Field>

              <Field label="Team" htmlFor="edit-crew-team">
                <TextInput
                  id="edit-crew-team"
                  placeholder="e.g. Crew A"
                  value={team}
                  onChange={e => setTeam(e.target.value)}
                />
              </Field>
            </div>
          </div>

          <DialogFooter className="flex-row border-t border-border p-6">
            <Button type="button" variant="outline" size="lg" className="flex-1 rounded-xl" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="lg" className="flex-1 rounded-xl" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
