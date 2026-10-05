"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { CREW, EVENTS, NOW, PHOTOS, SESSIONS, SITES } from "@/lib/mock/data";

import type { ActivityEvent, CrewMember, Site } from "@/types/domain";

/**
 * In-memory demo state. Creating a site or inviting crew updates this for
 * the rest of the browser session (no persistence) so the prototype feels
 * real. In the real app each action becomes an api/ call instead.
 */

export interface NewCrewInput {
  name: string;
  email: string;
  phone: string;
  jobTitle: string;
  team: string;
  appRole: CrewMember["appRole"];
  siteIds: string[];
}

export interface NewSiteInput {
  name: string;
  address: string;
  city: string;
  radius: number;
  manager: string;
  status: Site["status"];
  crewIds: string[];
}

interface DemoStore {
  sites: Site[];
  crew: CrewMember[];
  events: ActivityEvent[];
  photos: typeof PHOTOS;
  sessions: typeof SESSIONS;
  addCrew: (input: NewCrewInput) => CrewMember;
  addSite: (input: NewSiteInput) => Site;
  setAssignments: (siteId: string, crewIds: string[]) => void;
  setCrewActive: (id: string, active: boolean) => void;
  setPersonSites: (personId: string, siteIds: string[]) => void;
}

const DemoStoreContext = createContext<DemoStore | null>(null);

const SITE_COLORS = ["#1c4ff0", "#0f9d58", "#a142f4", "#e2670f", "#12b5cb", "#d93025"];
const CREW_COLORS = ["#1a73e8", "#188038", "#a142f4", "#f29900", "#d93025", "#12b5cb"];

let counter = 0;
const newId = (prefix: string) => `${prefix}-new-${++counter}`;

export function DemoStoreProvider({ children }: { children: ReactNode }) {
  const [sites, setSites] = useState<Site[]>(SITES);
  const [crew, setCrew] = useState<CrewMember[]>(CREW);
  const [events, setEvents] = useState<ActivityEvent[]>(EVENTS);

  const logEvent = useCallback((event: Omit<ActivityEvent, "id" | "at">) => {
    setEvents(prev => [{ ...event, id: newId("ev"), at: NOW }, ...prev]);
  }, []);

  const addCrew = useCallback(
    (input: NewCrewInput) => {
      const member: CrewMember = {
        id: newId("cr"),
        name: input.name,
        email: input.email,
        phone: input.phone,
        jobTitle: input.jobTitle,
        team: input.team,
        appRole: input.appRole,
        color: CREW_COLORS[counter % CREW_COLORS.length],
        status: "invited",
        kind: "stale",
        siteIds: input.siteIds,
        joinedAt: NOW,
      };
      setCrew(prev => [member, ...prev]);
      logEvent({ kind: "invite", personId: member.id, siteId: input.siteIds[0], text: `Invite sent to ${member.name}`, severity: "info" });
      return member;
    },
    [logEvent]
  );

  const addSite = useCallback(
    (input: NewSiteInput) => {
      const words = input.name.replace(/[^a-zA-Z ]/g, "").split(" ").filter(Boolean);
      const site: Site = {
        id: newId("site"),
        name: input.name,
        code: `${input.city.slice(0, 3).toUpperCase()}-${words.map(w => w[0]).join("").slice(0, 3).toUpperCase() || "NEW"}`,
        address: input.address,
        city: input.city,
        lat: 28.6,
        lng: 77.2,
        radius: input.radius,
        status: input.status,
        progress: 0,
        startedAt: NOW,
        manager: input.manager,
        color: SITE_COLORS[counter % SITE_COLORS.length],
      };
      setSites(prev => [site, ...prev]);
      if (input.crewIds.length) {
        setCrew(prev =>
          prev.map(c => (input.crewIds.includes(c.id) ? { ...c, siteIds: [...c.siteIds, site.id] } : c))
        );
      }
      logEvent({ kind: "site", siteId: site.id, text: `Site created — ${site.name}`, severity: "success" });
      return site;
    },
    [logEvent]
  );

  const setAssignments = useCallback((siteId: string, crewIds: string[]) => {
    setCrew(prev =>
      prev.map(c => {
        const has = c.siteIds.includes(siteId);
        const wants = crewIds.includes(c.id);
        if (has === wants) return c;
        return { ...c, siteIds: wants ? [...c.siteIds, siteId] : c.siteIds.filter(id => id !== siteId) };
      })
    );
  }, []);

  const setCrewActive = useCallback((id: string, active: boolean) => {
    setCrew(prev =>
      prev.map(c => (c.id === id ? { ...c, status: active ? "offline" : "deactivated", currentSiteId: undefined } : c))
    );
  }, []);

  const setPersonSites = useCallback((personId: string, siteIds: string[]) => {
    setCrew(prev => prev.map(c => (c.id === personId ? { ...c, siteIds } : c)));
  }, []);

  const value = useMemo<DemoStore>(
    () => ({
      sites,
      crew,
      events,
      photos: PHOTOS,
      sessions: SESSIONS,
      addCrew,
      addSite,
      setAssignments,
      setCrewActive,
      setPersonSites,
    }),
    [sites, crew, events, addCrew, addSite, setAssignments, setCrewActive, setPersonSites]
  );

  return <DemoStoreContext.Provider value={value}>{children}</DemoStoreContext.Provider>;
}

export function useDemoStore(): DemoStore {
  const store = useContext(DemoStoreContext);
  if (!store) throw new Error("useDemoStore must be used inside DemoStoreProvider");
  return store;
}

/** Convenience lookups. */
export function useLookups() {
  const { sites, crew } = useDemoStore();
  return useMemo(() => {
    const siteById = new Map(sites.map(s => [s.id, s]));
    const personById = new Map(crew.map(c => [c.id, c]));
    return { siteById, personById };
  }, [sites, crew]);
}
