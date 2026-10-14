# Site Tracker — Admin Dashboard

Web console for the Site Tracker mobile app. It reads the **same Firebase
project** the app uses (Auth, Firestore, Realtime Database), live. Only an
active **owner** account can sign in.

## Run it

```bash
npm install
# .env.local needs the Firebase web config (same project as the app):
#   NEXT_PUBLIC_FIREBASE_API_KEY, _AUTH_DOMAIN, _PROJECT_ID,
#   _MESSAGING_SENDER_ID, _APP_ID, _DATABASE_URL
npm run dev        # http://localhost:3000
npm run build
npm run lint
npm test           # checks the presence / session derivations
```

Deploy the latest `firestore.rules` from the app repo first
(`firebase deploy --only firestore:rules`), or the dashboard shows permission
errors: it relies on the `sessions` collection and the owner-writable
`siteIds`, `email`, `phone`, `team` and `invitedAt` fields on `people`.

## What's in it

| Page | Shows |
|---|---|
| **Overview** | Who is online, hours and photos (today / week), attendance trend, needs-attention list, per-site headcount, latest photos, activity |
| **Live map** | Last reported position of every person (OpenStreetMap, no key), filterable by site (crew assigned to it) and status |
| **Sites** / detail | Projects, their crew, hours, photos, activity, a map of their crew; change status, assign crew |
| **Crew** / profile | Roster, invite (creates the account and emails a set-password link), assign sites, deactivate; profile with 7-day online/offline timeline and last known location |
| **Photos** | Every geotagged capture, filtered by site, person, date, type; thumbnails first, original on open |
| **Attendance** | Crew × day grid and per-day timeline from check-in sessions; timesheet CSV |
| **Activity** | Event history filtered by type and site |

A site has a name, a status, a manager and its crew. It has **no location**:
the dashboard never asks for one. Locations come from the phones (live
positions, photo geotags).

## Where the data comes from

| Dashboard | Firebase |
|---|---|
| Crew | Firestore `people` + Realtime DB `positions/{uid}` |
| Sites | Firestore `sites` |
| Hours, attendance, timelines | Firestore `sessions` (written by the app at check-in / check-out / pause / resume) |
| Photos | Firestore `photos` (files and thumbnails in Supabase Storage) |
| Activity | Firestore `events` |

`src/lib/live.ts` turns those documents into what the views show (status:
online / idle / offline / invited / deactivated, session end times, photo and
event mapping). It is the file to read first.

## Limits

- Only the newest 300 photos and 300 events are loaded, and 15 days of sessions.
- A session the worker never checked out of is closed in the dashboard from
  their last position fix (or capped at 12 h); that end time is an estimate.
- Photos taken before the app recorded a site show under "No site".
- If creating a crew account fails halfway, the email can be left registered
  with no profile; remove it in the Firebase console.
- Alert rules, shift hours and photo retention are not here: nothing would act
  on them without a scheduled sender.

## Saved copy in the browser

Firestore data is cached in the browser (IndexedDB), so a reload re-reads only
what changed (within about 30 minutes of the last visit) instead of every
document. The saved copy is wiped when you sign out. The cache is set up in
`src/lib/firebase.ts`; the sessions query uses a cutoff rounded to the start of
the day (`src/lib/store.tsx`) so the saved copy can resume it.

## Deleting photos

Photos tab → Select (or open a photo → Delete). Removes the original file, the thumbnail and the Firestore record, via the server route `/api/photos/delete` (owners only; files first, record last).

- Needs `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (Supabase → Settings → API; **no** `NEXT_PUBLIC_` prefix, never commit it). Restart after adding.
- Needs the app repo's `firestore.rules` deployed (`firebase deploy --only firestore:rules`).
- Hosting must run a Node server (not a static export).
