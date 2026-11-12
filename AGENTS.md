# AGENTS.md — DispatchTrack

## Project Overview
**DispatchTrack** — Real-time delivery dispatch & logistics management. Full-stack portfolio flagship:
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS 4
- **Backend**: ASP.NET Core 10 + EF Core 10 + PostgreSQL (Neon) + Redis (Upstash)
- **Real-time**: SignalR (JobHub, DriverHub, TripSheetHub) with JWT auth
- **Auth**: JWT (15 min) + rotating refresh tokens (7 days, httpOnly cookie)
- **Deploy**: Single Docker container → Render free tier, CI/CD via GitHub Actions

---

## Key Commands

### Local Development
```bash
# 1. Start API + PostgreSQL + Redis
docker-compose up --build -d

# 2. Frontend dev server (separate terminal)
cd frontend && npm install && npm run dev
# → Frontend: http://localhost:5173 (proxies API to :5084)
# → API:      http://localhost:5084
# → Swagger:  http://localhost:5084/swagger
```

### Backend
```bash
cd DispatchTrack.API
dotnet build                    # Build
dotnet test ..\DispatchTrack.API.Tests   # 60 cases — needs a reachable PostgreSQL + Jwt__Secret
dotnet run                      # Run API (uses docker-compose DB/Redis)
```

> The tests read `ConnectionStrings__Default`. There is no test-only database: if you point it at the
> Neon connection string (the default in `.env`), `dotnet test` writes to the **production** database.
> Prefer docker-compose Postgres for test runs.

### Frontend
```bash
cd frontend
npm run dev                     # Vite dev server (hot reload)
npm run build                   # tsc -b && vite build — the typecheck gate
npm run lint                    # oxlint
# npx tsc --noEmit is a no-op (tsconfig.json has no files, only references) — don't rely on it
```

