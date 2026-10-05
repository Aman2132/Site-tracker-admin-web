import { createRandom } from "./random";

import type {
  ActivityEvent,
  CrewMember,
  PresenceSession,
  Site,
  SitePhoto,
} from "@/types/domain";

/**
 * Static demo dataset. Everything is generated from a fixed seed and a fixed
 * "now", so server and client renders match and the demo looks the same on
 * every load. When a real backend exists, this file is what gets replaced.
 */

/** Demo snapshot time: Mon 5 Oct 2026, 15:40 IST. */
export const NOW = Date.UTC(2026, 9, 5, 10, 10);
export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
/** IST is UTC+5:30 — used to place shifts at sensible local times. */
const IST_OFFSET = 5.5 * HOUR;

/** Midnight IST of the day containing `t`, as an epoch ms. */
export function istDayStart(t: number): number {
  return Math.floor((t + IST_OFFSET) / DAY) * DAY - IST_OFFSET;
}

const rand = createRandom(20261005);

export const ADMIN = {
  name: "Meera Kapoor",
  email: "meera@buildcorp.in",
  role: "Owner · BuildCorp Infra",
};

export const SITES: Site[] = [
  {
    id: "s62",
    name: "Sector 62 · Tower B",
    code: "NOI-62B",
    address: "Plot 14, Sector 62",
    city: "Noida",
    lat: 28.6139,
    lng: 77.209,
    radius: 120,
    status: "active",
    progress: 0.64,
    startedAt: NOW - 210 * DAY,
    manager: "Rakesh Bansal",
    color: "#1c4ff0",
  },
  {
    id: "dwx",
    name: "Dwarka Expressway Plaza",
    code: "GGN-DXP",
    address: "Sector 106, Dwarka Expressway",
    city: "Gurugram",
    lat: 28.5355,
    lng: 77.0209,
    radius: 180,
    status: "active",
    progress: 0.38,
    startedAt: NOW - 120 * DAY,
    manager: "Sunita Rao",
    color: "#0f9d58",
  },
  {
    id: "cpr",
    name: "Connaught Place Retrofit",
    code: "DEL-CPR",
    address: "Block E, Connaught Place",
    city: "New Delhi",
    lat: 28.6315,
    lng: 77.2167,
    radius: 90,
    status: "active",
    progress: 0.81,
    startedAt: NOW - 300 * DAY,
    manager: "Rakesh Bansal",
    color: "#a142f4",
  },
  {
    id: "gmd",
    name: "Gurugram Metro Depot",
    code: "GGN-GMD",
    address: "Sector 55, Golf Course Ext. Road",
    city: "Gurugram",
    lat: 28.4269,
    lng: 77.1048,
    radius: 250,
    status: "paused",
    progress: 0.22,
    startedAt: NOW - 90 * DAY,
    manager: "Sunita Rao",
    color: "#e2670f",
  },
  {
    id: "okw",
    name: "Okhla Logistics Warehouse",
    code: "DEL-OKW",
    address: "Phase III, Okhla Industrial Area",
    city: "New Delhi",
    lat: 28.5494,
    lng: 77.2736,
    radius: 150,
    status: "planning",
    progress: 0.04,
    startedAt: NOW - 6 * DAY,
    manager: "Rakesh Bansal",
    color: "#12b5cb",
  },
];

interface CrewSeed {
  id: string;
  name: string;
  jobTitle: string;
  team: string;
  color: string;
  siteIds: string[];
  status: CrewMember["status"];
  kind: CrewMember["kind"];
  battery?: number;
  appRole?: CrewMember["appRole"];
}

