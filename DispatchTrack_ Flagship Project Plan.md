# DispatchTrack: Flagship Full-Stack Project Plan

**Goal:** one project that shows "I can build, test, containerise, deploy & monitor a full-stack app", closing the gaps left by SmartGear, TechStock IMS & BugTrack (all ASP.NET MVC/Razor). **Budget:** 3-5 hrs/week. **Hosting:** free tiers only (SmartGear already uses Azure).

## 1. Decisions

| Status | Decision |
| --- | --- |
| Decided | Domain: dispatch/logistics tracker |
| Decided | Stack: React + TS + Vite + Tailwind / ASP.NET Core Web API / JWT / EF Core / Redis / Swagger / Docker / GitHub Actions / xUnit + Playwright |
| Decided | Free-tier hosting; 3-5 hrs/week |
| Recommended | Single-tenant, 3 roles (Admin, Dispatcher, Driver). Multi-tenant dropped |
| Recommended | Cut Trips/TripJobs from MVP (see section 4) |
| Recommended | Frontend served from the API container (one origin, one free service) |
| Decided | Database: PostgreSQL on Neon free tier (bypasses Azure student 1-project cap, no IP firewall issues, lightweight Docker) |
| Decided | Leaflet map view: Stretch goal (Phase 6); backend Job model retains Latitude & Longitude |

## 2. Scope

- **MVP (must ship):** auth + refresh tokens, job CRUD, assignment, status transitions + history, dashboard summary (Redis), driver view, seed/demo data, tests, Docker, CI, live deploy, README.
- **Stretch (only if ahead):** Leaflet map, SignalR live updates, Trips/route grouping.
- **Cut:** multi-tenancy, API versioning, Kubernetes/Terraform, frontend unit tests, live geocoding (seed coordinates instead).

## 3. Architecture & free hosting

| Piece | Choice | Catch |
| --- | --- | --- |
| API + React | One Docker container on **Render free** (multi-stage: Node builds Vite, output copied to `wwwroot`, SPA fallback) | \~30-50s cold start after 15 min idle; 512 MB RAM; 750 hrs/month |
| Redis | **Upstash free** (256 MB, \~500K commands/month, TLS via `ssl=true`) | Never ping Redis from health checks; cache must be non-critical (fall back to DB) |
| Database | **Neon free tier (Serverless PostgreSQL)** | Auto-suspends compute to 0 in 5 min, wakes in \~500ms; standard TLS connection string (no IP whitelist needed); 0.5 GB storage |
| Secrets | Render env vars + GitHub Actions secrets | No Key Vault; say so honestly in the README |
| Images | GitHub Container Registry (optional) |  |
| Monitoring | `/health` (no dependency calls), Serilog structured logs, Render logs, free uptime pinger | Pinger must hit `/health` only, or it keeps DB awake & burns quota |
| Local | docker-compose: API + PostgreSQL (`postgres:16-alpine`) + Redis | Postgres container uses \< 50 MB RAM (vs 2 GB for SQL Server) |

Azure Cache for Redis Basic/Standard/Premium is being retired (creation blocked for new customers from Apr 2026, existing from Oct 2026), so it is not an option. Verify all free-tier limits again before deploying; they change often.

## 4. Data model & API

**Tables:** Users (Id, Email, PasswordHash, Role, FullName, CreatedAt), Drivers (Id, UserId, VehicleReg, CurrentStatus), Jobs (addresses + lat/lng, Status, Priority, Notes, CreatedByUserId, AssignedDriverId, RowVersion, CreatedAt, UpdatedAt), StatusHistory (JobId, OldStatus, NewStatus, ChangedByUserId, ChangedAt), RefreshTokens (UserId, TokenHash, ExpiresAt, Revoked). All timestamps UTC.

**Gap found:** the earlier schema had Trips/TripJobs but no endpoints for them. Recommendation: drop both for MVP; a driver simply sees their assigned jobs. Re-add later as a stretch.

