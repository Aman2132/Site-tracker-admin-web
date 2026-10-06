"use client";

import { Building2, Check, Loader2, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { NewSiteInput } from "@/lib/admin";
import { attempt, useLiveStore } from "@/lib/store";
import { cn } from "@/lib/utils";

import { ChoiceChip, Field, TextInput } from "./FormBits";
import { PersonAvatar } from "./PersonAvatar";

const SITE_COLORS = ["#1c4ff0", "#0f9d58", "#a142f4", "#e2670f", "#12b5cb", "#d93025"];

/** A site is a name, a status and its crew — it has no location of its own. */
export function CreateSiteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const { crew, sites, createSite } = useLiveStore();
  const [form, setForm] = useState<NewSiteInput>({
    name: "",
    manager: "",
    status: "planning",
    color: SITE_COLORS[sites.length % SITE_COLORS.length],
    crewIds: [],
  });
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof NewSiteInput>(key: K, value: NewSiteInput[K]) => setForm(f => ({ ...f, [key]: value }));
  const nameError = form.name.trim().length < 3 ? "Give the site a name your crew will recognise" : undefined;
  const assignable = crew.filter(c => c.status !== "deactivated");

  const submit = async () => {
    if (nameError) {
      setTouched(true);
      return;
    }
    setBusy(true);
    const result = await attempt("Creating the site", () => createSite({ ...form, name: form.name.trim(), manager: form.manager.trim() }));
    setBusy(false);
    if (!result) return;
    toast.success(`${form.name.trim()} created`, {
      description: form.crewIds.length ? `${form.crewIds.length} crew assigned.` : "Assign crew from the site page.",
      action: { label: "Open", onClick: () => router.push(`/sites/${result.value}`) },
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-[560px]">
        <div className="max-h-[88dvh] space-y-5 overflow-y-auto p-6 sm:p-7 scrollbar-thin">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-hero text-white shadow-glow">
              <Building2 className="size-5" />
            </span>
            <div>
              <DialogTitle className="text-lg font-extrabold">Create a site</DialogTitle>
              <DialogDescription>A project and the crew who work on it. You can change both later.</DialogDescription>
            </div>
          </div>

          <Field label="Site name" htmlFor="site-name" error={touched ? nameError : undefined}>
            <TextInput
              id="site-name"
              autoFocus
              placeholder="e.g. Sector 75 · Phase 2"
              value={form.name}
              invalid={touched && !!nameError}
              onChange={e => set("name", e.target.value)}
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Status">
              <div className="flex flex-wrap gap-2">
                {(["planning", "active"] as const).map(s => (
                  <ChoiceChip key={s} selected={form.status === s} onClick={() => set("status", s)}>
                    {s === "planning" ? "Planning" : "Active"}
                  </ChoiceChip>
                ))}
              </div>
            </Field>
            <Field label="Site manager (optional)" htmlFor="site-manager">
              <TextInput id="site-manager" placeholder="Name" value={form.manager} onChange={e => set("manager", e.target.value)} />
            </Field>
          </div>

          <Field label={`Assign crew${form.crewIds.length ? ` · ${form.crewIds.length} selected` : ""}`}>
            <div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto scrollbar-thin">
              {assignable.length === 0 && <p className="text-sm text-muted-foreground">No crew yet — add people from the Crew page.</p>}
              {assignable.map(person => {
                const selected = form.crewIds.includes(person.id);
                return (
                  <motion.button
                    key={person.id}
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    onClick={() => set("crewIds", selected ? form.crewIds.filter(id => id !== person.id) : [...form.crewIds, person.id])}
                    aria-pressed={selected}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm font-semibold transition-colors",
                      selected ? "border-primary bg-accent text-accent-foreground" : "border-border bg-card hover:border-primary/40"
                    )}
                  >
                    <span className="relative">
                      <PersonAvatar person={person} size="xs" />
                      <AnimatePresence>
                        {selected && (
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            className="absolute inset-0 flex items-center justify-center rounded-full bg-primary text-white"
                          >
                            <Check className="size-3" strokeWidth={3.5} />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </span>
                    {person.name.split(" ")[0]}
                  </motion.button>
                );
              })}
            </div>
          </Field>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" size="lg" className="flex-1 rounded-xl" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button size="lg" className="flex-1 rounded-xl shadow-glow" onClick={submit} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Sparkles />} Create site
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
