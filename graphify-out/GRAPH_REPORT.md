# Graph Report - site-tracker-admin  (2026-11-04)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1021 nodes · 3963 edges · 34 communities (27 shown, 7 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 15 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `38860b99`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Button
- resetServer.ts
- store.tsx
- live.test.ts
- Topbar.tsx
- ResetDataDialog.tsx
- CrewView.tsx
- admin.ts
- OverviewView.tsx
- SiteDetailView.tsx
- InventoryView.tsx
- AttendanceView.tsx
- crewMapShared.ts
- package.json
- dependencies
- components.json
- compilerOptions
- SitesView.tsx
- AuthProvider.tsx
- viewLog.ts
- auditLog.ts
- next
- @base-ui/react
- motion
- select.tsx
- AppShell.tsx
- scripts
- tabs.tsx
- scroll-area.tsx
- recharts
- postcss.config.mjs

## God Nodes (most connected - your core abstractions)
1. `Button()` - 82 edges
2. `react` - 69 edges
3. `lucide-react` - 53 edges
4. `useLiveStore()` - 51 edges
5. `InventoryView()` - 49 edges
6. `firebase()` - 44 edges
7. `CrewProfileView()` - 44 edges
8. `SiteDetailView()` - 41 edges
9. `PersonAvatar()` - 40 edges
10. `next` - 38 edges

## Surprising Connections (you probably didn't know these)
- `CrewProfilePage()` --calls--> `CrewProfileView()`  [EXTRACTED]
  src/app/(dashboard)/crew/[id]/page.tsx → src/components/views/CrewProfileView.tsx
- `SiteDetailPage()` --calls--> `SiteDetailView()`  [EXTRACTED]
  src/app/(dashboard)/sites/[id]/page.tsx → src/components/views/SiteDetailView.tsx
- `LiveCrewCard()` --indirect_call--> `isOnShift()`  [INFERRED]
  src/components/layout/Sidebar.tsx → src/lib/insights.ts
- `OverviewView()` --indirect_call--> `isOnShift()`  [INFERRED]
  src/components/views/OverviewView.tsx → src/lib/insights.ts
- `AttendanceCell` --references--> `PresenceSession`  [EXTRACTED]
  src/lib/insights.ts → src/types/domain.ts

## Import Cycles
- None detected.

## Communities (34 total, 7 thin omitted)

### Community 0 - "Button"
Cohesion: 0.06
Nodes (97): cn, lucide-react, react, sonner, AdminsPage(), metadata, metadata, ProjectPage() (+89 more)

### Community 1 - "resetServer.ts"
Cohesion: 0.06
Nodes (88): firebase-admin, Body, Ctx, findOrphanFiles(), Kind, POST(), previewOrphans(), previewPhotos() (+80 more)

### Community 2 - "store.tsx"
Cohesion: 0.06
Nodes (69): AuditPage(), metadata, FullImage(), Lightbox(), MetaPanel(), MetaRow(), NavButton(), AuditLogView() (+61 more)

### Community 3 - "live.test.ts"
Cohesion: 0.06
Nodes (60): geistMono, jakarta, metadata, RootLayout(), Meter(), StorageUsagePanel(), tone(), isActive() (+52 more)

### Community 4 - "Topbar.tsx"
Cohesion: 0.08
Nodes (49): next-themes@^0.4.6, next-themes, LiveMapPage(), metadata, metadata, SettingsPage(), AssignCrewSheet(), AssignSitesSheet() (+41 more)

### Community 5 - "ResetDataDialog.tsx"
Cohesion: 0.09
Nodes (46): STEPS, ResetDataDialog(), Stage, ResetDoneStep(), ResetReviewStep(), ResetRunStep(), ResetPhotoGrid(), BULK_ICONS (+38 more)

### Community 6 - "CrewView.tsx"
Cohesion: 0.14
Nodes (33): ActivityPage(), metadata, CrewPage(), metadata, metadata, PhotosPage(), EVENT_META, BatteryMeter() (+25 more)

### Community 7 - "admin.ts"
Cohesion: 0.09
Nodes (40): addInventoryEntry(), addProjectStock(), allocateProjectStock(), createProject(), createSite(), deleteInventoryEntry(), deletePerson(), deletePhotos() (+32 more)

### Community 8 - "OverviewView.tsx"
Cohesion: 0.12
Nodes (28): metadata, OverviewPage(), AttendanceTrend(), TICK, BarCompare(), ChartTooltip(), PresenceBar(), ATTENTION_ICON (+20 more)

### Community 9 - "SiteDetailView.tsx"
Cohesion: 0.21
Nodes (23): ActivityFeed(), DeletableLightbox(), Panel(), PersonAvatar(), SIZES, PhotoThumb(), StatusChip(), StatusDot() (+15 more)

### Community 10 - "InventoryView.tsx"
Cohesion: 0.13
Nodes (27): InventoryPage(), metadata, Table(), TableBody(), TableCell(), TableHead(), TableHeader(), TableRow() (+19 more)

