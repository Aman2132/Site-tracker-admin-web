"use client";

import { Bell, Check, Database, Monitor, Moon, Palette, ShieldCheck, Sun, UserRound, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTheme } from "next-themes";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { ChoiceChip, Field, TextInput } from "@/components/domain/FormBits";
import { PageHeader } from "@/components/domain/PageHeader";
import { PersonAvatar } from "@/components/domain/PersonAvatar";
import { EASE_OUT } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { formatClock } from "@/lib/format";
import { ADMIN } from "@/lib/mock/data";
import { useMounted } from "@/lib/useMounted";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "alerts", label: "Alerts", icon: Bell },
  { id: "roles", label: "Roles & access", icon: ShieldCheck },
  { id: "data", label: "Photos & data", icon: Database },
  { id: "appearance", label: "Appearance", icon: Palette },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

interface AlertSettings {
  idleEnabled: boolean;
  idleMinutes: number;
  batteryEnabled: boolean;
  batteryLevel: number;
  lateEnabled: boolean;
  lateAfter: number;
  push: boolean;
  email: boolean;
  shiftOnly: boolean;
  retention: string;
}

const DEFAULTS: AlertSettings = {
  idleEnabled: true,
  idleMinutes: 60,
  batteryEnabled: true,
  batteryLevel: 20,
  lateEnabled: true,
  lateAfter: 9.25,
  push: true,
  email: false,
  shiftOnly: true,
  retention: "12m",
};

