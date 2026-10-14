"use client";

import { ArrowLeft, ArrowRight, Building2, HardHat, Loader2, Mail, MailCheck, ShieldCheck, Sparkles, UserPlus } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";

import { useIsSuperadmin } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { EASE_OUT } from "@/components/motion";
import type { NewCrewInput } from "@/lib/admin";
import { attempt, useLiveStore } from "@/lib/store";
import { cn } from "@/lib/utils";

import { ChoiceChip, Field, SelectCard, TextInput } from "./FormBits";
import { PersonAvatar } from "./PersonAvatar";

const JOB_TITLES = ["Mason", "Helper", "Carpenter", "Electrician", "Plumber", "Welder", "Driver", "Site engineer", "Supervisor"];
const TEAMS = ["Crew A", "Crew B", "Crew C", "Crew D"];
const STEPS = ["Details", "Role", "Sites", "Review"] as const;

const CREW_COLORS = ["#1a73e8", "#188038", "#a142f4", "#f29900", "#d93025", "#12b5cb"];

const EMPTY: NewCrewInput = { name: "", email: "", phone: "", jobTitle: "Mason", team: "Crew A", appRole: "worker", color: CREW_COLORS[0], siteIds: [] };

const slide = {
  enter: (dir: number) => ({ x: dir * 40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir * -40, opacity: 0 }),
};

/**
 * Admin-side crew creation: creates the Firebase account (see admin.ts
 * inviteCrew) and emails a "set your password" link.
 */