| Method | Route | Role |
| --- | --- | --- |
| POST | /api/auth/login, /refresh, /logout | public / cookie |
| POST | /api/users | Admin (creates Dispatcher/Driver accounts; public register disabled) |
| GET | /api/jobs?status=&page=&pageSize= | Admin, Dispatcher |
| GET | /api/jobs/{id} | Admin, Dispatcher, Driver (own) |
| POST | /api/jobs | Admin, Dispatcher |
| PATCH | /api/jobs/{id}/assign | Admin, Dispatcher (driver must not be Offline) |
| PATCH | /api/jobs/{id}/status | Driver (own), Admin |
| GET | /api/dashboard/summary | Admin, Dispatcher (Redis cached) |
| GET | /api/drivers | Admin, Dispatcher |
| GET | /api/drivers/me/jobs | Driver |
| POST | /api/demo/reset | Admin (restores seed data) |
| GET | /health | public, no dependency calls |

## 5. Auth design

- Access token: JWT, 15 min, claims sub/role/email, `Authorization: Bearer`.
- Refresh token: random opaque value, 7 days, **stored hashed**, rotated on use, sent as httpOnly + Secure + SameSite cookie. Revoked on logout.
- Passwords: ASP.NET Identity `PasswordHasher` (or BCrypt). Strong JWT secret from env, never committed.
- Frontend: axios interceptor retries once after `/refresh` on 401; `ProtectedRoute` checks role.
- Production rate limiting on login/refresh; CORS only if dev servers differ (Vite proxy in dev).

## 6. Status transitions (server-enforced, 409 on violation)

Pending -> Assigned; Assigned -> InTransit or Pending (unassign); InTransit -> Delivered or Failed; Delivered/Failed are terminal. Each accepted change writes StatusHistory in the same transaction. `RowVersion` gives optimistic concurrency so two dispatchers cannot overwrite each other.

## 7. Testing

- **xUnit + WebApplicationFactory:** 401 without token; Dispatcher creates job (201), Driver cannot (403); Pending -> InTransit rejected (409); Assigned -> InTransit accepted with history row; refresh-token rotation; concurrency conflict.
- **Playwright (one happy path):** admin logs in, creates job, assigns driver, logs out; driver marks InTransit then Delivered; admin dashboard shows the delivered count.
- CI needs `npx playwright install --with-deps`, and E2E waits for Postgres readiness (docker compose `postgres:16-alpine`, or a Neon branch) before migrations run.

## 8. CI/CD (GitHub Actions)

1. **build-test:** build API, xUnit, build frontend, `tsc --noEmit`, ESLint.
2. **e2e:** `docker compose up -d`, wait for health, Playwright, tear down.
3. **deploy (main only, needs 1 + 2 green):** call the Render deploy hook (turn Render auto-deploy off so tests truly gate deploys).

Also: PRs + branch protection requiring green CI, Dependabot, CodeQL. Migrations apply at startup behind an env flag.

## 9. Timeline (\~81 hrs core + 4 hrs optional map)

| Phase | Hrs |
| --- | --- |
| 0. Repo setup, .gitignore, .env.example, branch protection, CI skeleton, ADR 0 | 3 |
| 1. API skeleton, models, migrations, JWT + refresh, password hashing, Swagger, ProblemDetails, validation | 10 |
| 2. Users/jobs/drivers endpoints, transitions, history, concurrency, pagination | 9 |
| 3. Redis cache (with fallback) + Serilog + /health | 6 |
| 4. xUnit integration tests | 6 |
| 5. Seed data, demo reset, rate limiting | 3 |
| 6. React: auth, protected routes, dashboard, driver view, loading/empty/error states (TanStack Query, React Hook Form + Zod, mobile-friendly driver view) — visual direction per [docs/DESIGN.md](docs/DESIGN.md) | 16 |
| 7. Dockerfiles, single-container build, compose | 5 |
| 8. CI pipeline | 6 |
| 9. Playwright E2E | 5 |
| 10. Deploy: Render + Upstash + DB + deploy hook + pinger | 5 |
| 11. README, architecture diagram, screenshots, ADRs, demo GIF | 5 |
| 12. CV, portfolio & LinkedIn updates | 2 |
| Stretch: Leaflet map | 4 |