function Row({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-border py-5 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
      <div className="min-w-0">
        <div className="font-bold">{title}</div>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

const PERMISSIONS: { label: string; admin: boolean; manager: boolean; worker: boolean }[] = [
  { label: "See live crew map", admin: true, manager: true, worker: false },
  { label: "Create and edit sites", admin: true, manager: false, worker: false },
  { label: "Add crew & send invites", admin: true, manager: true, worker: false },
  { label: "Deactivate crew", admin: true, manager: false, worker: false },
  { label: "View all photos", admin: true, manager: true, worker: false },
  { label: "Export timesheets", admin: true, manager: true, worker: false },
  { label: "Share location, take photos", admin: true, manager: true, worker: true },
  { label: "See own photos & hours", admin: true, manager: true, worker: true },
];

export function SettingsView() {
  const [section, setSection] = useState<SectionId>("profile");
  const [saved, setSaved] = useState<AlertSettings>(DEFAULTS);
  const [draft, setDraft] = useState<AlertSettings>(DEFAULTS);
  const dirty = JSON.stringify(saved) !== JSON.stringify(draft);
  const set = <K extends keyof AlertSettings>(k: K, v: AlertSettings[K]) => setDraft(d => ({ ...d, [k]: v }));
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  return (
    <>
      <PageHeader title="Settings" description="Alert rules, who can do what, and how long photos are kept. Changes here are local to this demo." />

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <nav className="surface flex gap-1 overflow-x-auto rounded-2xl p-2 scrollbar-thin lg:sticky lg:top-[96px] lg:flex-col lg:self-start">
          {SECTIONS.map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(s.id)}
              className={cn(
                "relative flex h-11 shrink-0 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors",
                section === s.id ? "text-accent-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {section === s.id && (
                <motion.span layoutId="settings-nav" className="absolute inset-0 rounded-xl bg-accent" transition={{ type: "spring", stiffness: 380, damping: 32 }} />
              )}
              <s.icon className="relative size-4" />
              <span className="relative whitespace-nowrap">{s.label}</span>
            </button>
          ))}
        </nav>

        <AnimatePresence mode="wait">
          <motion.div
            key={section}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
            className="surface rounded-2xl px-6 py-2 sm:px-8"
          >
            {section === "profile" && (
              <>
                <div className="flex items-center gap-4 border-b border-border py-6">
                  <PersonAvatar person={{ name: ADMIN.name, color: "#1c4ff0", status: "online" }} size="xl" />
                  <div>
                    <div className="text-xl font-extrabold">{ADMIN.name}</div>
                    <div className="text-sm text-muted-foreground">{ADMIN.role}</div>
                  </div>
                </div>
                <div className="grid gap-5 py-6 sm:grid-cols-2">
                  <Field label="Full name">
                    <TextInput defaultValue={ADMIN.name} />
                  </Field>
                  <Field label="Email">
                    <TextInput defaultValue={ADMIN.email} type="email" />
                  </Field>
                  <Field label="Company">
                    <TextInput defaultValue="BuildCorp Infra Pvt. Ltd." />
                  </Field>
                  <Field label="Time zone" hint="All times in the dashboard use this zone.">
                    <TextInput defaultValue="India Standard Time (UTC+5:30)" readOnly />
                  </Field>
                </div>
                <div className="flex justify-end pb-6">
                  <Button size="lg" className="rounded-xl" onClick={() => toast.success("Profile saved")}>
                    Save profile
                  </Button>
                </div>
              </>
            )}

            {section === "alerts" && (
              <>
                <Row title="No update for a while" description="Push an alert when someone on shift stops sending location.">
                  <Switch checked={draft.idleEnabled} onCheckedChange={v => set("idleEnabled", v)} />
                </Row>
                <AnimatePresence initial={false}>
                  {draft.idleEnabled && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="rounded-2xl bg-muted/60 p-5">
                        <div className="mb-3 flex items-baseline justify-between text-sm">
                          <span className="font-semibold">Alert after</span>
                          <span className="text-xl font-extrabold tabular-nums">{draft.idleMinutes} min</span>
                        </div>
                        <Slider min={15} max={180} step={15} value={[draft.idleMinutes]} onValueChange={v => set("idleMinutes", Array.isArray(v) ? v[0] : (v as number))} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <Row title="Low battery" description="Warn before a phone dies and the person drops off the map.">
                  <div className="flex items-center gap-3">
                    {draft.batteryEnabled && (
                      <div className="flex gap-1.5">
                        {[10, 20, 30].map(l => (
                          <ChoiceChip key={l} selected={draft.batteryLevel === l} onClick={() => set("batteryLevel", l)}>
                            {l}%
                          </ChoiceChip>
                        ))}
                      </div>
                    )}
                    <Switch checked={draft.batteryEnabled} onCheckedChange={v => set("batteryEnabled", v)} />
                  </div>
                </Row>
                <Row title="Late arrival" description={`Flag anyone who arrives after ${formatClock(draft.lateAfter)}.`}>
                  <div className="flex items-center gap-3">
                    {draft.lateEnabled && (
                      <div className="flex gap-1.5">
                        {[9, 9.25, 9.5].map(t => (
                          <ChoiceChip key={t} selected={draft.lateAfter === t} onClick={() => set("lateAfter", t)}>
                            {formatClock(t)}
                          </ChoiceChip>
                        ))}
                      </div>
                    )}
                    <Switch checked={draft.lateEnabled} onCheckedChange={v => set("lateEnabled", v)} />
                  </div>
                </Row>
                <Row title="Only during shift hours" description="Avoid night-time false alarms when the crew has gone home.">
                  <Switch checked={draft.shiftOnly} onCheckedChange={v => set("shiftOnly", v)} />
                </Row>
                <Row title="Delivery" description="Push needs the small scheduled sender (Cloud Function or Worker).">
                  <div className="flex gap-2">
                    <ChoiceChip selected={draft.push} onClick={() => set("push", !draft.push)}>
                      Push
                    </ChoiceChip>
                    <ChoiceChip selected={draft.email} onClick={() => set("email", !draft.email)}>
                      Email
                    </ChoiceChip>
                  </div>
                </Row>
              </>
            )}

            {section === "roles" && (
              <div className="py-6">
                <p className="mb-5 max-w-2xl text-sm text-muted-foreground">
                  A preview of the permission model the dashboard needs. Enforced by the backend&apos;s security rules, not just hidden in the UI.
                </p>
                <div className="overflow-x-auto scrollbar-thin">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs font-bold tracking-wide text-muted-foreground uppercase">
                        <th className="py-3 text-left">Capability</th>
                        <th className="px-3 py-3">Admin</th>
                        <th className="px-3 py-3">Site manager</th>
                        <th className="px-3 py-3">Worker</th>
                      </tr>
                    </thead>
                    <tbody>
                      {PERMISSIONS.map((p, i) => (
                        <motion.tr
                          key={p.label}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className="border-b border-border/70 last:border-0"
                        >
                          <td className="py-3 font-semibold">{p.label}</td>
                          {[p.admin, p.manager, p.worker].map((ok, j) => (
                            <td key={j} className="px-3 py-3 text-center">
                              <span
                                className={cn(
                                  "inline-flex size-6 items-center justify-center rounded-full",
                                  ok ? "bg-success-soft text-success" : "bg-muted text-faint"
                                )}
                              >
                                {ok ? <Check className="size-3.5" strokeWidth={3} /> : <X className="size-3.5" />}
                              </span>
                            </td>
                          ))}
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {section === "data" && (
              <>
                <Row title="Keep photos for" description="Older originals are archived; thumbnails and metadata stay.">
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      ["6m", "6 months"],
                      ["12m", "1 year"],
                      ["24m", "2 years"],
                      ["forever", "Forever"],
                    ].map(([v, l]) => (
                      <ChoiceChip key={v} selected={draft.retention === v} onClick={() => set("retention", v)}>
                        {l}
                      </ChoiceChip>
                    ))}
                  </div>
                </Row>
                <div className="py-5">
                  <div className="mb-2 flex items-baseline justify-between">
                    <span className="font-bold">Photo storage</span>
                    <span className="text-sm text-muted-foreground">
                      <b className="text-foreground">6.4 GB</b> of 10 GB free tier
                    </span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-muted">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-chart-4"
                      initial={{ width: 0 }}
                      animate={{ width: "64%" }}
                      transition={{ duration: 1.1, ease: EASE_OUT, delay: 0.2 }}
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-3 text-center text-sm">
                    {[
                      ["Originals", "6.1 GB"],
                      ["Thumbnails", "0.2 GB"],
                      ["Videos", "0.1 GB"],
                    ].map(([k, v]) => (
                      <div key={k} className="rounded-xl bg-muted/60 p-3">
                        <div className="font-extrabold">{v}</div>
                        <div className="text-xs text-muted-foreground">{k}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {section === "appearance" && (
              <div className="py-6">
                <div className="mb-4 font-bold">Theme</div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {(
                    [
                      ["light", "Light", Sun],
                      ["dark", "Dark", Moon],
                      ["system", "System", Monitor],
                    ] as const
                  ).map(([value, label, Icon]) => {
                    const active = mounted && theme === value;
                    return (
                      <motion.button
                        key={value}
                        type="button"
                        whileHover={{ y: -3 }}
                        onClick={() => setTheme(value)}
                        className={cn(
                          "overflow-hidden rounded-2xl border text-left transition-[border-color,box-shadow]",
                          active ? "border-primary shadow-[0_0_0_3px_color-mix(in_oklab,var(--primary)_18%,transparent)]" : "border-border hover:border-primary/40"
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-24 gap-2 p-3",
                            value === "dark" ? "bg-[#080a14]" : value === "light" ? "bg-[#f4f5fa]" : "bg-gradient-to-r from-[#f4f5fa] from-50% to-[#080a14] to-50%"
                          )}
                        >
                          <div className={cn("w-1/4 rounded-lg", value === "dark" ? "bg-[#10131f]" : "bg-white")} />
                          <div className="flex flex-1 flex-col gap-2">
                            <div className="h-3 w-2/3 rounded bg-[#1c4ff0]" />
                            <div className={cn("flex-1 rounded-lg", value === "light" ? "bg-white" : "bg-[#10131f]")} />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 p-3 text-sm font-bold">
                          <Icon className="size-4" /> {label}
                          {active && <Check className="ml-auto size-4 text-primary" />}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Unsaved-changes bar */}
      <AnimatePresence>
        {dirty && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="fixed inset-x-0 bottom-6 z-40 mx-auto flex w-[min(560px,calc(100%-2rem))] items-center gap-3 rounded-2xl bg-ink-hero p-3 pl-5 text-white shadow-lift"
          >
            <span className="flex-1 text-sm font-semibold">You have unsaved changes</span>
            <Button variant="ghost" className="rounded-xl text-white hover:bg-white/10 hover:text-white" onClick={() => setDraft(saved)}>
              Discard
            </Button>
            <Button
              className="rounded-xl bg-white px-4 text-ink hover:bg-white/90"
              onClick={() => {
                setSaved(draft);
                toast.success("Settings saved");
              }}
            >
              Save changes
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