export function AddCrewDialog({
  open,
  onOpenChange,
  presetSiteId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presetSiteId?: string;
}) {
  const { sites, crew, inviteCrew } = useLiveStore();
  // Granting admin is superadmin-only (firestore.rules); owners invite workers.
  const isSuperadmin = useIsSuperadmin();
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  // The provider re-keys this component on every open, so initial state is a fresh form.
  const initialForm = () => ({ ...EMPTY, siteIds: presetSiteId ? [presetSiteId] : [] });
  const [form, setForm] = useState<NewCrewInput>(initialForm);
  const [touched, setTouched] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const reset = () => {
    setStep(0);
    setForm(initialForm());
    setTouched(false);
    setDone(null);
  };

  const set = <K extends keyof NewCrewInput>(key: K, value: NewCrewInput[K]) => setForm(f => ({ ...f, [key]: value }));

  const errors = {
    name: form.name.trim().length < 2 ? "Enter the person's full name" : undefined,
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) ? undefined : "Enter a valid email — the invite goes here",
  };
  const stepValid = step !== 0 || (!errors.name && !errors.email);

  const go = (delta: number) => {
    if (delta > 0 && !stepValid) {
      setTouched(true);
      return;
    }
    setDir(delta);
    setStep(s => s + delta);
  };

  const submit = async () => {
    setBusy(true);
    // A rotating colour so neighbours in the list are easy to tell apart.
    const result = await attempt("Creating the account", () =>
      inviteCrew({ ...form, email: form.email.trim(), name: form.name.trim(), color: CREW_COLORS[crew.length % CREW_COLORS.length] }),
      { targetType: "person", note: `${form.name.trim()} <${form.email.trim()}> as ${form.appRole}` }
    );
    setBusy(false);
    if (!result) return;
    setDone(form.email.trim());
    toast.success(`Invite sent to ${form.name}`, { description: `A set-password email is on its way to ${form.email.trim()}.` });
  };

  const toggleSite = (id: string) =>
    set("siteIds", form.siteIds.includes(id) ? form.siteIds.filter(s => s !== id) : [...form.siteIds, id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-[560px]">
        {/* Header with step progress */}
        <div className="border-b border-border px-6 pt-6 pb-5">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-primary">
              <UserPlus className="size-5" />
            </span>
            <div>
              <DialogTitle className="text-lg font-semibold">Add crew member</DialogTitle>
              <DialogDescription className="text-sm">
                They&apos;ll get an email to set a password, then sign in on the app.
              </DialogDescription>
            </div>
          </div>
          {!done && (
            <div className="mt-5 grid grid-cols-4 gap-2">
              {STEPS.map((label, i) => (
                <div key={label}>
                  <div className="h-1 overflow-hidden rounded-full bg-muted">
                    <motion.div
                      className="h-full rounded-full bg-primary"
                      initial={false}
                      animate={{ width: i <= step ? "100%" : "0%" }}
                      transition={{ duration: 0.45, ease: EASE_OUT }}
                    />
                  </div>
                  <div className={cn("mt-1.5 text-[11px] font-semibold", i <= step ? "text-foreground" : "text-faint")}>{label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="relative min-h-[330px] overflow-hidden px-6 py-6">
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            {done ? (
              <SuccessView key="done" email={done} name={form.name} onAnother={reset} onClose={() => onOpenChange(false)} />
            ) : (
              <motion.div
                key={step}
                custom={dir}
                variants={slide}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.28, ease: EASE_OUT }}
                className="space-y-5"
              >
                {step === 0 && (
                  <>
                    <Field label="Full name" htmlFor="crew-name" error={touched ? errors.name : undefined}>
                      <TextInput
                        id="crew-name"
                        autoFocus
                        placeholder="e.g. Sanjay Prajapati"
                        value={form.name}
                        invalid={touched && !!errors.name}
                        onChange={e => set("name", e.target.value)}
                      />
                    </Field>
                    <Field
                      label="Email"
                      htmlFor="crew-email"
                      hint="The set-password link expires after about an hour — you can resend it any time."
                      error={touched ? errors.email : undefined}
                    >
                      <TextInput
                        id="crew-email"
                        type="email"
                        placeholder="name@company.com"
                        value={form.email}
                        invalid={touched && !!errors.email}
                        onChange={e => set("email", e.target.value)}
                      />
                    </Field>
                    <Field label="Phone (optional)" htmlFor="crew-phone">
                      <TextInput id="crew-phone" placeholder="+91 98xxx xxxxx" value={form.phone} onChange={e => set("phone", e.target.value)} />
                    </Field>
                  </>
                )}

                {step === 1 && (
                  <>
                    <div className={cn("grid gap-3", isSuperadmin && "grid-cols-2")}>
                      <SelectCard selected={form.appRole === "worker"} onClick={() => set("appRole", "worker")}>
                        <HardHat className="size-5 text-warning" />
                        <div className="mt-2 font-bold">Worker</div>
                        <p className="mt-0.5 text-xs text-muted-foreground">Shares location, takes geotagged photos.</p>
                      </SelectCard>
                      {isSuperadmin && (
                        <SelectCard selected={form.appRole === "owner"} onClick={() => set("appRole", "owner")}>
                          <ShieldCheck className="size-5 text-primary" />
                          <div className="mt-2 font-bold">Admin</div>
                          <p className="mt-0.5 text-xs text-muted-foreground">Sees everything, manages sites and crew.</p>
                        </SelectCard>
                      )}
                    </div>
                    <Field label="Job title">
                      <div className="flex flex-wrap gap-2">
                        {JOB_TITLES.map(t => (
                          <ChoiceChip key={t} selected={form.jobTitle === t} onClick={() => set("jobTitle", t)}>
                            {t}
                          </ChoiceChip>
                        ))}
                      </div>
                    </Field>
                    <Field label="Team">
                      <div className="flex flex-wrap gap-2">
                        {TEAMS.map(t => (
                          <ChoiceChip key={t} selected={form.team === t} onClick={() => set("team", t)}>
                            {t}
                          </ChoiceChip>
                        ))}
                      </div>
                    </Field>
                  </>
                )}

                {step === 2 && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Pick the sites they work on. Their photos and attendance will be filed under these.
                    </p>
                    <div className="grid max-h-[290px] gap-2.5 overflow-y-auto pr-1 scrollbar-thin">
                      {sites.map(site => (
                        <SelectCard key={site.id} selected={form.siteIds.includes(site.id)} onClick={() => toggleSite(site.id)} className="p-3.5">
                          <div className="flex items-center gap-3 pr-8">
                            <span
                              className="flex size-9 shrink-0 items-center justify-center rounded-xl text-white"
                              style={{ backgroundColor: site.color }}
                            >
                              <Building2 className="size-4" />
                            </span>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-bold">{site.name}</div>
                              <div className="truncate text-xs text-muted-foreground">
                                {site.code}
                              </div>
                            </div>
                          </div>
                        </SelectCard>
                      ))}
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 rounded-2xl border border-border bg-muted/50 p-4">
                      <PersonAvatar person={{ name: form.name || "?", color: "#1c4ff0", status: "invited" }} size="lg" />
                      <div className="min-w-0">
                        <div className="truncate text-lg font-semibold">{form.name}</div>
                        <div className="truncate text-sm text-muted-foreground">
                          {form.jobTitle} · {form.team} · {form.appRole === "owner" ? "Admin" : "Worker"}
                        </div>
                      </div>
                    </div>
                    <dl className="grid grid-cols-[110px_1fr] gap-x-4 gap-y-2.5 text-sm">
                      <dt className="text-muted-foreground">Email</dt>
                      <dd className="truncate font-semibold">{form.email}</dd>
                      <dt className="text-muted-foreground">Phone</dt>
                      <dd className="font-semibold">{form.phone || "—"}</dd>
                      <dt className="text-muted-foreground">Sites</dt>
                      <dd className="flex flex-wrap gap-1.5">
                        {form.siteIds.length === 0 && <span className="text-muted-foreground">None yet — assign later</span>}
                        {form.siteIds.map(id => {
                          const s = sites.find(x => x.id === id);
                          return (
                            <span key={id} className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">
                              {s?.name}
                            </span>
                          );
                        })}
                      </dd>
                    </dl>
                    <div className="flex gap-3 rounded-2xl bg-accent/70 p-3.5 text-sm text-accent-foreground">
                      <Mail className="mt-0.5 size-4 shrink-0" />
                      <p>
                        We&apos;ll create the account and email a set-password link. They show as{" "}
                        <b>Invited</b> until their first sign-in.
                      </p>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {!done && (
          <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/40 px-6 py-4">
            <Button variant="ghost" size="lg" className="rounded-xl" onClick={() => (step === 0 ? onOpenChange(false) : go(-1))}>
              {step === 0 ? "Cancel" : (
                <>
                  <ArrowLeft /> Back
                </>
              )}
            </Button>
            {step < STEPS.length - 1 ? (
              <Button size="lg" className="rounded-xl px-4 shadow-glow" onClick={() => go(1)}>
                Continue <ArrowRight />
              </Button>
            ) : (
              <Button size="lg" className="rounded-xl px-4 shadow-glow" onClick={submit} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <Sparkles />} Create &amp; send invite
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SuccessView({ email, name, onAnother, onClose }: { email: string; name: string; onAnother: () => void; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: EASE_OUT }}
      className="flex flex-col items-center py-4 text-center"
    >
      <div className="relative">
        <motion.span
          className="absolute inset-0 rounded-full bg-success/25"
          initial={{ scale: 0.6, opacity: 0.8 }}
          animate={{ scale: 1.9, opacity: 0 }}
          transition={{ duration: 1.2, repeat: 1, ease: "easeOut" }}
        />
        <motion.span
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.1 }}
          className="relative flex size-16 items-center justify-center rounded-full bg-success text-white shadow-[0_12px_32px_-10px_var(--success)]"
        >
          <MailCheck className="size-7" />
        </motion.span>
      </div>
      <h3 className="mt-5 text-xl font-semibold">{name} is invited</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
        A set-password email went to <b className="text-foreground">{email}</b>. They&apos;ll appear as <b>Invited</b> in the
        crew list until they sign in.
      </p>
      <div className="mt-6 flex gap-2">
        <Button variant="outline" size="lg" className="rounded-xl" onClick={onAnother}>
          Add another
        </Button>
        <Button size="lg" className="rounded-xl px-4" onClick={onClose}>
          Done
        </Button>
      </div>
    </motion.div>
  );
}