### Docker
```bash
docker build -t dispatchtrack .
docker run -p 8080:8080 dispatchtrack
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    RENDER (Free Tier)                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Single Docker Container (Multi-stage Build)         │   │
│  │  ┌──────────────┐    ┌──────────────────────────┐   │   │
│  │  │  Frontend    │    │  Backend (ASP.NET Core)   │   │   │
│  │  │  (Vite/React)│───▶│  Serves wwwroot + API     │   │   │
│  │  │  Static Files│    │  JWT Auth + Refresh Tokens│   │   │
│  │  └──────────────┘    └──────────────┬────────────┘   │   │
│  └─────────────────────────────────────┼────────────────┘   │
│                                        │                     │
│                    ┌───────────────────┴───────────┐         │
│                    ▼                               ▼         │
│             ┌────────────┐               ┌──────────────┐    │
│             │  Neon      │               │  Upstash     │    │
│             │  PostgreSQL│               │  Redis       │    │
│             │  (Serverless)             │  (TLS)       │    │
│             └────────────┘               └──────────────┘    │
│                                                              │
│  No container registry: Render clones the repo and rebuilds   │
│  the image from source on each deploy-hook trigger.           │
└─────────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions
| Decision | Rationale |
|----------|-----------|
| PostgreSQL on Neon | Bypasses Azure Student 1-project limit; serverless scale-to-zero |
| Single Docker container | One free Render service; Node builds Vite → wwwroot; SPA fallback |
| JWT + httpOnly refresh cookies | Secure token storage; rotation on use; revocation on logout |
| Non-critical Redis cache | Dashboard summary cached; falls back to DB on failure |
| Free-tier hosting | Render (API+static), Neon (DB), Upstash (Redis) — $0/month |

---

## Project Structure

```
DispatchTrack/
├── .github/workflows/          # CI (build, test, docker) + Deploy (Render hook)
├── docs/
│   ├── DESIGN.md               # Frontend design direction (tokens, components, patterns)
│   ├── WORK_LOG.md             # Uncommitted work, verified defects, next steps
│   ├── ROUTE_PLANNING_INTEGRATION_PLAN.md  # Trip sheet / route planning phases
│   └── adr/                    # Architecture Decision Records
├── DispatchTrack.API/          # ASP.NET Core Web API
│   ├── Controllers/            # Auth, Jobs, Drivers, Dashboard, Demo, Users, TripSheets
│   ├── Hubs/                   # SignalR: JobHub, DriverHub, TripSheetHub
│   ├── Models/                 # User, Driver, Job, StatusHistory, RefreshTokens, TripSheet, TripSheetItem, JobStatusRules
│   ├── Services/               # TokenService, SignalRService, TripSheetService, Redis connection handling
│   ├── Data/                   # AppDbContext, DataSeeder, DAL/TripSheetDAL
│   └── DTOs/                   # Request/Response contracts
├── DispatchTrack.API.Tests/    # xUnit tests (60 cases / 42 methods)
├── frontend/                   # React + TypeScript + Vite
│   ├── src/
│   │   ├── pages/              # Login, Dashboard, Jobs, DispatchBoard, DriverView, AdminUsers
│   │   ├── components/
│   │   │   ├── ui/             # 8 primitives + DriverMap (Leaflet)
│   │   │   ├── auth/           # ProtectedRoute
│   │   │   └── layout/         # Shell (sidebar, topbar, bottom nav)
│   │   ├── context/            # AuthContext, ThemeContext
│   │   ├── services/           # SignalR client (signalr.ts)
│   │   ├── api/                # Axios client + endpoints
│   │   ├── utils/              # cn (class-name helper)
│   │   └── types/              # Shared TypeScript interfaces
│   ├── e2e/                    # Playwright smoke spec (not in CI)
│   ├── playwright.config.ts
│   └── dist/                   # Production build output (copied to wwwroot)
├── Dockerfile                  # Multi-stage: Node build → .NET publish → Runtime
├── docker-compose.yml          # Local dev: API + PostgreSQL + Redis
├── .env.example                # All required environment variables
├── AGENTS.md                   # This file
└── LICENSE                     # MIT
```

> Committed by accident: `frontend/playwright-report/index.html` and `frontend/test-results/.last-run.json`.
> They are generated artifacts — don't add more, and remove them when touching frontend config.

---

## Environment Variables (see `.env.example`)

| Variable | Required | Description |
|----------|----------|-------------|
| `ConnectionStrings__Default` | ✅ | PostgreSQL connection string |
| `Jwt__Secret` | ✅ | ≥32 chars, `openssl rand -base64 32` |
| `Jwt__Issuer` / `Jwt__Audience` | ⚠️ | Defaults to "DispatchTrack" |
| `ConnectionStrings__Redis` | ❌ | Upstash TLS URL; empty = in-memory cache |
| `MigrateOnStartup` | ⚠️ | `"true"` applies pending EF migrations at startup (hosted only). Locally use `dotnet ef database update`. Without it the app starts and logs how many migrations are pending |
| `ASPNETCORE_ENVIRONMENT` | ⚠️ | `Development` \| `Production`. Rate limiting only runs when **not** Development; Swagger only in Development |

> The frontend always calls `/api` on its own origin (Vite proxies it in dev, ASP.NET serves both in
> prod). `VITE_API_BASE_URL` is listed in `.env.example` but no frontend code reads it.

---

## Code Conventions

### Backend (C#)
- **Controllers**: Thin — delegate to services
- **Services**: Scoped, interface-based (`ITokenService`, `ISignalRService`, `ITripSheetService`); trip-sheet data access sits in `Data/DAL/TripSheetDAL` behind `ITripSheetDAL`
- **DTOs**: Request/Response separation, `JsonStringEnumConverter` for enums
- **Optimistic concurrency**: `Job.Version` is mapped to PostgreSQL `xmin` (`uint`); `DbUpdateConcurrencyException` → 409. `TripSheet.Version` is still a `byte[]` `[Timestamp]` column and does not work against PostgreSQL yet
- **SignalR**: Hubs in `Hubs/`, broadcasting via `ISignalRService` injected into controllers. Trip-sheet broadcasts are not implemented (hub + client listener exist, server never sends)

### Frontend (React/TypeScript)
- **Components**: Hand-rolled primitives in `components/ui/` — no component library
- **State**: TanStack Query for server state, React Context for auth/theme
- **Styling**: Tailwind v4 + CSS variables (design tokens in `frontend/src/index.css`)
- **SignalR**: Singleton service in `services/signalr.ts`, initialized in `AuthContext`
- **Routing**: React Router v7, protected routes via `ProtectedRoute`

### Design System (CSS Variables)
```css
:root {
  --bg-page: #D6EAF8;          /* Ice Blue */
  --bg-surface: #FFFFFF;
  --border-hairline: #B3D4F0;
  --text-main: #0A0E17;        /* Midnight Ink */
  --text-muted: #3D5A7A;
  --color-accent: #FF4D00;     /* Vermilion */
  --color-success: #059669;
  --color-warning: #D97706;
  --color-danger: #DC2626;
  --color-info: #0284C7;
}
.dark { /* inverted palette */ }
```

**Components use these variables exclusively** — no Tailwind zinc/slate colors.

---

## Real-time (SignalR)

### Hubs
| Hub | URL | Purpose |
|-----|-----|---------|
| `JobHub` | `/hubs/jobs` | Job status changes, assignments, creation, dispatcher counts. Groups: `job-{id}`, `dispatchers` |
| `DriverHub` | `/hubs/drivers` | Driver location/status updates to `dispatchers` |
| `TripSheetHub` | `/hubs/tripsheet` | Groups: `tripsheet-{id}`, `dispatchers` — **no server broadcasts yet** (B4) |

### Client
- `frontend/src/services/signalr.ts` — singleton, split connections per hub, auto-reconnect, group management
- Initialized in `AuthContext` on login/token refresh
- Dashboard/Jobs/DispatchBoard/DriverView pages subscribe via `useEffect` + `queryClient.invalidateQueries()`
- The trip-sheet connection already listens for `TripSheetCreated`, `TripSheetStatusChanged`, `StopAdded`, `StopRemoved`, `StopsReordered` — none of which the server sends yet

### Auth
- JWT access token passed via query string for WebSocket upgrade
- Configured in `Program.cs` → `JwtBearerEvents.OnMessageReceived`

---

## Testing

```bash
# Backend (needs a reachable PostgreSQL + Jwt__Secret — see the warning above)
cd DispatchTrack.API.Tests
dotnet test

