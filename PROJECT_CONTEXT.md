# Project context — Site Tracker Admin Dashboard

Read this first (it is short). Full detail: [DOCUMENTATION.md](DOCUMENTATION.md).
Sibling repo: the Android app, `C:\Projects\Perso\Site-tracker` (Expo/React Native). Same Firebase project.

## What this is, in five lines

- Next.js 16 (App Router) + React 19 + TS + Tailwind 4 + shadcn. **No own backend/database**: the browser talks to Firebase directly.
- Only active **owner / superadmin** accounts may sign in (`people/{uid}.appRole`). Firestore **rules are the real gate** and live in the *app* repo.
- Live data: one `onSnapshot` per collection in `src/lib/store.tsx`, derived by `src/lib/live.ts` (read it first).
- Server routes (`src/app/api/*`) only for what a browser can't do: delete photo files / login accounts / bulk wipes (service keys).
- All dates are **Nepal time (UTC+5:45)** via `src/lib/time.ts` / `format.ts`.

## Commands

`npm run dev` · `npm run build` · `npm run lint` · `npx tsc --noEmit` · `npm test` (needs Node ≥ 22.18, otherwise
`node --experimental-strip-types --test src/lib/live.test.ts src/lib/reset.test.ts`).

## Rules for working here

1. **Next.js 16 differs from what you may remember.** Read the matching guide in `node_modules/next/dist/docs/` before framework-level changes (`AGENTS.md`).
2. **Don't break the photo-deletion invariant**: original + `_thumb.jpg` + Firestore record, files first, record last, only through `deletePhotoCompletely`.
3. Writes go through `src/lib/admin.ts`, called with `attempt()` so they toast on failure and are audited (`adminAudit`).
4. `lib/live.ts`, `reset.ts`, `cleanup.ts`, `usage.ts`, `photoFiles.ts` stay pure: relative imports **with `.ts`**, no `@/` alias, no React — they're unit-tested with `node --test`.
5. Never import `firebaseAdmin.ts` or read `SUPABASE_SERVICE_ROLE_KEY` in client code. Never print, log or commit secret values (`.env*` is gitignored).
6. A new collection/field = a rules change in the **app repo** (`firestore.rules`) + deploy, and an update to **both** `DOCUMENTATION.md` files.
7. Never `git commit` / `git push` unless the user asks in that moment (house rule in the app repo, kept here too).

## Current state (2026-11-04)

- Branch `develop` @ `857088f` + **uncommitted** Projects / project-stock / allocation work (see DOCUMENTATION §14).
- 🚨 Known blocker: `projects`, `projectInventory`, `siteInventory`, `inventoryUsage` have **no Firestore rules** in the app repo's `origin/main` → dashboard shows a permission error and renders nothing until rules are added and deployed.
- Phone app does not yet use the new inventory model (still writes `inventory`).
- Local `.env` lacks `FIREBASE_ADMIN_*` → people/site deletion routes return 500.
- `npm test` fails on Node 22.14 (type stripping); `tsc` clean; 49 tests pass with the flag.

## Codebase Knowledge Graph (Graphify)

- Structural graph & dependency report: [graphify-out/GRAPH_REPORT.md](graphify-out/GRAPH_REPORT.md) (1021 nodes, 3963 edges, 34 communities).
- Interactive visualizer: `graphify-out/graph.html` (open in browser).
- To generate/refresh the graph: `graphify . --code-only; graphify cluster-only .`.

## 📌 Documentation protocol (standing instruction for the AI assistant)

**Keep reminding the user to update the documentation.** After any task that changes code, config, schema, env vars, routes or UI
behaviour, finish the reply with one line, e.g.:

> 📝 Docs: update DOCUMENTATION.md §<n> (<what>) and add a line to the changelog in PROJECT_CONTEXT.md — want me to do it?

- Offer to make the edit (or make it, if the user already said to keep docs in sync). Use the sync table in DOCUMENTATION.md §16.
- If the change touches shared Firebase data, also remind about the Android repo's `DOCUMENTATION.md`.
- At the start of a session in this repo, skim this file; if the working tree has changes the docs don't mention, say so.
- Don't nag on pure questions or no-op tasks. One line, not a lecture.

## Changelog (newest first)

| Date | Change | Docs updated |
|---|---|---|
| 2026-11-04 | Generated Graphify knowledge graph (`graph.json`, `GRAPH_REPORT.md`, 1021 nodes, 3963 edges) under git Option B. | yes |
| 2026-11-04 | Created `DOCUMENTATION.md`, `PROJECT_CONTEXT.md`; added pointer in `AGENTS.md`. Full codebase review (dashboard + Android app at `origin/main`). | yes (initial) |

