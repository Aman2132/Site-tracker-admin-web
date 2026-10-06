"use client";

import { Bell, BatteryLow, Clock3, LogOut, Menu, Search, UserRound, MailQuestion } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useAdmin, useAuth } from "@/components/auth/AuthProvider";
import { PersonAvatar } from "@/components/domain/PersonAvatar";
import { needsAttention } from "@/lib/insights";
import { useLiveStore } from "@/lib/store";

import { CommandPalette } from "./CommandPalette";
import { NAV_ITEMS, isActive } from "./nav";
import { BrandMark, NavList } from "./Sidebar";
import { ThemeToggle } from "./ThemeToggle";

const REASON_ICON = { idle: Clock3, battery: BatteryLow, invited: MailQuestion, offline: Clock3 };

function NotificationsMenu() {
  const { crew } = useLiveStore();
  const items = needsAttention(crew);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-lg" className="relative rounded-xl" aria-label="Alerts" />}
      >
        <Bell className="size-[18px]" />
        {items.length > 0 && (
          <span className="absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white ring-2 ring-background">
            {items.length}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center justify-between px-4 py-3 text-sm font-bold text-foreground">
            Needs attention
            <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs text-danger">{items.length}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="my-0" />
        <div className="max-h-80 overflow-y-auto p-1 scrollbar-thin">
          {items.map(item => {
            const Icon = REASON_ICON[item.reason];
            return (
              <DropdownMenuItem
                key={item.id}
                render={<Link href={`/crew/${item.person.id}`} />}
                className="items-start gap-3 rounded-lg px-3 py-2.5"
              >
                <PersonAvatar person={item.person} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{item.person.name}</div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Icon className="size-3.5" /> {item.detail}
                  </div>
                </div>
              </DropdownMenuItem>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProfileMenu() {
  const admin = useAdmin();
  const { signOutUser } = useAuth();
  const person = { name: admin.profile.name, color: admin.profile.color, avatar: admin.profile.avatar, status: "online" as const };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="flex items-center gap-2.5 rounded-xl py-1 pr-2 pl-1 transition-colors hover:bg-muted"
            aria-label="Account"
          />
        }
      >
        <PersonAvatar person={person} size="sm" />
        <div className="hidden text-left leading-tight xl:block">
          <div className="text-sm font-bold">{admin.profile.name}</div>
          <div className="text-[11px] text-muted-foreground">{admin.profile.role}</div>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <div className="text-sm font-bold text-foreground">{admin.profile.name}</div>
            <div className="text-xs font-normal">{admin.email}</div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/settings" />}>
          <UserRound /> Profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={signOutUser}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Topbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const current = NAV_ITEMS.find(item => isActive(pathname, item.href));

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/75 backdrop-blur-xl">
      <div className="flex h-[72px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Button
          variant="ghost"
          size="icon-lg"
          className="rounded-xl lg:hidden"
          onClick={() => setMenuOpen(true)}
          aria-label="Open navigation"
        >
          <Menu className="size-5" />
        </Button>

        <div className="min-w-0 flex-1">
          <motion.div
            key={current?.href}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="min-w-0"
          >
            <div className="truncate text-[11px] font-bold tracking-[0.14em] text-faint uppercase">
              {current?.description ?? "Site Tracker"}
            </div>
            <div className="truncate text-lg font-extrabold tracking-tight">{current?.label ?? "Admin"}</div>
          </motion.div>
        </div>

        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="group hidden h-10 w-72 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm text-muted-foreground shadow-card transition-all hover:border-primary/40 hover:text-foreground md:flex"
        >
          <Search className="size-4 transition-transform group-hover:scale-110" />
          <span className="flex-1 text-left">Search crew, sites, pages…</span>
          <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold">Ctrl K</kbd>
        </button>
        <Button
          variant="ghost"
          size="icon-lg"
          className="rounded-xl md:hidden"
          onClick={() => setPaletteOpen(true)}
          aria-label="Search"
        >
          <Search className="size-[18px]" />
        </Button>

        <NotificationsMenu />
        <ThemeToggle />
        <ProfileMenu />
      </div>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-72 p-5">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="mb-6">
            <BrandMark />
          </div>
          <NavList layoutKey="mobile" onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </header>
  );
}
