# Work Log

Running record of changes that are **not yet in commit history**, plus the defects and
decisions behind them. Newest entry last. Once a batch is committed, its entry can be
deleted — git history then owns it.

Baseline: `main` @ `f1795b1` ("Make the deploy pipeline fail when it deploys nothing"). Everything
before it — SignalR/Redis/forwarded-header fixes, enum drift, dead-file cleanup, PDF removal, B1,
the deploy/migration ops fix — is in git history (`7f1a758`, `6748dbd`, `d23840a`, `f1795b1`) and no
longer needs an entry here.

---

## Verified defects — not yet fixed

Found by reading code. #4–#6 and #10–#13 are confirmed by cross-referencing source; #7 and #8 are
**inferences** from middleware order and page wiring, never executed against a running instance
(production `/swagger` returning the SPA's `index.html` is the same fallback behaviour, so #7 is
almost certainly real).

| # | Defect | Where | Planned fix |
|---|---|---|---|
| 4 | `TripSheet.Version` / `TripSheetItem.Version` are `byte[]` + `[Timestamp]` → nullable `bytea` columns with no generator, so `DbUpdateConcurrencyException` handling in the DAL is dead code. | migration `20261109131304_Phase1_TripSheet_Core` | B5 — map to `xmin` like `Job` |
| 5 | `TripSheetsController` exposes only GETs; `frontend/src/api/endpoints.ts` calls create, add-jobs, remove-job, reorder, depart, return, complete, cancel, delete. Every mutation 404s. | controller vs. `endpoints.ts:103+` | B2 |
| 6 | `createdByUserId: 1, // TODO: get from auth context` — an admin is fabricated. | `DispatchBoardPage.tsx:101` | B3 |
| 7 | `MapFallbackToFile("index.html")` can swallow unmatched `/api/*` routes, answering HTML instead of 404. | `Program.cs:228` | backlog |
| 8 | No `GET /api/users`, so the admin page can only list drivers. | `AdminUsersPage` | backlog |
| 10 | Print CSS hides `#root` with `visibility: hidden`, which keeps layout, so the full board still occupies flow above the manifest — likely blank page(s) before the manifest prints. | `frontend/src/index.css` `@media print` | B3 |
| 11 | Print CSS forces `body` white but not the design tokens: in dark theme `--text-main` is near-white, and browsers drop background colours, so the manifest can print white-on-white. | `frontend/src/index.css` `@media print` | B3 |
| 12 | The "Delivered Today" stat tile shows `summary.jobsCreatedToday`, so it is a created-today count under a delivered label. | `DashboardPage.tsx:76` (`// or delivered count`) | decide: rename the tile or add a delivered-today count to the DTO |
| 13 | Trip-sheet reads are `[Authorize]` only: any authenticated user (including a driver) can read any sheet or any driver's sheets by id. | `TripSheetsController` | B2 — role gates + driver ownership |

**Fixed:** #1–#3 (dispatch queue) in `d23840a`; #9 (unguarded/mute migrations) in `f1795b1`. Live is
repaired: `/api/jobs`, `/api/tripsheets/open`, `/api/dashboard/summary` and `/health` all 200, and
demo data was reset to the two seeded jobs. #12 and #13 were found during the docs audit and are
still open.

---

## Verification performed

| Command | Result | When |
|---|---|---|
| `dotnet build DispatchTrack.slnx` | 0 errors (2 pre-existing `NU1510` warnings on the explicit SignalR package ref) | 2026-11-11, ops |
| `dotnet test` (full suite) | 60/60 passed against the dev Neon database | 2026-11-11, B1 and ops |
| `dotnet run` → startup log | `Database schema is up to date.` emitted before `Now listening on` | 2026-11-11, ops |
| CI #27 on `f1795b1` | success | 2026-11-12 |
| Deploy to Render #25 on `f1795b1` | success, step 2 `Trigger Render Deploy Hook`: `completed/success` (first real deploy) | 2026-11-12 |
| Live `/health`, `/api/jobs`, `/api/tripsheets/open`, `/api/dashboard/summary` | 200 / 200 / 200 `[]` / 200 with `totalJobs: 2` | 2026-11-12 |
| `npm run build` (`tsc -b && vite build`) | exit 0. The real typecheck gate — `npx tsc --noEmit` is a no-op here because `frontend/tsconfig.json` has `"files": []`. | 2026-11-11, B1 |
| `npm run lint` (oxlint) | 0 warnings, 0 errors | 2026-11-11, B1 |

**Not verified:** whether `MigrateOnStartup=true` exists on Render. With nothing pending, the startup
log prints `Database schema is up to date.` either way; the next schema change (B5) reveals it.

---

## Known environment facts

- The dev machine's `appsettings.Development.json` and the Render service point at the **same Neon
  database**, so a local `dotnet ef database update` is a production change. That is how
  `Phase1_TripSheet_Core` and `DropJobDispatchPlan` reached production.
- Render apparently never ran migrations: Phase 1 (merged 2026-11-09) was still unapplied on
  2026-11-11. It was applied manually from the dev machine, so the deployed app now matches.
  Whether `MigrateOnStartup=true` is set on the service is still unconfirmed.
- The demo driver is seeded `Available` while its one assigned job exists, and `POST /api/demo/reset`
  re-creates users/drivers, so driver ids advance (30 → 32). Never hardcode seeded ids.

---

## Next steps

| Slice | Content | Status |
|---|---|---|
| **B2** | TripSheet response DTOs (stop leaking entities + `byte[] Version`), write endpoints with role gates and driver-ownership checks (#13), 201/204/404/409. Wire `changedByUserId` from the JWT. | next up |
| **B3** | Board wiring: real `createdByUserId` (#6), drop dead status chips, wire drag-drop to `addJobs`, fix print defects #10/#11 | planned |
| **B4** | `ISignalRService` broadcasts for trip-sheet changes | planned |
| **B5** | Concurrency token → `xmin` on `TripSheet`/`TripSheetItem` + two-writer test (#4) | approved |
| **B6** | `TripSheetWorkflowIntegrationTests` (create → add → depart → return → complete; duplicate number; non-queue job) + HTTP-level coverage once B2 exists | planned |
| **R1/R2** | Stop sequencing then the real OSRM route line in the board — mapping and sizes in `docs/ROUTE_PLANNING_INTEGRATION_PLAN.md` | planned (after B3) |
| **R3/R4** | Geocoding, then the optional `/route-planning` page | planned (after B6) |
| backlog | #7 SPA fallback swallows `/api` 404s, #8 no `GET /api/users`, #12 mislabelled stat tile, remove committed Playwright artifacts | backlog |