const CREW_SEEDS: CrewSeed[] = [
  { id: "rk", name: "Ramesh Kumar", jobTitle: "Driver", team: "Crew A", color: "#1a73e8", siteIds: ["s62", "dwx"], status: "online", kind: "vehicle", battery: 0.71 },
  { id: "sy", name: "Suryakant Yadav", jobTitle: "Mason", team: "Crew A", color: "#188038", siteIds: ["s62"], status: "online", kind: "walk", battery: 0.68 },
  { id: "pd", name: "Pooja Devi", jobTitle: "Helper", team: "Crew A", color: "#a142f4", siteIds: ["s62"], status: "online", kind: "still", battery: 0.55 },
  { id: "at", name: "Arjun Thakur", jobTitle: "Bar bender", team: "Crew B", color: "#9aa0a6", siteIds: ["s62", "cpr"], status: "idle", kind: "stale", battery: 0.09 },
  { id: "vs", name: "Vikas Singh", jobTitle: "Carpenter", team: "Crew B", color: "#f29900", siteIds: ["s62", "cpr"], status: "online", kind: "walk", battery: 0.62 },
  { id: "nk", name: "Neha Kumari", jobTitle: "Site engineer", team: "Crew C", color: "#d93025", siteIds: ["dwx"], status: "online", kind: "walk", battery: 0.88 },
  { id: "mf", name: "Mohammed Faizan", jobTitle: "Electrician", team: "Crew C", color: "#12b5cb", siteIds: ["dwx", "gmd"], status: "online", kind: "still", battery: 0.43 },
  { id: "gs", name: "Gurpreet Sandhu", jobTitle: "Crane operator", team: "Crew C", color: "#5f6368", siteIds: ["dwx"], status: "idle", kind: "still", battery: 0.31 },
  { id: "lm", name: "Lakshmi Menon", jobTitle: "Safety officer", team: "Crew D", color: "#e37400", siteIds: ["cpr", "s62"], status: "online", kind: "walk", battery: 0.77 },
  { id: "dp", name: "Deepak Pal", jobTitle: "Plumber", team: "Crew D", color: "#1e8e3e", siteIds: ["cpr"], status: "offline", kind: "stale", battery: 0.18 },
  { id: "ah", name: "Anil Hegde", jobTitle: "Welder", team: "Crew D", color: "#9334e6", siteIds: ["gmd"], status: "offline", kind: "stale", battery: 0.52 },
  { id: "rs", name: "Ritu Sharma", jobTitle: "Surveyor", team: "Crew C", color: "#174ea6", siteIds: ["dwx", "okw"], status: "online", kind: "vehicle", battery: 0.93 },
  { id: "bk", name: "Bhavesh Kale", jobTitle: "Painter", team: "Crew B", color: "#c5221f", siteIds: ["cpr"], status: "offline", kind: "stale", battery: 0.66 },
  { id: "sp", name: "Sanjay Prajapati", jobTitle: "Mason", team: "Crew A", color: "#b06000", siteIds: ["okw"], status: "invited", kind: "stale" },
  { id: "kr", name: "Kavita Rawat", jobTitle: "Helper", team: "Crew D", color: "#7627bb", siteIds: ["dwx"], status: "invited", kind: "stale" },
  { id: "hj", name: "Harish Joshi", jobTitle: "Carpenter", team: "Crew B", color: "#80868b", siteIds: ["gmd"], status: "deactivated", kind: "stale" },
];

function emailFor(name: string) {
  return `${name.toLowerCase().split(" ").join(".")}@buildcorp.in`;
}

export const CREW: CrewMember[] = CREW_SEEDS.map((seed, i) => {
  const isLive = seed.status === "online" || seed.status === "idle";
  const lastSeenAt =
    seed.status === "online"
      ? NOW - rand.int(5, 90) * 1000
      : seed.status === "idle"
        ? NOW - rand.int(64, 140) * MINUTE
        : seed.status === "offline"
          ? NOW - rand.int(5, 30) * HOUR
          : seed.status === "deactivated"
            ? NOW - 19 * DAY
            : undefined;
  return {
    id: seed.id,
    name: seed.name,
    email: emailFor(seed.name),
    phone: `+91 98${String(10_000_000 + i * 7_331_771).slice(0, 8)}`,
    jobTitle: seed.jobTitle,
    team: seed.team,
    appRole: seed.appRole ?? "worker",
    color: seed.color,
    status: seed.status,
    kind: seed.kind,
    siteIds: seed.siteIds,
    currentSiteId: isLive ? seed.siteIds[0] : undefined,
    battery: seed.battery,
    accuracy: isLive ? rand.int(4, seed.status === "idle" ? 60 : 18) : undefined,
    lastSeenAt,
    joinedAt: NOW - rand.int(20, 400) * DAY,
    mapX: isLive ? rand.between(0.18, 0.82) : undefined,
    mapY: isLive ? rand.between(0.2, 0.8) : undefined,
  };
});

