"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import { AddCrewDialog } from "@/components/domain/AddCrewDialog";
import { CreateSiteDialog } from "@/components/domain/CreateSiteDialog";

/**
 * The two creation flows are mounted once at the shell level, so any page,
 * button or the command palette can open them. Each open bumps a key, which
 * gives the dialog a fresh form.
 */
interface Dialogs {
  openAddCrew: (presetSiteId?: string) => void;
  openCreateSite: () => void;
}

const DialogsContext = createContext<Dialogs | null>(null);

export function DialogsProvider({ children }: { children: ReactNode }) {
  const [addCrew, setAddCrew] = useState<{ open: boolean; siteId?: string; key: number }>({ open: false, key: 0 });
  const [createSite, setCreateSite] = useState({ open: false, key: 0 });

  const value = useMemo<Dialogs>(
    () => ({
      openAddCrew: siteId => setAddCrew(prev => ({ open: true, siteId, key: prev.key + 1 })),
      openCreateSite: () => setCreateSite(prev => ({ open: true, key: prev.key + 1 })),
    }),
    []
  );

  return (
    <DialogsContext.Provider value={value}>
      {children}
      <AddCrewDialog
        key={`crew-${addCrew.key}`}
        open={addCrew.open}
        presetSiteId={addCrew.siteId}
        onOpenChange={open => setAddCrew(prev => ({ ...prev, open }))}
      />
      <CreateSiteDialog
        key={`site-${createSite.key}`}
        open={createSite.open}
        onOpenChange={open => setCreateSite(prev => ({ ...prev, open }))}
      />
    </DialogsContext.Provider>
  );
}

export function useDialogs(): Dialogs {
  const ctx = useContext(DialogsContext);
  if (!ctx) throw new Error("useDialogs must be used inside DialogsProvider");
  return ctx;
}
