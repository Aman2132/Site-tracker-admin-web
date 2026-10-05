"use client";

import { AlertTriangle, Building2, Check, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { useDemoStore, type NewSiteInput } from "@/lib/store";
import { cn } from "@/lib/utils";

import { ChoiceChip, Field, TextInput } from "./FormBits";
import { PersonAvatar } from "./PersonAvatar";
import { SiteMap } from "./SiteMap";

const CITIES = ["Noida", "Gurugram", "New Delhi", "Faridabad", "Ghaziabad"];
const MANAGERS = ["Rakesh Bansal", "Sunita Rao"];
/** Below this, normal GPS drift causes false arrive/leave readings (same rule as the mobile app). */
const DRIFT_SAFE_RADIUS = 80;

export function CreateSiteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const { crew, addSite } = useDemoStore();
  const [form, setForm] = useState<NewSiteInput>({
    name: "",
    address: "",
    city: "Noida",
    radius: 150,
    manager: MANAGERS[0],
    status: "planning",
    crewIds: [],
  });
  const [touched, setTouched] = useState(false);

  const set = <K extends keyof NewSiteInput>(key: K, value: NewSiteInput[K]) => setForm(f => ({ ...f, [key]: value }));
  const nameError = form.name.trim().length < 3 ? "Give the site a name your crew will recognise" : undefined;
  const assignable = crew.filter(c => c.status !== "deactivated");

  const submit = () => {
    if (nameError) {
      setTouched(true);
      return;
    }
    const site = addSite(form);
    toast.success(`${site.name} created`, {
      description: form.crewIds.length ? `${form.crewIds.length} crew assigned.` : "Assign crew from the site page.",
      action: { label: "Open", onClick: () => router.push(`/sites/${site.id}`) },
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-[920px]">
        <div className="grid max-h-[88dvh] overflow-y-auto md:grid-cols-[1fr_380px] scrollbar-thin">
          <div className="space-y-5 p-6 sm:p-7">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-hero text-white shadow-glow">
                <Building2 className="size-5" />
              </span>
              <div>
                <DialogTitle className="text-lg font-extrabold">Create a site</DialogTitle>
                <DialogDescription>Set the geofence and who works there. You can change all of it later.</DialogDescription>
              </div>
            </div>

            <Field label="Site name" htmlFor="site-name" error={touched ? nameError : undefined}>
              <TextInput
                id="site-name"
                autoFocus
                placeholder="e.g. Noida Sector 75 · Phase 2"
                value={form.name}
                invalid={touched && !!nameError}
                onChange={e => set("name", e.target.value)}
              />
            </Field>
            <Field label="Address" htmlFor="site-address">
              <TextInput id="site-address" placeholder="Plot, sector, landmark" value={form.address} onChange={e => set("address", e.target.value)} />
            </Field>
            <Field label="City">
              <div className="flex flex-wrap gap-2">
                {CITIES.map(c => (
                  <ChoiceChip key={c} selected={form.city === c} onClick={() => set("city", c)}>
                    {c}
                  </ChoiceChip>
                ))}
              </div>
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
              <Field label="Site manager">
                <div className="flex flex-wrap gap-2">
                  {MANAGERS.map(m => (
                    <ChoiceChip key={m} selected={form.manager === m} onClick={() => set("manager", m)}>
                      {m.split(" ")[0]}
                    </ChoiceChip>
                  ))}
                </div>
              </Field>
            </div>

            <Field label={`Assign crew${form.crewIds.length ? ` · ${form.crewIds.length} selected` : ""}`}>
              <div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto scrollbar-thin">
                {assignable.map(person => {
                  const selected = form.crewIds.includes(person.id);
                  return (
                    <motion.button
                      key={person.id}
                      type="button"
                      whileTap={{ scale: 0.95 }}
                      onClick={() =>
                        set("crewIds", selected ? form.crewIds.filter(id => id !== person.id) : [...form.crewIds, person.id])
                      }
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
          </div>

          {/* Live geofence preview */}
          <div className="flex flex-col gap-4 border-t border-border bg-muted/40 p-6 md:border-t-0 md:border-l sm:p-7">
            <div className="text-xs font-bold tracking-[0.14em] text-faint uppercase">Geofence preview</div>
            <SiteMap radius={form.radius} color="var(--primary)" className="w-full" aspect={4 / 3} interactive={false} />
            <div>
              <div className="mb-3 flex items-baseline justify-between">
                <span className="text-sm font-semibold">Radius</span>
                <span className="text-2xl font-extrabold tracking-tight tabular-nums">
                  {form.radius}
                  <span className="ml-0.5 text-sm font-bold text-muted-foreground">m</span>
                </span>
              </div>
              <Slider
                min={40}
                max={400}
                step={10}
                value={[form.radius]}
                onValueChange={v => set("radius", Array.isArray(v) ? v[0] : (v as number))}
              />
              <div className="mt-2 flex justify-between text-[11px] font-semibold text-faint">
                <span>40 m</span>
                <span>400 m</span>
              </div>
            </div>
            <AnimatePresence initial={false}>
              {form.radius < DRIFT_SAFE_RADIUS && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex gap-2.5 rounded-xl bg-warning-soft p-3 text-xs font-medium text-warning">
                    <AlertTriangle className="size-4 shrink-0" />
                    Under {DRIFT_SAFE_RADIUS} m, normal GPS drift will cause false arrive/leave events.
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="mt-auto flex gap-2 pt-2">
              <Button variant="outline" size="lg" className="flex-1 rounded-xl" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button size="lg" className="flex-1 rounded-xl shadow-glow" onClick={submit}>
                <Sparkles /> Create site
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
