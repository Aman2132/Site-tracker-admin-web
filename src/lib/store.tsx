"use client";

import { collection, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { onValue, ref } from "firebase/database";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import * as admin from "./admin";
import { firebase } from "./firebase";
import { deriveCrew, settleSessions, toEvent, toPhoto, toSite } from "./live";
import { DAY } from "./time";

import type {
  ActivityEvent,
  CrewMember,
  PersonDoc,
  PositionDoc,
  PresenceSession,
  Site,
  SitePhoto,
} from "@/types/domain";

/** How far back attendance and hours look. */
const SESSION_DAYS = 15;
/** The newest this many photos / events are loaded; older ones aren't shown. */
const PHOTO_LIMIT = 300;
const EVENT_LIMIT = 300;
/** Statuses go stale as time passes with no new data, so they are re-derived this often. */
const TICK_MS = 30_000;
/** The mobile app's old single-site document; it has a location and isn't a project. */
const LEGACY_SITE_ID = "default";

/**
 * Live data from Firebase: one listener per collection, derived into what the
 * views read. Mounted only after the owner is signed in, so nothing is
 * subscribed (and nothing is readable) before that.
 */
interface LiveStore {
  /** False until the roster, positions and sites have first arrived. */
  ready: boolean;
  /** The current time, refreshed every TICK_MS; views read it instead of calling Date.now() while rendering. */
  now: number;
  /** Set when a listener fails (for instance rules not deployed), so the UI can say so. */
  error: string | null;
  sites: Site[];
  crew: CrewMember[];
  events: ActivityEvent[];
  photos: SitePhoto[];
  sessions: PresenceSession[];
  createSite: typeof admin.createSite;
  setSiteStatus: typeof admin.setSiteStatus;
  setSiteCrew: typeof admin.setSiteCrew;
  setPersonSites: typeof admin.setPersonSites;
  setCrewActive: typeof admin.setCrewActive;
  inviteCrew: typeof admin.inviteCrew;
  resendInvite: typeof admin.resendInvite;
}

const LiveStoreContext = createContext<LiveStore | null>(null);

export function LiveStoreProvider({ children }: { children: ReactNode }) {
  const [people, setPeople] = useState<PersonDoc[] | null>(null);
  const [positions, setPositions] = useState<Record<string, PositionDoc> | null>(null);
  const [sites, setSites] = useState<Site[] | null>(null);
  const [rawSessions, setRawSessions] = useState<PresenceSession[]>([]);
  const [photos, setPhotos] = useState<SitePhoto[]>([]);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const { db, rtdb } = firebase();
    const fail = (what: string) => (e: Error) => {
      console.warn(`[live] ${what} listener failed —`, e);
      setError(`Couldn't load ${what}: ${e.message}`);
    };
    const since = Date.now() - SESSION_DAYS * DAY;

    const unsubscribers = [
      onSnapshot(
        collection(db, "people"),
        snap => setPeople(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<PersonDoc, "id">) }))),
        fail("crew")
      ),
      onValue(
        ref(rtdb, "positions"),
        snap => setPositions((snap.val() as Record<string, PositionDoc>) ?? {}),
        fail("live positions")
      ),
      onSnapshot(
        collection(db, "sites"),
        snap =>
          setSites(
            snap.docs.filter(d => d.id !== LEGACY_SITE_ID).map(d => toSite(d.id, d.data(), Date.now()))
          ),
        fail("sites")
      ),
      onSnapshot(
        query(collection(db, "sessions"), where("start", ">=", since), orderBy("start", "desc")),
        snap =>
          setRawSessions(
            snap.docs.map(d => {
              const data = d.data() as Omit<PresenceSession, "id">;
              return { id: d.id, ...data };
            })
          ),
        fail("check-in sessions")
      ),
      onSnapshot(
        query(collection(db, "photos"), orderBy("takenAt", "desc"), limit(PHOTO_LIMIT)),
        snap => setPhotos(snap.docs.map(d => toPhoto(d.id, d.data()))),
        fail("photos")
      ),
      onSnapshot(
        query(collection(db, "events"), orderBy("at", "desc"), limit(EVENT_LIMIT)),
        snap => setEvents(snap.docs.map(d => toEvent(d.id, d.data(), Date.now()))),
        fail("activity")
      ),
    ];
    return () => unsubscribers.forEach(unsubscribe => unsubscribe());
  }, []);

  const crew = useMemo(() => deriveCrew(people ?? [], positions ?? {}, now), [people, positions, now]);
  const sessions = useMemo(() => settleSessions(rawSessions, positions ?? {}, now), [rawSessions, positions, now]);

  const value = useMemo<LiveStore>(
    () => ({
      ready: people != null && positions != null && sites != null,
      now,
      error,
      sites: sites ?? [],
      crew,
      events,
      photos,
      sessions,
      ...ACTIONS,
    }),
    [people, positions, sites, now, error, crew, events, photos, sessions]
  );

  return <LiveStoreContext.Provider value={value}>{children}</LiveStoreContext.Provider>;
}

const ACTIONS = {
  createSite: admin.createSite,
  setSiteStatus: admin.setSiteStatus,
  setSiteCrew: admin.setSiteCrew,
  setPersonSites: admin.setPersonSites,
  setCrewActive: admin.setCrewActive,
  inviteCrew: admin.inviteCrew,
  resendInvite: admin.resendInvite,
};

export function useLiveStore(): LiveStore {
  const store = useContext(LiveStoreContext);
  if (!store) throw new Error("useLiveStore must be used inside LiveStoreProvider");
  return store;
}

export function useNow(): number {
  return useLiveStore().now;
}

/** Runs an admin action and reports a failure as a toast. Resolves with `{ value }`, or null when it failed. */
export async function attempt<T>(label: string, work: () => Promise<T>): Promise<{ value: T } | null> {
  try {
    return { value: await work() };
  } catch (e) {
    console.warn(`[admin] ${label} failed —`, e);
    toast.error(`${label} failed`, { description: e instanceof Error ? e.message : "Something went wrong." });
    return null;
  }
}

/** Convenience lookups. */
export function useLookups() {
  const { sites, crew } = useLiveStore();
  return useMemo(() => {
    const siteById = new Map(sites.map(s => [s.id, s]));
    const personById = new Map(crew.map(c => [c.id, c]));
    return { siteById, personById };
  }, [sites, crew]);
}
