"use client";

import { Check, LogOut, Monitor, Moon, Sun } from "lucide-react";
import { motion } from "motion/react";
import { useTheme } from "next-themes";

import { useAdmin, useAuth } from "@/components/auth/AuthProvider";
import { Field, TextInput } from "@/components/domain/FormBits";
import { PageHeader } from "@/components/domain/PageHeader";
import { PersonAvatar } from "@/components/domain/PersonAvatar";
import { Button } from "@/components/ui/button";
import { TZ_LABEL } from "@/lib/time";
import { useMounted } from "@/lib/useMounted";
import { cn } from "@/lib/utils";

const THEMES = [
  ["light", "Light", Sun],
  ["dark", "Dark", Moon],
  ["system", "System", Monitor],
] as const;

/**
 * Only what is real today: who you are signed in as, and how the dashboard
 * looks. Alert rules, shift hours and photo retention aren't here because
 * nothing would act on them yet (they need a scheduled sender).
 */
export function SettingsView() {
  const admin = useAdmin();
  const { signOutUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  return (
    <>
      <PageHeader title="Settings" description="Your account and how the dashboard looks." />

      <div className="grid max-w-3xl gap-5">
        <section className="surface rounded-2xl px-6 py-2 sm:px-8">
          <div className="flex items-center gap-4 border-b border-border py-6">
            <PersonAvatar person={{ name: admin.profile.name, color: admin.profile.color, status: "online" }} size="xl" />
            <div>
              <div className="text-xl font-extrabold">{admin.profile.name}</div>
              <div className="text-sm text-muted-foreground">{admin.profile.role} · Admin</div>
            </div>
          </div>
          <div className="grid gap-5 py-6 sm:grid-cols-2">
            <Field label="Email">
              <TextInput value={admin.email} readOnly />
            </Field>
            <Field label="Time zone" hint="All times in the dashboard use this zone.">
              <TextInput value={TZ_LABEL} readOnly />
            </Field>
          </div>
          <div className="flex justify-end pb-6">
            <Button variant="outline" size="lg" className="rounded-xl" onClick={signOutUser}>
              <LogOut /> Sign out
            </Button>
          </div>
        </section>

        <section className="surface rounded-2xl p-6 sm:p-8">
          <div className="mb-4 font-bold">Theme</div>
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
        </section>
      </div>
    </>
  );
}
