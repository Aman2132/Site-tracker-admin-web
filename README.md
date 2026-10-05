# Site Tracker — Admin Dashboard (static prototype)

Web admin console for the Site Tracker mobile app: sites, crew, online/offline
history, attendance and geotagged photos. **This build is static** — every
number comes from a seeded mock dataset, nothing talks to Firebase or a server.
It exists to agree the UX with the client before the backend is wired in.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build (type-checks too)
npm run lint
```

## What's in it

| Page | What it shows |
|---|---|
| **Overview** | Live crew presence, hours/photos today vs last week, attendance trend, needs-attention list, per-site headcount, latest photos, live activity |
| **Sites** / **Site detail** | Site cards with geofence preview and progress; detail page with live schematic map, who's on site, hours per day, assigned crew, photos, activity |
| **Crew** / **Profile** | Filterable roster (online / idle / offline / invited / deactivated), CSV export, assign sites, deactivate; profile with 7-day online/offline timeline, time split (walk/drive/still), hours, photos |
| **Photos** | Gallery filtered by site, person, date and media type, grouped by day; thumbnails first, full resolution in the lightbox (← → Esc) |
| **Attendance** | Crew × day heat grid (late, lost signal, on shift now) and per-day timeline; timesheet CSV export |
| **Activity** | Full event history, filterable by type and site |
| **Settings** | Alert rules (idle 1 h, low battery, late arrival), role permissions preview, photo retention/storage, theme |

Global: **Add crew** (multi-step invite flow) and **Create site** (live geofence
preview) open from anywhere; **Ctrl/⌘ K** command palette; light/dark/system
theme; collapsible sidebar; responsive down to phone width.

Creating a site or crew member updates in-memory state for the browser
session only — a reload resets the demo.

## Stack

Next.js 16 (App Router) · TypeScript strict · Tailwind CSS v4 · shadcn/ui on
Base UI · Motion (animations) · Recharts · lucide-react · next-themes · sonner · cmdk.
Brand colours and the Plus Jakarta Sans font match the mobile app.

## Where things live

```
src/types/domain.ts        Domain model (mirrors the app, plus Site, sessions, siteId on photos)
src/lib/mock/data.ts       The seeded demo dataset — the only file to replace with real data
src/lib/insights.ts        Pure derivations: hours, attendance, presence, alerts
src/lib/store.tsx          In-memory demo state + actions (addCrew, addSite, assign…)
src/lib/format.ts          IST date/time formatting (hydration-safe)
src/components/views/      One view per page
src/components/domain/     App-specific pieces (SiteMap, Lightbox, PresenceTimeline, dialogs…)
src/components/charts/     Sparkline, Donut, AttendanceTrend, BarCompare
src/components/layout/     Shell, sidebar, top bar, command palette, theme toggle
src/components/ui/         shadcn primitives
```

## Going from mock to real

- Swap `src/lib/mock/data.ts` + `src/lib/store.tsx` for Firebase reads/listeners
  (roster, sites, photos metadata, events) and RTDB positions.
- **Sessions** (`PresenceSession`) don't exist in the backend yet: the worker app
  needs to write a session on start/pause/resume/sign-off for the attendance and
  timeline views to be real.
- Photos need a `siteId` at capture and a phone-generated thumbnail; the
  dashboard already loads `thumbUrl` first and `fullUrl` only in the lightbox.
- Add crew → Firebase account creation + set-password email; push alerts need a
  scheduled sender (Cloud Function or Cloudflare Worker).
- The site map is a schematic stand-in; swap in Google Maps or MapLibre for real tiles.
- Placeholder images come from picsum.photos, so they aren't construction photos.
