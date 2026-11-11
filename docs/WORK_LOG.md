# Work Log

Running record of changes that are **not yet in commit history**, plus the defects and
decisions behind them. Newest entry last. Once a batch is committed, its entry can be
deleted — git history then owns it.

Baseline: `main` @ `bb977c8` ("Fix: input focus loss on DispatchBoard… + Create Test Jobs button").

---

## 2026-11-10 — Uncommitted batch A1–A5 + C1 (deployment & realtime wiring)

Five fixes that had to land before the trip-sheet work could be deployed anywhere useful,
plus one proxy fix.

### A. Redis connection string normalization

| File | Change |
|---|---|
| `DispatchTrack.API/Services/RedisConnectionStrings.cs` | **New.** Converts `redis://` / `rediss://` URLs into the `host:port,password=…,ssl=true` form StackExchange.Redis expects. |
| `DispatchTrack.API/Program.cs` | Cache setup now calls `RedisConnectionStrings.Normalize(...)` before choosing Redis vs in-memory. |
| `DispatchTrack.API.Tests/RedisConnectionStringsTests.cs` | **New.** 7 cases: plain redis, redis with port, rediss/SSL, embedded password, empty/null passthrough, already-normalized form. |

**Why:** Upstash hands out `rediss://default:<pass>@host:6379`, and the Redis client does not
parse that as a URL — it treats the whole string as the host, with port 0. Passing it through
untouched means the dashboard cache silently degrades to "Redis unavailable, fall back to DB".

### B. Running correctly behind Render's TLS-terminating proxy