About 20 weeks at 4 hrs/week (16 at 5, 27 at 3). Add 1-2 buffer weeks around AIE assessments or PMD crunch. If behind, cut in this order: map, Azure/free-DB polish, then frontend extras. Never cut: auth, transition rules, tests, Docker.

## 10. Don't-forget checklist

**Legal & safety**

- [ ] **Build from scratch.** Do not copy code, data, screenshots, naming or terminology from the PMD route-planning system or PMDEdge; it is employer work. Reuse knowledge only.
- [ ] Demo data is fake only (POPIA: no real names, addresses or phone numbers).
- [ ] No secrets in git; `.env` ignored; `.env.example` committed; add a LICENSE.
- [ ] Public register disabled; demo accounts (Admin/Dispatcher/Driver) listed in README; demo reset endpoint exists.

**Engineering**

- [ ] `/health` has no dependency calls; Redis failure never breaks an endpoint.
- [ ] DTOs separate from EF entities; consistent ProblemDetails errors; UTC timestamps.
- [ ] Seed coordinates (no live geocoding); Nominatim only if you add geocoding, with caching & a User-Agent.
- [ ] Basic accessibility: labels, keyboard navigation, contrast; quick Lighthouse pass.

**Docs & career**

- [ ] README: live link + cold-start note, architecture diagram, screenshots/GIF, run-locally in one command, API docs (Swagger), test instructions, known limitations & "what I'd do next".
- [ ] 3-4 short ADRs (JWT + httpOnly refresh, non-critical Redis, single-container serving, free-tier hosting).
- [ ] Only add React, TypeScript, Docker, GitHub Actions, Playwright, Redis, JWT to the CV skills once they are actually built & live.
- [ ] Pin the repo on GitHub; add a portfolio card; post on LinkedIn.
- [ ] Interview prep: be able to explain every design choice & trade-off, including code written with AI tools.

## 11. Next actions

- [x] Confirm open decisions: Database (Neon PostgreSQL) & Trips cut confirmed.
- [x] Record ADR: `docs/adr/ADR-001-database-selection.md` created.
- [x] Phase 0 in flight: Solution restructure, API skeleton, Tests project, Frontend Vite + Tailwind v4 configured.

---

### 📋 Next Session Agenda (Phase 1 Kick-off)

1. **Switch EF Core to PostgreSQL (Npgsql):** [x] Completed
   - [x] Replace `Microsoft.EntityFrameworkCore.SqlServer` with `Npgsql.EntityFrameworkCore.PostgreSQL 10.0.0` in `DispatchTrack.API.csproj`.
   - [x] Update `Program.cs` to `opt.UseNpgsql(...)`.
   - [x] Configure PostgreSQL optimistic concurrency on `Job` via `xmin` system column.
   - [x] Remove old SQL Server migration files and generate new PostgreSQL initial migration.
2. **Neon Database Setup:** [x] Completed
   - [x] Create project on Neon, configure `.env.example`, and apply initial migration with `dotnet ef database update`.
3. **Phase 1 Auth Implementation:** [x] Completed
   - [x] Implement JWT access tokens (15-min expiry) with `Authorization: Bearer`.
   - [x] Implement rotating refresh tokens (7-day, hashed with SHA-256 in DB, `httpOnly`, `SameSite=Strict` cookies).
   - [x] Wire up ASP.NET Identity `PasswordHasher<User>`.
   - [x] Configure Swagger UI to accept JWT Bearer authentication.
   - [x] Implement `DataSeeder` for demo accounts (Admin, Dispatcher, Driver) and sample jobs.
   - [x] Add 7 automated unit and integration tests (100% passing).