/* ---------------------------------------------------------------- sessions */

function buildSessions(): PresenceSession[] {
  const sessions: PresenceSession[] = [];
  const todayStart = istDayStart(NOW);
  let n = 0;
  for (const person of CREW) {
    if (person.status === "invited") continue;
    for (let d = 13; d >= 0; d--) {
      const dayStart = todayStart - d * DAY;
      const weekday = new Date(dayStart + IST_OFFSET).getUTCDay();
      if (weekday === 0 && rand.chance(0.85)) continue; // Sundays mostly off
      if (person.status === "deactivated" && d < 20) continue;
      if (person.status === "offline" && d === 0) continue;
      if (rand.chance(0.07)) continue; // the odd day off

      const siteId = rand.pick(person.siteIds);
      const late = rand.chance(0.1);
      let cursor = dayStart + (8 * 60 + rand.int(late ? 80 : -20, late ? 130 : 25)) * MINUTE;
      const shiftEnd = dayStart + (17 * 60 + rand.int(0, 110)) * MINUTE;
      const breaks = rand.int(0, 2);

      for (let b = 0; b <= breaks; b++) {
        const isLast = b === breaks;
        const segEnd = isLast ? shiftEnd : cursor + rand.int(150, 230) * MINUTE;
        const isToday = d === 0;
        if (isToday && cursor > NOW) break;
        const open = isToday && segEnd > NOW && (person.status === "online" || person.status === "idle");
        const reason = isLast ? (rand.chance(0.08) ? "timeout" : "signed-off") : "paused";
        sessions.push({
          id: `ss${n++}`,
          personId: person.id,
          siteId,
          start: cursor,
          end: open ? undefined : Math.min(segEnd, isToday ? NOW - rand.int(70, 200) * MINUTE : segEnd),
          endReason: open ? undefined : reason,
        });
        if (open) break;
        cursor = segEnd + rand.int(20, 50) * MINUTE;
      }
    }
  }
  return sessions;
}

export const SESSIONS: PresenceSession[] = buildSessions();

/* ------------------------------------------------------------------ photos */

const TASKS = [
  "Column grid L4",
  "Shuttering · Block C",
  "Rebar tie-in · Bay 2",
  "Material delivery",
  "Slab casting · L5",
  "Waterproofing · Basement",
  "Electrical conduit · L3",
  "Facade anchors",
  "Safety audit",
  "Excavation progress",
  "Scaffolding check",
  "Plaster finish · L2",
];

const PLUS_PREFIX: Record<string, string> = {
  s62: "7JWVHJ",
  dwx: "7JWVG2",
  cpr: "7JWVJ6",
  gmd: "7JWVC3",
  okw: "7JWVG7",
};

function buildPhotos(): SitePhoto[] {
  const photos: SitePhoto[] = [];
  const shooters = CREW.filter(c => c.status !== "invited");
  for (let i = 0; i < 72; i++) {
    const person = rand.pick(shooters);
    const siteId = rand.pick(person.siteIds);
    const site = SITES.find(s => s.id === siteId)!;
    const ageDays = Math.floor(Math.pow(rand.next(), 1.6) * 9);
    const dayStart = istDayStart(NOW) - ageDays * DAY;
    let takenAt = dayStart + (9 * 60 + rand.int(0, 8 * 60)) * MINUTE;
    if (takenAt > NOW) takenAt = NOW - rand.int(3, 200) * MINUTE;
    const portrait = rand.chance(0.25);
    const width = portrait ? 1200 : 1600;
    const height = portrait ? 1600 : 1200;
    const seed = `site-${i}-${siteId}`;
    const isVideo = rand.chance(0.08);
    photos.push({
      id: `ph${i}`,
      thumbUrl: `https://picsum.photos/seed/${seed}/${portrait ? "360/480" : "480/360"}`,
      fullUrl: `https://picsum.photos/seed/${seed}/${width}/${height}`,
      width,
      height,
      mediaType: isVideo ? "video" : "photo",
      durationMs: isVideo ? rand.int(6, 30) * 1000 : undefined,
      personId: person.id,
      siteId,
      task: rand.pick(TASKS),
      takenAt,
      lat: site.lat + rand.between(-0.0006, 0.0006),
      lng: site.lng + rand.between(-0.0006, 0.0006),
      accuracy: rand.chance(0.15) ? rand.int(21, 48) : rand.int(3, 19),
      plusCode: `${PLUS_PREFIX[siteId]}+${"23456789CFGHJMPQRVWX"[rand.int(0, 19)]}${"23456789CFGHJMPQRVWX"[rand.int(0, 19)]}`,
    });
  }
  return photos.sort((a, b) => b.takenAt - a.takenAt);
}

