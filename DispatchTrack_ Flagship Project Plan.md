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
- CI needs `npx playwright install --with-deps`, and E2E waits for SQL Server readiness before migrations run.

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
| 6. React: auth, protected routes, dashboard, driver view, loading/empty/error states (TanStack Query, React Hook Form + Zod, mobile-friendly driver view) | 16 |
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

1. **Switch EF Core to PostgreSQL (Npgsql):**
   - Replace `Microsoft.EntityFrameworkCore.SqlServer` with `Npgsql.EntityFrameworkCore.PostgreSQL` in `DispatchTrack.API.csproj`.
   - Update `Program.cs` to `opt.UseNpgsql(...)`.
   - Configure PostgreSQL optimistic concurrency on `Job` via `builder.Entity<Job>().UseXminAsConcurrencyToken()`.
   - Remove old SQL Server migration files and generate new PostgreSQL initial migration.
2. **Neon Database Setup:**
   - Create free project on Neon and add connection string to `appsettings.Development.json` / `.env.example`.
3. **Phase 1 Auth Implementation:**
   - Implement JWT access tokens (15-min expiry) with `Authorization: Bearer`.
   - Implement rotating refresh tokens (7-day, hashed in DB, `httpOnly` secure cookies).
   - Wire up ASP.NET Identity `PasswordHasher<User>`.
   - Configure Swagger UI to accept JWT Bearer authentication.