---

### 📋 Next Session Agenda (Phase 2: Core Domain Endpoints) — Completed

1. **User Management (`/api/users`)**: [x] Completed
   - [x] `POST /api/users` (Admin only) to provision Dispatcher and Driver accounts.
   - [x] `GET /api/users/{id}` (Admin) so creation returns a Location header.
2. **Job Lifecycle & State Machine (`/api/jobs`)**: [x] Completed
   - [x] `GET /api/jobs` (Admin/Dispatcher) with status filtering and pagination.
   - [x] `GET /api/jobs/{id}` (Admin/Dispatcher/assigned Driver).
   - [x] `POST /api/jobs` (Admin/Dispatcher) creates new delivery jobs.
   - [x] `PATCH /api/jobs/{id}/assign` assigns driver (validates driver is not Offline).
   - [x] `PATCH /api/jobs/{id}/status` server-enforced state machine (`Pending -> Assigned -> InTransit -> Delivered/Failed`) with 409 Conflict guards, optimistic concurrency (`xmin`), and automatic `StatusHistory` recording.
   - Note: assignment itself performs `Pending -> Assigned`; the status endpoint rejects a direct `-> Assigned` with 409.
3. **Driver Endpoints (`/api/drivers`)**: [x] Completed
   - [x] `GET /api/drivers` (Admin/Dispatcher) lists all drivers and active statuses.
   - [x] `GET /api/drivers/me/jobs` (Driver) returns active assigned jobs.

Delivered with 43 passing tests (12 state-machine unit tests + integration coverage per §7). Unassign = `PATCH .../status {"status":"Pending"}`, which also frees the driver. Delivered/Failed free the assigned driver.

---

### 📋 Session Log (Phase 3: Redis cache + Serilog + dashboard) — Completed

- [x] `GET /api/dashboard/summary` (Admin/Dispatcher): total/per-status job counts, driver counts, jobs created today; stable 0-filled status keys.
- [x] Dashboard cache via `IDistributedCache`: Redis when `ConnectionStrings__Redis` is set (Upstash-ready, TLS in URL), in-memory otherwise (local dev).
- [x] Cache is non-critical per §3: reads/writes wrapped, any Redis failure logs a warning and falls back to the DB — `/health` still has no dependency calls.
- [x] Serilog structured logging (`UseSerilog`, console sink for Render logs, config in `appsettings.json`).
- [x] `.env.example` gained `ConnectionStrings__Redis` (empty = cache off).
- [x] 47 tests passing (4 dashboard integration tests added).

Next up per timeline: **Phase 5** (demo reset endpoint, rate limiting, migrations-at-startup env flag) or jump to **Phase 6** (React frontend).

---

### 📋 Session Log (Phase 5: demo reset, rate limiting, migrate-on-startup) — Completed

- [x] `POST /api/demo/reset` (Admin): transactional wipe of all tables (FK-safe order via `ExecuteDeleteAsync`) + reseed — doubles as the cleanup path for tests/demo sessions.
- [x] Rate limiting on `login`/`refresh` per §5: `"auth"` fixed-window policy (10/min per IP, 429), enforced **outside Development only** so dev/test are unaffected.
- [x] `MigrateOnStartup` env flag (§8): migrations applied at startup only when enabled (Render sets `true`); documented in `.env.example`.
- [x] Test parallelization disabled assembly-wide — demo reset deletes all rows in the shared Neon DB, so classes must not race it (revisit with Testcontainers at Phase 8).
- [x] 50 tests passing, including a rate-limit test that boots a Production-environment host and asserts 429 after the 10th login attempt.

Next up per timeline: **Phase 6** (React frontend, 16 hrs — the big one).

---

### 📋 Session Log (Phase 6: React Frontend Implementation) — Completed

