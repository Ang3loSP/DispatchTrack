# Work Log

Running record of changes that are **not yet in commit history**, plus the defects and
decisions behind them. Newest entry last. Once a batch is committed, its entry can be
deleted — git history then owns it.

Baseline: `main` @ `d23840a` ("Derive the dispatch queue from job status instead of
DispatchPlan"). Everything before it — SignalR/Redis/forwarded-header fixes, enum drift,
dead-file cleanup, PDF removal, B1 — is in `7f1a758`, `6748dbd` and `d23840a`.

---

## 2026-11-11 — ops: the deploy pipeline never deployed

**Finding:** `Deploy to Render` has never once called the deploy hook. GitHub's API shows step 2
(`Trigger Render Deploy Hook`) `completed/skipped` on every run — #21, #22, #23, #24 — because the
step was guarded by `if: env.RENDER_DEPLOY_HOOK != ''`. The secret is not set, so the step was
skipped, the job still reported **success**, and Render (auto-deploy OFF) kept serving whatever was
last deployed manually. That is why live `/api/jobs` 500s after `DropJobDispatchPlan`: production is
several commits behind and still maps the dropped column.

| File | Change |
|---|---|
| `.github/workflows/deploy.yml` | Missing `RENDER_DEPLOY_HOOK` now fails the workflow (`::error` + `exit 1`) instead of skipping silently; `curl -fsS` so an HTTP error also fails. Dropped the "Wait for deploy (optional)" step, which only echoed text. |
| `DispatchTrack.API/Program.cs` | Startup now logs migration state on every boot: `Database schema is up to date.`, or the list of pending migrations (applied, or — when `MigrateOnStartup` is false — a warning naming `dotnet ef database update`). A failed migration logs critical and rethrows. Closes defect #9. |
| `README.md`, `AGENTS.md` | Claimed Render pulls the image from GHCR; it rebuilds from source. CI's docker job uses `push: false`. |

Verified: `dotnet build` 0 errors; full suite 60/60; a real `dotnet run` logged
`Database schema is up to date.` on startup.

**Still needed from Angelo:** add `RENDER_DEPLOY_HOOK` to the repo secrets (Render dashboard →
service → Settings → Deploy Hook, then append `?deploy=true` if absent), or hit **Manual Deploy** in
Render once. Either one ships `d23840a` and repairs live.

---

## Verified defects — not yet fixed

Found by reading code. #4–#6 are confirmed by cross-referencing source; #7 and #8 are
**inferences** from middleware order and page wiring, never executed against a running instance.

| # | Defect | Where | Planned fix |
|---|---|---|---|
| 4 | `TripSheet.Version` / `TripSheetItem.Version` are `byte[]` + `[Timestamp]` → nullable `bytea` columns with no generator, so `DbUpdateConcurrencyException` handling in the DAL is dead code. | migration `20261109131304_Phase1_TripSheet_Core` | B5 — map to `xmin` like `Job` |
| 5 | `TripSheetsController` exposes only GETs; `frontend/src/api/endpoints.ts` calls create, add-jobs, remove-job, reorder, depart, return, complete, cancel, delete. Every mutation 404s. | controller vs. `endpoints.ts:103+` | B2 |
| 6 | `createdByUserId: 1, // TODO: get from auth context` — an admin is fabricated. | `DispatchBoardPage.tsx:101` | B3 |
| 7 | `MapFallbackToFile("index.html")` can swallow unmatched `/api/*` routes, answering HTML instead of 404. | `Program.cs:228` | backlog |
| 8 | No `GET /api/users`, so the admin page can only list drivers. | `AdminUsersPage` | backlog |
| 10 | Print CSS hides `#root` with `visibility: hidden`, which keeps layout, so the full board still occupies flow above the manifest — likely blank page(s) before the manifest prints. | `frontend/src/index.css` `@media print` | B3 |
| 11 | Print CSS forces `body` white but not the design tokens: in dark theme `--text-main` is near-white, and browsers drop background colours, so the manifest can print white-on-white. | `frontend/src/index.css` `@media print` | B3 |

**Fixed:** #1–#3 (dispatch queue) in `d23840a`; #9 (unguarded/mute migrations) in this commit.

---

## Verification performed

| Command | Result | When |
|---|---|---|
| `dotnet build DispatchTrack.slnx` | 0 errors (2 pre-existing `NU1510` warnings on the explicit SignalR package ref) | 2026-11-11, ops |
| `dotnet test` (full suite) | 60/60 passed against the dev Neon database | 2026-11-11, B1 and ops |
| `dotnet run` → startup log | `Database schema is up to date.` emitted before `Now listening on` | 2026-11-11, ops |
| `npm run build` (`tsc -b && vite build`) | exit 0. The real typecheck gate — `npx tsc --noEmit` is a no-op here because `frontend/tsconfig.json` has `"files": []`. | 2026-11-11, B1 |
| `npm run lint` (oxlint) | 0 warnings, 0 errors | 2026-11-11, B1 |

**Not verified:** the `MigrateOnStartup` warning branch (nothing is pending locally, and rolling the
database back to force it was not worth it) and the `deploy.yml` change (it needs a push to run).

---

## Known environment facts

- The dev machine's `appsettings.Development.json` and the Render service point at the **same Neon
  database**, so a local `dotnet ef database update` is a production change. That is how
  `Phase1_TripSheet_Core` and `DropJobDispatchPlan` reached production.
- Render apparently never ran migrations: Phase 1 (merged 2026-11-09) was still unapplied on
  2026-11-11. `MigrateOnStartup=true` is either missing from the service or never took effect; the
  new startup log will say which on the next boot.

---

## Next steps

| Slice | Content | Status |
|---|---|---|
| — | Angelo adds `RENDER_DEPLOY_HOOK`, deploys `d23840a`, confirms `/api/jobs` 200 | blocking live |
| **B2** | TripSheet response DTOs (stop leaking entities + `byte[] Version`), write endpoints with role gates and driver-ownership checks, 201/204/404/409. Wire `changedByUserId` from the JWT. | next up |
| **B3** | Board wiring: real `createdByUserId`, drop dead status chips, wire drag-drop to `addJobs`, fix print defects #10/#11 | planned |
| **B4** | `ISignalRService` broadcasts for trip-sheet changes | planned |
| **B5** | Concurrency token → `xmin` on `TripSheet`/`TripSheetItem` + two-writer test | approved |
| **B6** | `TripSheetWorkflowIntegrationTests` (create → add → depart → return → complete; duplicate number; non-queue job) + HTTP-level coverage once B2 exists | planned |

---

## Working tree inventory (ops, uncommitted)

**Modified (4):** `.github/workflows/deploy.yml`, `DispatchTrack.API/Program.cs`, `README.md`,
`AGENTS.md` — plus this log.
