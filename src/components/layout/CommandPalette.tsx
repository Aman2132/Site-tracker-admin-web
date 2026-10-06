"use client";

import { Building2, Moon, Plus, Sun, UserPlus } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { PersonAvatar } from "@/components/domain/PersonAvatar";
import { useLiveStore } from "@/lib/store";

import { useDialogs } from "./DialogsProvider";
import { NAV_ITEMS } from "./nav";

/** Ctrl/⌘+K: jump to any page, person or site, or start a creation flow. */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const { sites, crew } = useLiveStore();
  const { openAddCrew, openCreateSite } = useDialogs();
  const { setTheme, resolvedTheme } = useTheme();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const run = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} className="sm:max-w-xl">
      <Command>
        <CommandInput placeholder="Search pages, crew, sites…" />
        <CommandList className="max-h-[420px]">
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Quick actions">
            <CommandItem onSelect={() => run(() => openAddCrew())}>
              <UserPlus /> Add crew member
              <CommandShortcut>Invite</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => run(openCreateSite)}>
              <Plus /> Create site
            </CommandItem>
            <CommandItem onSelect={() => run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))}>
              {resolvedTheme === "dark" ? <Sun /> : <Moon />} Toggle theme
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Pages">
            {NAV_ITEMS.map(item => (
              <CommandItem key={item.href} value={`page ${item.label}`} onSelect={() => run(() => router.push(item.href))}>
                <item.icon /> {item.label}
                <span className="ml-auto text-xs text-muted-foreground">{item.description}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Sites">
            {sites.map(site => (
              <CommandItem
                key={site.id}
                value={`site ${site.name} ${site.code}`}
                onSelect={() => run(() => router.push(`/sites/${site.id}`))}
              >
                <Building2 /> {site.name}
                <span className="ml-auto text-xs text-muted-foreground">{site.code}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Crew">
            {crew.map(person => (
              <CommandItem
                key={person.id}
                value={`crew ${person.name} ${person.jobTitle} ${person.team}`}
                onSelect={() => run(() => router.push(`/crew/${person.id}`))}
              >
                <PersonAvatar person={person} size="xs" />
                {person.name}
                <span className="ml-auto text-xs text-muted-foreground">{person.jobTitle}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