- [x] **Tooling & Setup:** Installed TanStack Query, React Router DOM, Axios, Lucide React, Fontsource Inter, Zod. Configured Vite dev proxy to API (`http://localhost:5084`).
- [x] **Design Tokens & Primitives:** CSS variable design tokens for light/dark themes per [docs/DESIGN.md](docs/DESIGN.md). Built hand-rolled UI primitives (`Button`, `Input`, `Card`, `StatusBadge`, `Drawer`, `Modal`, `Skeleton`, `EmptyState`) with signature tinted status badges (6px dot).
- [x] **Auth & Session:** In-memory access token storage with Axios 401 response interceptor (rotates via `POST /api/auth/refresh` with `httpOnly` cookies). Created `AuthProvider`, `ThemeProvider` (persisted in `localStorage`), and role-based `ProtectedRoute`.
- [x] **Views Implemented:**
  - `LoginPage`: Clean card UI with one-click demo account autofill buttons (Admin, Dispatcher, Driver).
  - `DashboardPage`: 4 stat tiles from `/api/dashboard/summary`, active jobs feed, unassigned queue, and fleet status panel.
  - `JobsPage`: Filterable and paginated jobs table, new job creation modal with coordinates, and a slide-over detail drawer with driver assignment modal.
  - `DriverViewPage`: Mobile-first card interface with thumb-reachable status transitions (`Assigned` -> `InTransit` -> `Delivered`/`Failed`).
  - `AdminUsersPage`: Internal staff account provisioning (`POST /api/users`) and one-click demo database reset trigger (`POST /api/demo/reset`).
- [x] **Verification:**
  - `oxlint`: 0 errors, 0 warnings.
  - `npm run build`: Bundled cleanly (`dist/`) in < 1s with `verbatimModuleSyntax` compliance.
  - `dotnet test`: 50/50 backend integration tests passing.

Next up per timeline: **Phase 7** (Docker single-container build & Compose configuration).

---

### 📋 Session Log (Phase 7: Docker + Phase 8: CI + Phase 11: Documentation) — Completed

- [x] **Multi-stage Dockerfile**: Node 22 frontend build → .NET 10 backend publish → ASP.NET Core runtime serving `wwwroot` + API
- [x] **docker-compose.yml**: Local dev stack (API + PostgreSQL 16 + Redis 7) with health checks
- [x] **CI Pipeline** (`.github/workflows/ci.yml`): Backend build/test, frontend typecheck/lint/build, Docker image build
- [x] **Deploy Pipeline** (`.github/workflows/deploy.yml`): Triggers on main + green CI, calls Render deploy hook
- [x] **Environment Configuration**: `.env.example` with all required vars (DB, JWT, Redis, MigrateOnStartup)
- [x] **Root README.md**: Live demo link, architecture diagram, quick start, API reference, design system, known limitations
- [x] **Frontend README.md**: Project structure, design tokens, components, auth flow, accessibility, quality gates
- [x] **ADR 002**: JWT + httpOnly rotating refresh tokens
- [x] **ADR 003**: Non-critical Redis cache with DB fallback
- [x] **ADR 004**: Single-container serving (Node → wwwroot)
- [x] **ADR 005**: Free-tier hosting constraints & trade-offs
- [x] **LICENSE**: MIT

**Verification:**
- `docker build` succeeds (multi-stage)
- `docker-compose up` starts API + DB + Redis
- CI workflow passes (backend tests, frontend lint/typecheck/build, Docker build)
- All 5 ADRs present in `docs/adr/`
- Root README renders correctly with architecture diagram

Next up per timeline: **Phase 9** (Playwright E2E), **Phase 10** (Deploy to Render + Upstash + Neon), **Phase 12** (CV/portfolio/LinkedIn updates).

---

### 📋 Session Log (Phase 6.1: UI/UX Accessibility & Usability Audit) — Completed

