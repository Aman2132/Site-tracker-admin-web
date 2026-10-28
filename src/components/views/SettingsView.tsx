"use client";

import { describeFields } from "@/lib/auditLog";
import { Bell, Building2, Check, KeyRound, LogOut, Monitor, Moon, Sun } from "lucide-react";
import { motion } from "motion/react";
import { useTheme } from "next-themes";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { useAdmin, useAuth } from "@/components/auth/AuthProvider";
import { PageHeader } from "@/components/domain/PageHeader";
import { PersonAvatar } from "@/components/domain/PersonAvatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { roleLabel } from "@/lib/format";
import { usePrefs } from "@/lib/prefs";
import { attempt, useLiveStore } from "@/lib/store";
import { TZ_LABEL } from "@/lib/time";
import { useMounted } from "@/lib/useMounted";
import { cn } from "@/lib/utils";

const THEMES = [
  ["light", "Light", Sun],
  ["dark", "Dark", Moon],
  ["system", "System", Monitor],
] as const;

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="surface rounded-2xl p-6 sm:p-8">
      <div className="font-bold">{title}</div>
      {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ToggleRow({ label, hint, checked, onChange, disabled }: { label: string; hint: string; checked: boolean; onChange: (on: boolean) => void; disabled?: boolean }) {
  return (
    <label className={cn("flex items-start justify-between gap-4 py-3", disabled ? "opacity-60" : "cursor-pointer")}>
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
      <Switch checked={checked} disabled={disabled} onCheckedChange={on => onChange(Boolean(on))} className="mt-1" />
    </label>
  );
}

/**
 * Your account, per-browser preferences (default site, browser alerts) and how the dashboard looks.
 * Email alerts and shift rules aren't here because nothing would send them yet (they need a scheduled sender).
 */
export function SettingsView() {
  const admin = useAdmin();
  const { signOutUser } = useAuth();
  const { sites, resendInvite } = useLiveStore();
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const [prefs, setPref] = usePrefs();
  const [permission, setPermission] = useState(() => (typeof Notification === "undefined" ? "unsupported" : Notification.permission));

  const role = roleLabel(admin.profile.appRole);
  const jobTitle = admin.profile.role && admin.profile.role.toLowerCase() !== role.toLowerCase() ? admin.profile.role : null;
  const defaultSite = sites.find(s => s.id === prefs.defaultSite);

  /** Turning an alert on asks the browser for permission first; a refusal leaves it off. */
  const setAlert = async (key: "notifySignalLost" | "notifyLowBattery", on: boolean) => {
    if (on && permission !== "granted") {
      if (permission === "unsupported") return;
      const answer = await Notification.requestPermission();
      setPermission(answer);
      if (answer !== "granted") {
        toast.error("Notifications are blocked", { description: "Allow them for this site in your browser settings, then try again." });
        return;
      }
    }
    setPref(key, on);
  };

  const changePassword = async () => {
    // Same Firebase email as an invite: a link to set a new password, sent to the signed-in admin.
    if (await attempt("Sending a password reset", () => resendInvite(admin.email), { targetType: "person", targetId: admin.uid, changes: describeFields([{ label: "sent to", value: admin.email }]) }))
      toast.success("Check your email", { description: `A link to set a new password was sent to ${admin.email}.` });
  };

  return (
    <>
      <PageHeader title="Settings" description="Your account, your preferences and how the dashboard looks." />

      <div className="grid max-w-3xl gap-5">
        <section className="surface rounded-2xl px-6 py-2 sm:px-8">
          <div className="flex items-center gap-4 border-b border-border py-6">
            <PersonAvatar person={{ name: admin.profile.name, color: admin.profile.color, status: "online" }} size="xl" />
            <div>
              <div className="text-xl font-semibold">{admin.profile.name}</div>
              <div className="text-sm text-muted-foreground">{jobTitle ? `${jobTitle} · ${role}` : role}</div>
            </div>
          </div>
          {/* Read-only facts, shown as text rather than inputs that can't be typed in. */}
          <dl className="grid gap-5 py-6 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold text-muted-foreground">Email</dt>
              <dd className="mt-1 text-sm font-semibold break-all">{admin.email}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-muted-foreground">Time zone</dt>
              <dd className="mt-1 text-sm font-semibold">{TZ_LABEL}</dd>
              <dd className="mt-0.5 text-xs text-muted-foreground">All times in the dashboard use this zone.</dd>
            </div>
          </dl>
          <div className="flex flex-wrap justify-end gap-2 pb-6">
            <Button variant="outline" size="lg" className="rounded-xl" onClick={changePassword}>
              <KeyRound /> Change password
            </Button>
            <Button variant="outline" size="lg" className="rounded-xl" onClick={signOutUser}>
              <LogOut /> Sign out
            </Button>
          </div>
        </section>

        <Section title="Default site" description="Every page with a site filter opens on this site. Saved in this browser.">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="lg" className="rounded-xl" />}>
              <Building2 /> {defaultSite ? defaultSite.name : "All sites"}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuRadioGroup value={defaultSite ? defaultSite.id : "all"} onValueChange={v => setPref("defaultSite", String(v))}>
                <DropdownMenuRadioItem value="all">All sites</DropdownMenuRadioItem>
                {sites.map(s => (
                  <DropdownMenuRadioItem key={s.id} value={s.id}>
                    <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} /> {s.name}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </Section>

        <Section
          title="Notifications"
          description="Browser notifications on this computer while the dashboard is open in a tab. Email alerts aren't available yet."
        >
          <div className="divide-y divide-border">
            <ToggleRow
              label="Someone loses signal"
              hint="A person on shift stops sending their location for 15 minutes."
              checked={prefs.notifySignalLost && permission === "granted"}
              onChange={on => setAlert("notifySignalLost", on)}
              disabled={permission === "unsupported"}
            />
            <ToggleRow
              label="Low battery"
              hint="A person on shift drops to 20% battery or less."
              checked={prefs.notifyLowBattery && permission === "granted"}
              onChange={on => setAlert("notifyLowBattery", on)}
              disabled={permission === "unsupported"}
            />
          </div>
          {permission === "denied" && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-warning">
              <Bell className="size-3.5" /> Notifications are blocked for this site in your browser settings.
            </p>
          )}
        </Section>

        <Section title="Theme">
          <div className="grid gap-3 sm:grid-cols-3">
            {THEMES.map(([value, label, Icon]) => {
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
        </Section>
      </div>
    </>
  );
}