### Community 11 - "AttendanceView.tsx"
Cohesion: 0.18
Nodes (25): AttendancePage(), metadata, END_LABEL, pos(), PresenceTimeline(), TimelineRuler(), TimelineTrack(), AttendanceView() (+17 more)

### Community 12 - "crewMapShared.ts"
Cohesion: 0.17
Nodes (23): leaflet, CrewMap(), CrewMapProps, FIT_PADDING_PX, hasPosition(), initialsOf(), Located, MAX_FIT_ZOOM (+15 more)

### Community 13 - "package.json"
Cohesion: 0.10
Nodes (25): eslintConfig, devDependencies, eslint@^9, eslint-config-next@16.3.8, tailwindcss@^4, @tailwindcss/postcss@^4, @types/google.maps@^3.66.5, @types/node@^20 (+17 more)

### Community 14 - "dependencies"
Cohesion: 0.07
Nodes (27): dependencies, @base-ui/react@^1.8.0, class-variance-authority@^0.7.1, cmdk@^1.1.1, cn@^0.4.0, date-fns@^4.4.0, firebase-admin@^14.5.0, jose@^6.2.12 (+19 more)

### Community 15 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 16 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib (+11 more)

### Community 17 - "SitesView.tsx"
Cohesion: 0.21
Nodes (14): metadata, SitesPage(), AvatarStack(), META, SiteStatusBadge(), siteStatusBar(), useDialogs(), Filter (+6 more)

### Community 18 - "AuthProvider.tsx"
Cohesion: 0.18
Nodes (14): firebase@^12.19.0, firebase, AuthContext, AuthContextValue, AuthProvider(), AuthState, clip(), logAdminAction() (+6 more)

### Community 19 - "viewLog.ts"
Cohesion: 0.21
Nodes (12): PageActivityLogger(), createViewGate(), externalTarget(), pageTitle(), ViewKind, actor, flushViews(), gate (+4 more)

### Community 20 - "auditLog.ts"
Cohesion: 0.17
Nodes (15): AuditFields, AuditKind, CHANGES_MAX, clip(), describeChanges(), describeFields(), failureReason(), FieldChange (+7 more)

### Community 21 - "next"
Cohesion: 0.17
Nodes (9): nextConfig, next, CrewProfilePage(), metadata, metadata, ProjectsPage(), metadata, SiteDetailPage() (+1 more)

### Community 22 - "@base-ui/react"
Cohesion: 0.22
Nodes (6): @base-ui/react, class-variance-authority, ToggleGroupContext, ToggleGroupItem(), Toggle(), toggleVariants

### Community 23 - "motion"
Cohesion: 0.21
Nodes (8): motion, Sparkline(), ORDER, StatCard(), TONES, STATUS_META, EASE_OUT, PresenceStatus

### Community 24 - "select.tsx"
Cohesion: 0.24
Nodes (3): SelectContent(), SelectScrollDownButton(), SelectScrollUpButton()

### Community 25 - "AppShell.tsx"
Cohesion: 0.39
Nodes (6): DashboardLayout(), AppShell(), listeners, readCollapsed(), subscribe(), LiveGate()

### Community 29 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, lint, start, test

## Knowledge Gaps
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Button` to `store.tsx`, `live.test.ts`, `Topbar.tsx`, `ResetDataDialog.tsx`, `CrewView.tsx`, `OverviewView.tsx`, `SiteDetailView.tsx`, `InventoryView.tsx`, `AttendanceView.tsx`, `crewMapShared.ts`, `package.json`, `dependencies`, `SitesView.tsx`, `AuthProvider.tsx`, `viewLog.ts`, `@base-ui/react`, `motion`, `select.tsx`, `AppShell.tsx`, `card.tsx`, `avatar.tsx`, `popover.tsx`, `scroll-area.tsx`?**
  _High betweenness centrality (0.159) - this node is a cross-community bridge._
- **Should `Button` be split into smaller, more focused modules?**
  _Cohesion score 0.05860246623605402 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `Button` to `store.tsx`, `live.test.ts`, `Topbar.tsx`, `ResetDataDialog.tsx`, `CrewView.tsx`, `OverviewView.tsx`, `SiteDetailView.tsx`, `InventoryView.tsx`, `AttendanceView.tsx`, `package.json`, `dependencies`, `SitesView.tsx`, `motion`, `select.tsx`, `AppShell.tsx`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **Should `resetServer.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05549450549450549 - nodes in this community are weakly interconnected._
- **Why does `next` connect `next` to `Button`, `store.tsx`, `live.test.ts`, `Topbar.tsx`, `CrewView.tsx`, `OverviewView.tsx`, `SiteDetailView.tsx`, `InventoryView.tsx`, `AttendanceView.tsx`, `package.json`, `dependencies`, `SitesView.tsx`, `viewLog.ts`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **Should `store.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.05907172995780591 - nodes in this community are weakly interconnected._
- **Should `live.test.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06198198198198198 - nodes in this community are weakly interconnected._