| File | Change |
|---|---|
| `DispatchTrack.API/Program.cs` | `ForwardedHeadersOptions` for `X-Forwarded-For` / `X-Forwarded-Proto` with `KnownIPNetworks.Clear()` **and** `KnownProxies.Clear()` (Render's edge IPs are dynamic); `UseHttpsRedirection()` **deleted**, `app.UseForwardedHeaders()` runs first so auth and rate limiting see the real scheme. |
| `DispatchTrack.API.Tests/AuthIntegrationTests.cs` | **New test** `Login_BehindTlsTerminatingProxy_ShouldSetSecureRefreshCookie`. |

**Why:** Render terminates TLS and forwards plain HTTP. Without forwarded headers the app sees
`http`, so the refresh-token cookie is issued **without `Secure`** and the redirect logic can loop.

### C. SignalR client actually re-authenticating

| File | Change |
|---|---|
| `frontend/src/services/signalr.ts` | `accessTokenFactory` reads the in-memory token via `getToken()` instead of a stale localStorage lambda; all three hubs re-register their handlers after `hub.off(...)` so a reconnect doesn't leave the UI deaf. |
| `frontend/src/context/AuthContext.tsx` | All three `initSignalR(...)` call sites (`:46,66,102`) pass `getAccessToken` rather than `() => localStorage.getItem('access_token')`. |
| `frontend/vite.config.ts` | Added `/hubs` proxy with `ws: true` so local dev WebSockets reach the API. |

**Why:** Access tokens live in memory (not localStorage), so the old lambda returned `null` on
every hub start. The dev proxy had no WebSocket entry, so hubs only worked in production.

### D. Enum drift between frontend and API

`OnDelivery` → `OnRoute`, and the non-existent `Urgent` priority dropped, in
`frontend/src/types/index.ts`, `frontend/src/components/ui/StatusBadge.tsx`, `frontend/src/pages/JobsPage.tsx`.
**Why it survived:** `JsonStringEnumConverter` serializes names, so a stale *inbound* name
(`priority: "Urgent"`) fails model binding with a **400** — loud but only on the write path. The
stale *outbound* name (`OnRoute`, which had no badge case) rendered unstyled text, which is the
half that went unnoticed.

### E. Removal of unused scaffolding

- `zod` removed from `frontend/package.json` / lockfile / README (never imported).
- Deleted `frontend/src/App.css` and `frontend/src/assets/{hero.png,react.svg,vite.svg}` (Vite template leftovers).

---

## 2026-11-11 — PDF export removed (DinkToPdf → browser print)

**Decision:** drop server-side PDF generation. A downloadable file was judged not worth an
unmaintained native dependency.

| File | Change |
|---|---|
| `DispatchTrack.API/DispatchTrack.API.csproj` | `DinkToPdf 1.0.8` reference removed. |
| `DispatchTrack.API/Program.cs` | `IPdfService` registration + `IConverter`/`SynchronizedConverter(new PdfTools())` singleton removed; both `using DinkToPdf…` lines gone. |
| `DispatchTrack.API/Services/PdfService.cs` | **Deleted** (223 lines: interface, converter wrapper, HTML manifest template). |
| `DispatchTrack.API/Controllers/TripSheetsController.cs` | `GET {id}/pdf` action, `_pdfService` field, ctor parameter, and unused `Services` import removed. Controller is now three read-only GETs. |
| `frontend/src/api/endpoints.ts` | `tripSheetApi.downloadPdf` removed. |
| `frontend/src/pages/DispatchBoardPage.tsx` | Blob-download handler and "Download PDF" button removed; the previously empty "Print Manifest" button now calls `window.print()`. |
| `frontend/src/index.css` | Added `@media print` block (~50 lines): hides the app shell, un-fixes the dialog overlay, unclamps the modal's max-height, releases the scroll container, hides dialog chrome, `@page` margin, `break-inside: avoid` per stop. |
| `docs/ROUTE_PLANNING_INTEGRATION_PLAN.md` | Phase 2 wording changed from wkhtmltopdf/PDF to browser print; phantom `TripSheetPdf.tsx` row replaced with the real component. |

**Why:** DinkToPdf needs the native `libwkhtmltox` library, which the Alpine runtime image does not
ship and cannot load (glibc vs musl). `GET /tripsheets/{id}/pdf` was guaranteed to return 500 in the
container. Worse, the controller took `IPdfService` in its constructor, so resolving *any* trip-sheet
endpoint touched the converter.

**Kept:** the manifest content itself — the modal renders trip info and every stop, and the browser's
"Save as PDF" produces the same document.

---

## 2026-11-11 — Tooling housekeeping

- `.agents/` added to `.gitignore` (agent skills/workflows are local tooling, not project material).
- `session-*.md` added to `.gitignore` (raw agent transcripts were sitting untracked in the repo root).
- `.agents/rules/modernization.md` deleted: it was `always_on` but pointed at an unrelated project
  (`PMDOnline_Master/MODERNIZATION_PLAN/…`), so it would have misdirected every future agent.
- `.agents/rules/graphify.md` kept; it is conditional on `graphify-out/graph.json`, which does not
  exist here, so it is inert until a graph is built.

---

## Verified defects — not yet fixed

Found by reading code. #1–#6 are confirmed by cross-referencing source; #7 and #9 are
**inferences** from middleware order and have not been executed against a running instance.

| # | Defect | Where | Planned fix |
|---|---|---|---|
| 1 | `DispatchPlan` is never set on job creation or seeding, so it is `0` for every job, while trip-sheet creation requires `== 1`. **Trip-sheet creation rejects every job.** The board looks fine only because it queries `Status == Pending`. | `DataSeeder.cs`, `JobsController.CreateJob`, `TripSheetService.cs:34,96` | B1 — delete the column, derive the queue |
| 2 | Creating a trip sheet sets the driver on jobs but never sets `Job.Status = Assigned` nor writes `StatusHistory`. | `TripSheetService.CreateTripSheetAsync` | B1 |
| 3 | Cancelling a trip sheet nulls `AssignedDriverId` but leaves `Status = Assigned`, so the job is neither assigned nor in the queue. | `TripSheetDAL` cancel path | B1 |
| 4 | `TripSheet.Version` / `TripSheetItem.Version` are `byte[]` + `[Timestamp]` → nullable `bytea` columns with no generator. `DbUpdateConcurrencyException` handling in the DAL is effectively dead code. | migration `20261109131304_Phase1_TripSheet_Core` | B5 — map to `xmin` like `Job` |
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
| `dotnet build DispatchTrack.API` | 0 errors, 2 warnings (pre-existing `NU1510` on the explicit SignalR package ref) | 2026-11-11, after PDF removal |
| `dotnet test --filter RedisConnectionStringsTests` | 7/7 passed (§A) | 2026-11-10 |
| `npx tsc --noEmit` | exit 0 — **but a no-op**: `frontend/tsconfig.json` is `{"files": [], "references": [...]}`, so it type-checks nothing. Do not use as a gate. | 2026-11-11 |
| `npm run lint` (oxlint) | 0 warnings, 0 errors | 2026-11-11 |
| `npm run build` (`tsc -b && vite build`) | exit 0 (only the >500 kB chunk-size warning). This is the real typecheck gate — it caught a `accessTokenFactory` type error that `tsc --noEmit` let through. | 2026-11-11 |

**Not run:** the 58 discovered test cases (`dotnet test --list-tests`). They need PostgreSQL; the
Docker daemon is not running on the dev machine, so `docker-compose up` is unavailable. Nothing in
this batch has been exercised against a live database.

---

## Next steps

| Slice | Content | Status |
|---|---|---|
| **B1** | Drop `DispatchPlan`; queue = `Status == Pending && TripSheetId == null`; set `Status` + `StatusHistory` on create; reset to `Pending` on cancel; wrap the multi-table write in a transaction; 2 regression tests | approved 2026-11-11, next up |
| **B2** | TripSheet response DTOs (stop leaking entities + `byte[] Version`), write endpoints with role gates and driver-ownership checks, 201/204/404/409 | planned |
| **B3** | Board wiring: real `createdByUserId`, drop dead status chips, wire drag-drop to `addJobs`, fix print defects #10/#11 | planned |
| **B4** | `ISignalRService` broadcasts for trip-sheet changes | planned |
| **B5** | Concurrency token → `xmin` + two-writer test | approved 2026-11-11 |
| **B6** | `TripSheetWorkflowIntegrationTests` (create → add → depart → return → complete; duplicate number; non-queue job; cancel returns to queue) | planned |

Decisions: **PDF** → browser print (done); **`DispatchPlan`** → delete (approved 2026-11-11);
**concurrency token** → `xmin` on `TripSheet` and `TripSheetItem`, mirroring `Job` (approved 2026-11-11).
Actual blocking work is no longer a decision — B1 is next.

---

## Working tree inventory

**New:** `DispatchTrack.API/Services/RedisConnectionStrings.cs`,
`DispatchTrack.API.Tests/RedisConnectionStringsTests.cs`, `docs/WORK_LOG.md`

**Deleted:** `DispatchTrack.API/Services/PdfService.cs`, `frontend/src/App.css`,
`frontend/src/assets/{hero.png,react.svg,vite.svg}`

**Modified (19):** `.gitignore`, `AGENTS.md`, `DispatchTrack.API/Program.cs`,
`DispatchTrack.API/DispatchTrack.API.csproj`, `DispatchTrack.API/Controllers/TripSheetsController.cs`,
`DispatchTrack.API.Tests/AuthIntegrationTests.cs`, `docs/ROUTE_PLANNING_INTEGRATION_PLAN.md`,
`frontend/{package.json,package-lock.json,README.md,vite.config.ts}`,
`frontend/src/{index.css,api/endpoints.ts,context/AuthContext.tsx,pages/DispatchBoardPage.tsx,pages/JobsPage.tsx,services/signalr.ts,types/index.ts,components/ui/StatusBadge.tsx}`
