# DispatchTrack

**Real-time delivery dispatch & logistics management** — a full-stack portfolio flagship demonstrating end-to-end software delivery: React + TypeScript frontend, ASP.NET Core Web API, PostgreSQL, Redis, Docker, CI/CD, and free-tier cloud deployment.

> **Live Demo:** [dispatchtrack.onrender.com](https://dispatchtrack.onrender.com) *(free tier: ~30-50s cold start after 15 min idle)*
>
> **API Docs:** Swagger is enabled in Development only. Run the API locally and open
> `http://localhost:5084/swagger`; the production build deliberately doesn't expose it.

---

## 🎯 Project Goal

Build **one project that proves** I can design, build, test, containerize, deploy, and monitor a production-grade full-stack application — closing gaps from previous MVC/Razor projects (SmartGear, TechStock IMS, BugTrack).

**Constraints:** 3-5 hrs/week • Free tiers only (Render, Neon, Upstash) • Single-container architecture

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        RENDER (Free Tier)                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Single Docker Container (Multi-stage Build)             │   │
│  │  ┌──────────────┐    ┌──────────────────────────────┐   │   │
│  │  │  Frontend    │    │  Backend (ASP.NET Core)       │   │   │
│  │  │  (Vite/React)│───▶│  Serves wwwroot + API         │   │   │
│  │  │  Static Files│    │  JWT Auth + Refresh Tokens    │   │   │
│  │  └──────────────┘    └──────────────┬────────────────┘   │   │
│  └─────────────────────────────────────┼──────────────────────┘   │
│                                        │                          │
│                    ┌───────────────────┴───────────┐             │
│                    ▼                               ▼             │
│             ┌────────────┐               ┌──────────────┐        │
│             │  Neon      │               │  Upstash     │        │
│             │  PostgreSQL│               │  Redis       │        │
│             │  (Serverless)             │  (TLS)       │        │
│             └────────────┘               └──────────────┘        │
│                                                                  │
│  Render pulls the repo and rebuilds the image on each deploy      │
│  triggered by the GitHub Actions deploy hook (no registry).       │
└─────────────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| **PostgreSQL on Neon** | Bypasses Azure Student 1-project limit; no IP firewall; serverless scale-to-zero |
| **Single Docker container** | One free Render service; Node builds Vite → `wwwroot`; SPA fallback |
| **JWT + httpOnly refresh cookies** | Secure token storage; rotation on use; revocation on logout |
| **Non-critical Redis cache** | Dashboard summary cached; falls back to DB on failure; `/health` never calls Redis |
| **Free-tier hosting** | Render (API+static), Neon (DB), Upstash (Redis) — $0/month |

---

## ✨ Features

### Core Domain (MVP)
- **Authentication**: JWT (15 min) + rotating refresh tokens (7 days, hashed, httpOnly cookie)
- **Role-based access**: Admin, Dispatcher, Driver — enforced on API & UI
- **Job lifecycle**: `Pending → Assigned → InTransit → Delivered/Failed` (server-enforced, 409 on violation)
- **Dispatch queue**: unassigned work is `Status = Pending` with no trip sheet — one definition, used by the board and by trip-sheet creation
- **Trip sheets**: `TripSheet` + ordered stops, create/cancel/delete return jobs to the queue with `StatusHistory` rows. Domain rules and reads are live; the dispatcher write endpoints are still being added (see Known Limitations)
- **Optimistic concurrency**: PostgreSQL `xmin` on `Job` prevents lost updates
- **Status history**: Every transition recorded with user + timestamp
- **Driver assignment**: Dispatchers assign jobs; drivers cannot be Offline
- **Dashboard**: Counts by job status, driver status, and jobs created today — Redis cached (60s), SignalR-driven refresh
- **Real-time updates**: SignalR (WebSocket) — job status, assignments, creation, dashboard counts, driver location and status
- **Driver map**: Leaflet map of the day's stops plus the driver's live position
- **Demo reset**: `POST /api/demo/reset` wipes & reseeds database (Admin only)
- **Rate limiting**: 10 req/min on login/refresh (production only)

### Frontend (React + TypeScript + Vite + Tailwind v4)
- **6 Pages**: Login, Dashboard, Jobs Management, Dispatch Board, Driver Portal, Admin Users
- **8 hand-rolled UI primitives**: Button, Input, Card, StatusBadge, Modal, Drawer, Skeleton, EmptyState — plus a Leaflet wrapper (`DriverMap`)
- **Design system**: CSS variable tokens (light/dark), Inter font, hairline borders, single accent color
- **Accessibility**: WCAG AA — focus traps, ARIA, keyboard nav, focus-visible rings, 48dp touch targets
- **Mobile-first Driver view**: Thumb-reachable action buttons, bottom tab navigation
- **TanStack Query**: Server state, cache invalidation from SignalR events
- **Axios interceptor**: Silent token refresh on 401
- **SignalR client**: Auto-reconnect, group-based subscriptions, JWT auth, three hubs (`/hubs/jobs`, `/hubs/drivers`, `/hubs/tripsheet`)

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Docker Desktop
- .NET 10 SDK (for running tests outside container)
- Node 22+ (for frontend dev server)

### One-Command Startup
```bash
# 1. Clone & configure
git clone https://github.com/Ang3loSP/DispatchTrack.git
cd DispatchTrack
cp .env.example .env  # Edit if needed

# 2. Start API + PostgreSQL + Redis
docker-compose up --build -d

# 3. Run frontend dev server (separate terminal)
cd frontend && npm install && npm run dev
# → Frontend: http://localhost:5173
# → API:      http://localhost:5084
# → Swagger:  http://localhost:5084/swagger
```

### Demo Accounts (seeded automatically)
| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@dispatchtrack.local` | `Password123!` |
| Dispatcher | `dispatcher@dispatchtrack.local` | `Password123!` |
| Driver | `driver@dispatchtrack.local` | `Password123!` |

---

## 🧪 Testing

```bash
# Backend tests — needs a reachable PostgreSQL (docker-compose) and Jwt__Secret
cd DispatchTrack.API.Tests
dotnet test

# Frontend typecheck + lint
cd frontend
npm run lint        # oxlint
npm run build       # tsc -b && vite build — the real typecheck gate
```

> `npx tsc --noEmit` is a no-op in this repo: `frontend/tsconfig.json` only references the app
> and node projects, it has no `files`. Use `npm run build`.

**Test Coverage:** 60 test cases (xUnit + WebApplicationFactory, 42 methods) covering:
- Auth: login, refresh rotation, replay revocation, logout, 401 without token
- Authorization: role gates (403), driver isolation
- Job state machine: valid/invalid transitions, concurrency conflicts
- Trip sheets: queue semantics (create assigns + writes history, cancel returns to queue)
- Dashboard: Redis cache + DB fallback
- Rate limiting: 429 after 10 requests (Production env)
- Support code: JWT/refresh token service, Redis connection-string normalisation, status rules

**E2E:** `frontend/e2e/smoke.spec.ts` (Playwright, one smoke test) exists but is not wired into CI —
run it manually with `npx playwright test` while the dev server and API are up.

---

## 📁 Project Structure

```
DispatchTrack/
├── .github/workflows/          # CI (build, test, docker) + Deploy (Render hook)
├── docs/
│   ├── DESIGN.md               # Frontend design direction (tokens, components, patterns)
│   ├── WORK_LOG.md             # Uncommitted work, verified defects, next steps
│   ├── ROUTE_PLANNING_INTEGRATION_PLAN.md  # Trip sheet / route planning phases
│   └── adr/                    # Architecture Decision Records
│       ├── ADR-001-database-selection.md
│       ├── ADR-002-jwt-refresh-tokens.md
│       ├── ADR-003-non-critical-redis.md
│       ├── ADR-004-single-container-serving.md
│       └── ADR-005-free-tier-hosting.md
├── DispatchTrack.API/          # ASP.NET Core Web API
│   ├── Controllers/            # Auth, Jobs, Drivers, Dashboard, Demo, Users, TripSheets
│   ├── Hubs/                   # SignalR: JobHub, DriverHub, TripSheetHub
│   ├── Models/                 # Domain entities (User, Driver, Job, StatusHistory, RefreshToken, TripSheet, TripSheetItem)
│   ├── Services/               # TokenService, SignalRService, TripSheetService, Redis connection handling
│   ├── Data/                   # AppDbContext, DataSeeder, DAL (TripSheetDAL)
│   └── DTOs/                   # Request/Response contracts
├── DispatchTrack.API.Tests/    # xUnit tests (60 cases)
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
│   │   └── types/              # Shared TypeScript interfaces
│   ├── e2e/                    # Playwright smoke spec (not in CI)
│   └── dist/                   # Production build output (copied to wwwroot)
├── Dockerfile                  # Multi-stage: Node build → .NET publish → Runtime
├── docker-compose.yml          # Local dev: API + PostgreSQL + Redis
├── .env.example                # All required environment variables
└── LICENSE                     # MIT
```

---

## 🔧 Configuration

### Environment Variables (see `.env.example`)

| Variable | Required | Description |
|----------|----------|-------------|
| `ConnectionStrings__Default` | ✅ | PostgreSQL connection string |
| `Jwt__Secret` | ✅ | ≥32 chars, `openssl rand -base64 32` |
| `Jwt__Issuer` / `Jwt__Audience` | ⚠️ | Defaults to "DispatchTrack" |
| `ConnectionStrings__Redis` | ❌ | Upstash TLS URL; empty = in-memory cache |
| `MigrateOnStartup` | ⚠️ | `"true"` = apply pending EF migrations at startup. Set it on the hosted service; locally prefer `dotnet ef database update`. Without it the app starts and logs how many migrations are pending |
| `ASPNETCORE_ENVIRONMENT` | ⚠️ | `Development` \| `Production` (rate limiting and Swagger are Development/Production dependent) |

---

## 📦 Deployment (Render Free Tier)

1. **Push to GitHub** → CI runs (build, test, docker)
2. **On main + green CI** → Deploy workflow triggers Render Deploy Hook
3. **Render** rebuilds the Docker image from source and runs the container
4. **Neon PostgreSQL** + **Upstash Redis** connected via env vars
5. **Health checks** hit `/health` (no DB/Redis calls)

### Render Service Settings
- **Type:** Web Service
- **Runtime:** Docker
- **Plan:** Free (512 MB RAM, 750 hrs/mo)
- **Auto-deploy:** OFF (gated by CI)
- **Env vars:** Set from `.env.example` (JWT secret, Neon conn string, Upstash URL, `MigrateOnStartup=true`)

---

## 📚 API Reference

### Authentication
| Method | Endpoint | Access |
|--------|----------|--------|
| POST | `/api/auth/login` | Public |
| POST | `/api/auth/refresh` | httpOnly cookie |
| POST | `/api/auth/logout` | httpOnly cookie |
| GET | `/api/auth/me` | Bearer token |

### Jobs
| Method | Endpoint | Roles |
|--------|----------|-------|
| GET | `/api/jobs?status=&page=&pageSize=` | Admin, Dispatcher |
| GET | `/api/jobs/{id}` | Admin, Dispatcher, assigned Driver |
| POST | `/api/jobs` | Admin, Dispatcher |
| PATCH | `/api/jobs/{id}/assign` | Admin, Dispatcher |
| PATCH | `/api/jobs/{id}/status` | Admin, Dispatcher, Driver (own) |

### Dashboard & Drivers
| Method | Endpoint | Roles |
|--------|----------|-------|
| GET | `/api/dashboard/summary` | Admin, Dispatcher |
| GET | `/api/drivers` | Admin, Dispatcher |
| GET | `/api/drivers/me/jobs` | Driver |

### Trip Sheets
| Method | Endpoint | Roles |
|--------|----------|-------|
| GET | `/api/tripsheets/open` | Any authenticated |
| GET | `/api/tripsheets/{id:long}` | Any authenticated |
| GET | `/api/tripsheets/driver/{driverId:int}` | Any authenticated (no driver isolation yet) |

> Read endpoints only. The dispatcher write endpoints (create, add/remove/reorder stop, depart,
> return, complete, cancel, delete) are the next slice — the frontend already calls them, so those
> calls currently 404.

### Admin
| Method | Endpoint | Role |
|--------|----------|------|
| POST | `/api/users` | Admin |
| GET | `/api/users/{id:int}` | Admin |
| POST | `/api/demo/reset` | Admin |

### Health
| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/health` | Public, no dependency calls |

---

## 🎨 Design System (Frontend)

**Tokens** (`frontend/src/index.css` — CSS variables):
```css
:root {
  --bg-page: #D6EAF8;          /* Ice Blue */
  --bg-surface: #FFFFFF;
  --border-hairline: #B3D4F0;
  --text-main: #0A0E17;        /* Midnight Ink */
  --text-muted: #3D5A7A;
  --color-accent: #FF4D00;     /* Vermilion */
  --color-accent-hover: #E63E00;
  --color-success: #059669;    /* Delivered */
  --color-warning: #D97706;    /* InTransit */
  --color-danger: #DC2626;     /* Failed */
  --color-info: #0284C7;       /* Assigned */
}
.dark {
  --bg-page: #0A0E17;          /* Midnight Ink */
  --bg-surface: #111318;
  --border-hairline: #1E252D;
  --text-main: #D6EAF8;        /* Ice Blue */
  --text-muted: #8B9CB3;
  --color-accent: #FF5A3D;     /* Vermilion (light) */
  --color-accent-hover: #FF765D;
  --color-success: #34D399;
  --color-warning: #FBBF24;
  --color-danger: #F87171;
  --color-info: #38BDF8;
}
```

**Status Badge** — signature pattern: tinted bg (~10%) + solid text + 6px dot

**Components** (all in `src/components/ui/`):
- `Button` — variants: primary, outline, ghost, danger, success; sizes: sm, md, lg
- `Input` — label, error state, focus ring
- `Card` — interactive prop for clickable cards
- `StatusBadge` — JobStatus, JobPriority, DriverStatus
- `Modal` / `Drawer` — focus trap, ARIA, Escape handling
- `Skeleton` — variants: table-row, card, stat-tile
- `EmptyState` — message + optional action
- `DriverMap` — Leaflet map wrapper (stops + live driver marker), not a primitive but lives alongside them

---

## ⚠️ Known Limitations

| Area | Limitation | Future Work |
|------|------------|-------------|
| **Trip-sheet writes** | Queue, create, cancel and delete work server-side; the HTTP write endpoints the dispatch board calls are not implemented yet, so add/remove/reorder/depart/return/complete/cancel/delete return 404 | Next slice (DTOs + `TripSheetsController` write actions + role gates + driver ownership) |
| **Trip-sheet concurrency** | `TripSheet.Version` is still an unused `byte[]` column — `[Timestamp]` doesn't map to PostgreSQL `xmin` the way it does for `Job` | Map it to `xmin` like `Job.Version`, then return 409 on conflict |
| **Trip-sheet realtime** | `TripSheetHub` exists and the client listens, but nothing is broadcast: `ISignalRService` has no trip-sheet methods | Broadcast create/status/stop events from the new write endpoints |
| **Trip-sheet print** | Print stylesheet hides the wrong elements, so the manifest prints with the app chrome | Fix the `@media print` block and render a dedicated manifest view |
| **API 404s** | The SPA fallback serves `index.html` for unknown `/api/*` paths, so a typo'd route returns 200 HTML instead of 404 JSON | Only fall back for non-`/api` paths |
| **Driver rows** | No `GET /api/users` list endpoint; admin user management works by id | Add a paged list |
| **Routes** | No route optimisation (OR-Tools/OSRM) — stop order is manual, reordering is a no-op in the UI | Phase 3 of the route planning plan |
| **Geocoding** | Seed coordinates only (no live Nominatim) | Add with Redis caching if needed |
| **Frontend tests** | No unit tests; one Playwright smoke spec exists but is not wired into CI | Add Vitest + RTL, then run Playwright in CI |
| **Testcontainers** | Tests run against a real PostgreSQL from `ConnectionStrings__Default` — by default the same Neon database as production | Testcontainers or a dedicated test database |
| **Cold starts** | ~30-50s on Render free tier after idle | Paid plan removes it |

---

## 📋 Architecture Decision Records

| ADR | Title | Status |
|-----|-------|--------|
| 001 | PostgreSQL via Neon | ✅ Accepted |
| 002 | JWT + httpOnly Rotating Refresh Tokens | ✅ Accepted |
| 003 | Non-Critical Redis Cache with DB Fallback | ✅ Accepted |
| 004 | Single-Container Serving (Node→wwwroot) | ✅ Accepted |
| 005 | Free-Tier Hosting Constraints & Trade-offs | ✅ Accepted |

---

## 🛠 Tech Stack Summary

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, TypeScript 6, Vite 8, TanStack Query 5, React Router 7, @microsoft/signalr |
| **Styling** | Tailwind CSS 4 (CSS variables), Fontsource Inter, Lucide React |
| **Backend** | ASP.NET Core 10, EF Core 10, Npgsql, JWT Bearer, Serilog, SignalR |
| **Database** | PostgreSQL 16 (Neon serverless) |
| **Cache** | Redis (Upstash TLS) / In-memory fallback |
| **Auth** | ASP.NET Identity PasswordHasher, JWT, rotating refresh tokens |
| **Real-time** | SignalR (WebSocket) — JobHub, DriverHub, TripSheetHub (trip-sheet broadcasts pending), JWT auth |
| **Maps** | Leaflet + React Leaflet (OpenStreetMap tiles) |
| **Testing** | xUnit, WebApplicationFactory, Playwright (one smoke spec, not in CI) |
| **Container** | Docker multi-stage (Node 22 → .NET 10 → ASP.NET 10) |
| **CI/CD** | GitHub Actions (build, test, docker, deploy) |
| **Hosting** | Render (container), Neon (PostgreSQL), Upstash (Redis) |

---

## 📄 License

MIT License — see [LICENSE](LICENSE)

---

## 🙋 Author

**Angelo** — Full-stack .NET / React developer

- Portfolio: [My Portfolio](https://angelo-puza-portfolio.vercel.app/)
- LinkedIn: [linkedin.com/in/your-profile](https://linkedin.com/in/your-profile)
- GitHub: [github.com/Ang3loSP](https://github.com/Ang3loSP)

> Built as a flagship portfolio project to demonstrate end-to-end full-stack delivery capability. No employer code, data, or terminology reused — knowledge only.