- [x] **Structured audit** against `ui-ux-best-practices` skill (Nielsen Norman heuristics + WCAG 2.1/2.2) across all 5 pages + 8 primitives + Shell.
- [x] **Critical accessibility fixes:**
  - Focus trap + `aria-modal="true"` + `role="dialog"` in `Modal` and `Drawer` (Tab/Shift+Tab cycling, focus restoration, Escape handling).
  - Standardized `focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]` across `Button`, `Input`, `Card`, `Modal`, `Drawer`, filter chips, pagination, clickable rows.
  - Keyboard-accessible table rows (`tabIndex={0}`, `role="button"`, `onKeyDown` for Enter/Space, `aria-label`) on JobsPage, DashboardPage, AdminUsersPage.
  - Sticky table headers (`sticky top-0 z-10`) on all data tables.
  - Touch targets ≥ 48×48dp on DriverViewPage (`Button` `lg` = `h-12`, base `min-h-[44px]`).
  - Search input proper `<label htmlFor>`, pagination `aria-label`, demo buttons `aria-label`, error banner `role="alert"`.
  - Shell: all icon-only buttons `aria-label`, mobile menu `aria-expanded`/`aria-controls`, bottom nav active indicator not color-only.
- [x] **Component state matrix upgrades:**
  - `Button`: added `:active:scale-[0.98]` tactile feedback, `success` variant (emerald), consistent focus rings.
  - `Input`: added hover state.
  - `Card`: new `interactive` prop for clickable cards with focus ring.
- [x] **UX improvements:**
  - JobsPage: "Clear filters" button, filter chips focus rings, skeleton loaders match table structure.
  - DashboardPage: "Last updated" timestamp (TanStack Query `dataUpdatedAt`), stat tiles keyboard accessible.
  - AdminUsersPage: hardcoded colors → CSS variables, `window.confirm()` → styled `Modal`.
  - Skeleton: variant system (`table-row`, `card`, `stat-tile`, `card`) matching content layout.
- [x] **Verification:** `oxlint` 0 errors/0 warnings, `npm run build` clean (2.06s), `dotnet test` 50/50 passing.

Next up per timeline: **Phase 7** (Docker single-container build & Compose configuration).

---

### 📋 Session Log (Phase 7: Docker + Phase 8: CI + Phase 11: Documentation) — Completed

- [x] **Multi-stage Dockerfile**: Node 22 frontend build → .NET 10 backend publish → ASP.NET Core runtime serving `wwwroot` + API
- [x] **docker-compose.yml**: Local dev stack (API + PostgreSQL 16 + Redis 7) with health checks
- [x] **CI Pipeline** (`.github/workflows/ci.yml`): Backend build/test, frontend typecheck/lint/build, Docker image build
- [x] **Deploy Pipeline** (`.github/workflows/deploy.yml`): Triggers on main + green CI, calls Render deploy hook
- [x] **Environment Configuration**: `.env.example` with all required vars (DB, JWT, Redis, MigrateOnStartup)
- [x] **Root README.md**: Live demo link, architecture diagram, quick start, API reference, design system, known limitations
- [x] **Frontend README.md**: Project structure, design tokens, components, auth flow, accessibility, quality gates
- [x] **ADR 002**: JWT + httpOnly rotating refresh tokens
- [x] **ADR 003**: Non-critical Redis cache with DB fallback
- [x] **ADR 004**: Single-container serving (Node → wwwroot)
- [x] **ADR 005**: Free-tier hosting constraints & trade-offs
- [x] **LICENSE**: MIT

**Verification:**
- `docker build` succeeds (multi-stage)
- `docker-compose up` starts API + DB + Redis
- CI workflow passes (backend tests, frontend lint/typecheck/build, Docker build)
- All 5 ADRs present in `docs/adr/`
- Root README renders correctly with architecture diagram

Next up per timeline: **Phase 9** (Playwright E2E), **Phase 10** (Deploy to Render + Upstash + Neon), **Phase 12** (CV/portfolio/LinkedIn updates).