# Frontend
cd frontend
npm run lint        # oxlint
npm run build       # tsc -b && vite build — the only real typecheck
```

**Coverage**: 60 test cases / 42 methods across 11 files (xUnit + WebApplicationFactory):
- Auth: login, refresh rotation, replay revocation, logout, 401 without token
- Authorization: role gates (403), driver isolation
- Job state machine: valid/invalid transitions, concurrency conflicts
- Trip sheets: queue semantics (create assigns + writes history, cancel returns to queue)
- Dashboard: Redis cache + DB fallback
- Rate limiting: 429 after 10 requests (Production env)
- Support code: token service, Redis connection-string normalisation, status rules

E2E: `frontend/e2e/smoke.spec.ts` only; Playwright is installed but not run by CI.

---

## Deployment

### Render Setup (one-time)
1. Create **Web Service** → **Docker** runtime
2. Connect GitHub repo → **Auto-deploy: OFF** (gated by CI)
3. Plan: **Free** (512 MB, 750 hrs/mo)
4. Env vars from `.env.example` + `RENDER_DEPLOY_HOOK` secret

### CI/CD Flow
1. Push to `main` → GitHub Actions CI runs (build, test, docker)
2. On green CI → Deploy workflow triggers Render Deploy Hook
3. Render rebuilds the Docker image from source and deploys
4. Health checks hit `/health` (no DB/Redis calls)

The deploy workflow **fails** when `RENDER_DEPLOY_HOOK` is missing or empty — a green Deploy run always
means a deploy was actually triggered. If a change doesn't appear live, check that Deploy ran, not just CI.

---

## Demo Accounts (seeded automatically)
| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@dispatchtrack.local` | `Password123!` |
| Dispatcher | `dispatcher@dispatchtrack.local` | `Password123!` |
| Driver | `driver@dispatchtrack.local` | `Password123!` |

---

## Known Limitations (Future Work)

| Area | Limitation | Effort |
|------|------------|--------|
| **Trip-sheet writes** | Controller exposes only 3 GETs; the 9 write calls in `frontend/src/api/endpoints.ts` 404 | Large (next slice) |
| **Trip-sheet concurrency** | `TripSheet.Version` is an unused `byte[]`; no `xmin` mapping | Small |
| **Trip-sheet realtime** | `ISignalRService` has no trip-sheet methods; `TripSheetHub` never broadcasts | Small |
| **Trip-sheet print** | `@media print` hides the wrong elements; no dedicated manifest view | Small |
| **Trip-sheet authorization** | All trip-sheet reads are `[Authorize]` with no driver isolation — any driver can read any sheet by id | Small |
| **API 404s** | `MapFallbackToFile` swallows unknown `/api/*` routes → 200 HTML instead of 404 JSON | Small |
| **Users list** | No `GET /api/users`; admin management is by id only | Small |
| **Trips/Routes** | No route optimization (OR-Tools/OSRM); reordering is a UI no-op | High |
| **Geocoding** | Seed coords only (no live Nominatim) | Low-Medium |
| **Frontend tests** | No Vitest/RTL; one Playwright smoke spec, not in CI | Medium |
| **Testcontainers** | Tests use whatever `ConnectionStrings__Default` points at — by default the same Neon DB as production | Medium |
| **Cold starts** | ~30-50s on Render free tier | N/A (paid plan) |

---

## Project Conventions

### Response etiquette
- Always without exception start every response with the user's name, Angelo

### Commit rules
- Never commit/push changes or create PRs without Angelo's explicit permission.

---

## Quick Reference for Agents

- **Never commit built artifacts** (`wwwroot/assets/*`, `frontend/dist/*`, `frontend/playwright-report/*`, `frontend/test-results/*`) — Docker builds from source
- **Dev and prod share one Neon database.** Local migrations, tests and demo resets change production data. Check `ConnectionStrings__Default` before running anything that writes
- **Use CSS variables** — never hardcode colors; tokens in `frontend/src/index.css`
- **SignalR groups**: `job-{id}`, `driver-{id}`, `tripsheet-{id}`, `dispatchers` — join/leave in component `useEffect`
- **Optimistic concurrency**: `Job` uses `xmin`; mutating job endpoints catch `DbUpdateConcurrencyException` → 409. Trip-sheet rows don't yet
- **Trip-sheet reads** are `[Authorize]` only (no role/driver checks) until B2 adds write endpoints and ownership checks
- **Refresh tokens**: httpOnly cookie, rotated on use, revoked on logout
- **Rate limiting**: Only when `ASPNETCORE_ENVIRONMENT != Development`
- **Swagger**: Development only. In production `/swagger` returns the SPA HTML
- **Health endpoint**: `/health` — no external calls, safe for Render health checks
- **Current status, defects, next slices**: read `docs/WORK_LOG.md` before starting work