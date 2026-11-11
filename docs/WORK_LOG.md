# Work Log

Running record of changes that are **not yet in commit history**, plus the defects and
decisions behind them. Newest entry last. Once a batch is committed, its entry can be
deleted — git history then owns it.

Baseline: `main` @ `6748dbd` ("Replace server-side PDF export with browser print"). Everything
before that — SignalR/Redis/forwarded-header fixes, enum drift, dead-file cleanup, PDF removal —
is in `7f1a758` and `6748dbd`, and CI #25 passed on it.

---

## 2026-11-11 — B1: dispatch queue derived from job status

**Decision:** delete `Job.DispatchPlan`. Nothing ever wrote it, while trip-sheet creation required
`== 1`, so the feature rejected every job.

| File | Change |
|---|---|
| `DispatchTrack.API/Models/Job.cs` | `DispatchPlan` removed. |
| `DispatchTrack.API/Migrations/20261111112628_DropJobDispatchPlan.cs` | **New.** `ALTER TABLE "Jobs" DROP COLUMN "DispatchPlan"`; verified with `dotnet ef migrations script`. |
| `DispatchTrack.API/Services/TripSheetService.cs` | Queue = `Status == Pending && TripSheetId == null`. Create/add set `Status = Assigned` and write `StatusHistory` (Pending → Assigned); remove/cancel/delete set `Status = Pending` and write the reverse row. Create runs in one transaction. Delete returns its jobs to the queue instead of leaving them `Assigned` to a sheet that no longer exists. |
| `DispatchTrack.API/Data/DAL/TripSheetDAL.cs` | `CancelAsync` resets job `Status` (was: only nulled the driver, leaving the job invisible to both the board and the queue); `DepartAsync` no longer touches jobs. |
| `DispatchTrack.API/Services/ITripSheetService.cs`, `Data/DAL/ITripSheetDAL.cs` | Mutations take `changedByUserId` so `StatusHistory` records who moved the job. |
| `DispatchTrack.API.Tests/TripSheetQueueIntegrationTests.cs` | **New.** Create assigns jobs + history; cancel returns them to the queue and they can be dispatched again. |
| `DispatchTrack.API/Controllers/DemoController.cs` | `ResetDemoData` deleted `Jobs` before `TripSheets`, so once any trip sheet existed the FK restriction made `/api/demo/reset` fail. Now deletes items → sheets → jobs. Exposed by the new tests. |
| `frontend/src/types/index.ts` | Dead `DispatchPlan` type removed. |
| `docs/ROUTE_PLANNING_INTEGRATION_PLAN.md` | Workflow table and migration notes describe the status-based queue. |

**Not changed, deliberately:** departing a trip does not move its jobs to `InTransit`; that stays
the driver's job-status endpoint. Completing leaves jobs at `Assigned` for the same reason.

---

## Verified defects — not yet fixed

Found by reading code. #4–#6 are confirmed by cross-referencing source; #7 and #9 are
**inferences** from middleware order, never executed against a running instance.

| # | Defect | Where | Planned fix |
|---|---|---|---|
| 4 | `TripSheet.Version` / `TripSheetItem.Version` are `byte[]` + `[Timestamp]` → nullable `bytea` columns with no generator, so `DbUpdateConcurrencyException` handling in the DAL is dead code. B1 is the first code to insert/update/delete these rows. | migration `20261109131304_Phase1_TripSheet_Core` | B5 — map to `xmin` like `Job` |
| 5 | `TripSheetsController` exposes only GETs; `frontend/src/api/endpoints.ts` calls create, add-jobs, remove-job, reorder, depart, return, complete, cancel, delete. Every mutation 404s. | controller vs. `endpoints.ts:103+` | B2 |
| 6 | `createdByUserId: 1, // TODO: get from auth context` — an admin is fabricated. | `DispatchBoardPage.tsx:101` | B3 |
| 7 | `MapFallbackToFile("index.html")` can swallow unmatched `/api/*` routes, answering HTML instead of 404. | `Program.cs:228` | backlog |
| 8 | No `GET /api/users`, so the admin page can only list drivers. | `AdminUsersPage` | backlog |
| 9 | `Database.MigrateAsync()` runs unguarded at startup — a DB outage crashes the container instead of surfacing on `/health`. | `Program.cs:183-185` | Tier C |
| 10 | Print CSS hides `#root` with `visibility: hidden`, which keeps layout, so the full board still occupies flow above the manifest — likely blank page(s) before the manifest prints. | `frontend/src/index.css` `@media print` | B3 |
| 11 | Print CSS forces `body` white but not the design tokens: in dark theme `--text-main` is near-white, and browsers drop background colours, so the manifest can print white-on-white. | `frontend/src/index.css` `@media print` | B3 |