export const PHOTOS: SitePhoto[] = buildPhotos();

/* ------------------------------------------------------------------ events */

function buildEvents(): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  const name = (id: string) => CREW.find(c => c.id === id)?.name ?? "Someone";
  const siteName = (id: string) => SITES.find(s => s.id === id)?.name ?? "a site";
  let n = 0;

  for (const s of SESSIONS) {
    if (s.start > NOW - 4 * DAY) {
      events.push({
        id: `ev${n++}`,
        at: s.start,
        kind: "arrive",
        personId: s.personId,
        siteId: s.siteId,
        text: `${name(s.personId)} arrived at ${siteName(s.siteId)}`,
        severity: "success",
      });
      if (s.end) {
        const paused = s.endReason === "paused";
        events.push({
          id: `ev${n++}`,
          at: s.end,
          kind: paused ? "pause" : "leave",
          personId: s.personId,
          siteId: s.siteId,
          text: paused
            ? `${name(s.personId)} paused location sharing`
            : s.endReason === "timeout"
              ? `${name(s.personId)} went offline — no signal for 15 min`
              : `${name(s.personId)} left ${siteName(s.siteId)}`,
          severity: paused || s.endReason === "timeout" ? "warn" : "info",
        });
      }
    }
  }

  // Photo uploads, batched per person per hour like the app's "Sync now".
  const batches = new Map<string, { at: number; personId: string; siteId: string; count: number }>();
  for (const p of PHOTOS) {
    if (p.takenAt < NOW - 4 * DAY) continue;
    const key = `${p.personId}-${Math.floor(p.takenAt / HOUR)}`;
    const batch = batches.get(key);
    if (batch) batch.count++;
    else batches.set(key, { at: p.takenAt + 4 * MINUTE, personId: p.personId, siteId: p.siteId, count: 1 });
  }
  for (const b of batches.values()) {
    if (b.at > NOW) continue;
    events.push({
      id: `ev${n++}`,
      at: b.at,
      kind: "upload",
      personId: b.personId,
      siteId: b.siteId,
      text: `${name(b.personId)} uploaded ${b.count} photo${b.count > 1 ? "s" : ""} from ${siteName(b.siteId)}`,
      severity: "info",
    });
  }

  events.push(
    { id: `ev${n++}`, at: NOW - 38 * MINUTE, kind: "battery", personId: "at", siteId: "s62", text: "Arjun Thakur — phone battery at 9%", severity: "warn" },
    { id: `ev${n++}`, at: NOW - 64 * MINUTE, kind: "idle", personId: "at", siteId: "s62", text: "Arjun Thakur has sent no update for 1 hour", severity: "warn" },
    { id: `ev${n++}`, at: NOW - 71 * MINUTE, kind: "idle", personId: "gs", siteId: "dwx", text: "Gurpreet Sandhu has sent no update for 1 hour", severity: "warn" },
    { id: `ev${n++}`, at: NOW - 26 * HOUR, kind: "invite", personId: "sp", siteId: "okw", text: "Invite sent to Sanjay Prajapati", severity: "info" },
    { id: `ev${n++}`, at: NOW - 30 * HOUR, kind: "invite", personId: "kr", siteId: "dwx", text: "Invite sent to Kavita Rawat", severity: "info" },
    { id: `ev${n++}`, at: NOW - 6 * DAY, kind: "site", siteId: "okw", text: "Site created — Okhla Logistics Warehouse", severity: "success" },
  );

  return events.filter(e => e.at <= NOW).sort((a, b) => b.at - a.at);
}

export const EVENTS: ActivityEvent[] = buildEvents();