---

## Verification performed

| Command | Result | When |
|---|---|---|
| `dotnet build DispatchTrack.slnx` | 0 errors (2 pre-existing `NU1510` warnings on the explicit SignalR package ref) | 2026-11-11, B1 |
| `dotnet ef migrations add DropJobDispatchPlan` | scaffolded; previewed with `dotnet ef migrations script <previous>` → `ALTER TABLE "Jobs" DROP COLUMN "DispatchPlan"` only | 2026-11-11, B1 |
| `npm run build` (`tsc -b && vite build`) | exit 0 (only the >500 kB chunk-size warning). The real typecheck gate — `npx tsc --noEmit` is a no-op here because `frontend/tsconfig.json` has `"files": []`. | 2026-11-11, B1 |
| `npm run lint` (oxlint) | 0 warnings, 0 errors | 2026-11-11, B1 |
| `dotnet test` (full suite) | **60/60 passed** against the dev Neon database — the first local run of the suite. | 2026-11-11, B1 |

**Side effect of that run:** the dev Neon database had only `InitialCreate` applied, so
`MigrateOnStartup=true` applied `Phase1_TripSheet_Core` **and** `DropJobDispatchPlan` to it. The
trip-sheet tables exist there now; `Job.DispatchPlan` is gone. No data was lost — the column was
always `0`.

**Not fixed / not attempted:** the print-CSS defects (#10/#11) and Tier C/D items.

---

## Next steps

| Slice | Content | Status |
|---|---|---|
| **B2** | TripSheet response DTOs (stop leaking entities + `byte[] Version`), write endpoints with role gates and driver-ownership checks, 201/204/404/409. Wire `changedByUserId` from the JWT. | next up |
| **B3** | Board wiring: real `createdByUserId`, drop dead status chips, wire drag-drop to `addJobs`, fix print defects #10/#11 | planned |
| **B4** | `ISignalRService` broadcasts for trip-sheet changes | planned |
| **B5** | Concurrency token → `xmin` on `TripSheet`/`TripSheetItem` + two-writer test | approved |
| **B6** | `TripSheetWorkflowIntegrationTests` (create → add → depart → return → complete; duplicate number; non-queue job; cancel returns to queue) + HTTP-level coverage once B2 exists | planned |

---

## Working tree inventory (B1, uncommitted)

**New:** `DispatchTrack.API.Tests/TripSheetQueueIntegrationTests.cs`,
`DispatchTrack.API/Migrations/20261111112628_DropJobDispatchPlan.cs` (+ `.Designer.cs`)

**Modified (10):** `DispatchTrack.API/{Models/Job.cs,Services/TripSheetService.cs,Services/ITripSheetService.cs,Data/DAL/TripSheetDAL.cs,Data/DAL/ITripSheetDAL.cs,Controllers/DemoController.cs,Migrations/AppDbContextModelSnapshot.cs}`,
`docs/{ROUTE_PLANNING_INTEGRATION_PLAN.md,WORK_LOG.md}`, `frontend/src/types/index.ts`
