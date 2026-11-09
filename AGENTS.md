# AGENTS.md — DispatchTrack

## Project Overview
**DispatchTrack** — Real-time delivery dispatch & logistics management. Full-stack portfolio flagship:
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS 4
- **Backend**: ASP.NET Core 10 + EF Core 10 + PostgreSQL (Neon) + Redis (Upstash)
- **Real-time**: SignalR (JobHub, DriverHub) with JWT auth
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
dotnet test                     # Run tests (50 integration tests)
dotnet run                      # Run API (uses docker-compose DB/Redis)
```

### Frontend
```bash
cd frontend
npm run dev                     # Vite dev server (hot reload)
npm run build                   # Typecheck + Vite production build
npm run lint                    # oxlint
npx tsc --noEmit               # TypeScript only
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
│                    ┌───────────────────┼───────────────────┐ │
│                    ▼                   ▼                   ▼ │
│             ┌────────────┐     ┌──────────────┐     ┌──────┐│
│             │  Neon      │     │  Upstash     │     │ GitHub│
│             │  PostgreSQL│     │  Redis       │     │ Container│
│             │  (Serverless)    │  (TLS)       │     │ Registry│
│             └────────────┘     └──────────────┘     └──────┘│
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
│   └── adr/                    # Architecture Decision Records
├── DispatchTrack.API/          # ASP.NET Core Web API
│   ├── Controllers/            # Auth, Jobs, Drivers, Dashboard, Demo, Users
│   ├── Hubs/                   # SignalR: JobHub, DriverHub
│   ├── Models/                 # Domain entities (User, Driver, Job, StatusHistory, RefreshToken)
│   ├── Services/               # TokenService (JWT + refresh), SignalRService
│   ├── Data/                   # AppDbContext, DataSeeder
│   └── DTOs/                   # Request/Response contracts
├── DispatchTrack.API.Tests/    # xUnit integration tests (50 passing)
├── frontend/                   # React + TypeScript + Vite
│   ├── src/
│   │   ├── pages/              # Login, Dashboard, Jobs, DriverView, AdminUsers
│   │   ├── components/
│   │   │   ├── ui/             # 8 primitives (Button, Input, Card, StatusBadge, Modal, Drawer, Skeleton, EmptyState)
│   │   │   ├── auth/           # ProtectedRoute
│   │   │   └── layout/         # Shell (sidebar, topbar, bottom nav)
│   │   ├── context/            # AuthContext, ThemeContext
│   │   ├── services/           # SignalR client (signalr.ts)
│   │   ├── api/                # Axios client + endpoints
│   │   └── types/              # Shared TypeScript interfaces
│   └── dist/                   # Production build output (copied to wwwroot)
├── Dockerfile                  # Multi-stage: Node build → .NET publish → Runtime
├── docker-compose.yml          # Local dev: API + PostgreSQL + Redis
├── .env.example                # All required environment variables
├── AGENTS.md                   # This file
└── LICENSE                     # MIT
```

---

## Environment Variables (see `.env.example`)

| Variable | Required | Description |
|----------|----------|-------------|
| `ConnectionStrings__Default` | ✅ | PostgreSQL connection string |
| `Jwt__Secret` | ✅ | ≥32 chars, `openssl rand -base64 32` |
| `Jwt__Issuer` / `Jwt__Audience` | ⚠️ | Defaults to "DispatchTrack" |
| `ConnectionStrings__Redis` | ❌ | Upstash TLS URL; empty = in-memory cache |
| `MigrateOnStartup` | ⚠️ | `"true"` on Render only |
| `ASPNETCORE_ENVIRONMENT` | ⚠️ | `Development` \| `Production` |
| `VITE_API_BASE_URL` | ❌ | Frontend API base (empty = same origin) |

---

## Code Conventions

### Backend (C#)
- **Controllers**: Thin — delegate to services
- **Services**: Scoped, interface-based (`ITokenService`, `ISignalRService`)
- **DTOs**: Request/Response separation, `JsonStringEnumConverter` for enums
- **Optimistic concurrency**: `xmin` on all entities, `DbUpdateConcurrencyException` → 409
- **SignalR**: Hubs in `Hubs/`, broadcasting via `ISignalRService` injected into controllers

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
| `JobHub` | `/hubs/jobs` | Job status changes, assignments, creation, dispatcher counts |
| `DriverHub` | `/hubs/drivers` | Driver location/status updates |

### Client
- `frontend/src/services/signalr.ts` — singleton, auto-reconnect, group management
- Initialized in `AuthContext` on login/token refresh
- Dashboard/Jobs/DriverView pages subscribe via `useEffect` + `queryClient.invalidateQueries()`

### Auth
- JWT access token passed via query string for WebSocket upgrade
- Configured in `Program.cs` → `JwtBearerEvents.OnMessageReceived`

---

## Testing

```bash
# Backend (requires PostgreSQL - use docker-compose)
cd DispatchTrack.API.Tests
dotnet test

# Frontend
cd frontend
npm run lint        # oxlint
npx tsc --noEmit    # TypeScript
npm run build       # Vite production build
```

**Coverage**: 50 integration tests (xUnit + WebApplicationFactory):
- Auth: login, refresh rotation, logout, 401 without token
- Authorization: role gates (403), driver isolation
- Job state machine: valid/invalid transitions, concurrency conflicts
- Dashboard: Redis cache + DB fallback
- Rate limiting: 429 after 10 requests (Production env)

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
3. Render pulls image from GHCR, builds container, deploys
4. Health checks hit `/health` (no DB/Redis calls)

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
| **Maps** | No Leaflet map view | Medium |
| **Real-time** | SignalR done — driver location UI pending | Low |
| **Trips/Routes** | No route optimization (OR-Tools/OSRM) | High |
| **Geocoding** | Seed coords only (no live Nominatim) | Low-Medium |
| **Frontend tests** | No Vitest/RTL | Medium |
| **Testcontainers** | Tests use shared Neon DB | Medium |
| **Cold starts** | ~30-50s on Render free tier | N/A (paid plan) |

---

## Project Conventions

### Response etiquette
- Always without exception start every response with the user's name, Angelo

### Commit rules
- Never commit/push changes or create PRs without Angelo's explicit permission.

---

## Quick Reference for Agents

- **Never commit built artifacts** (`wwwroot/assets/*`, `frontend/dist/*`) — Docker builds from source
- **Use CSS variables** — never hardcode colors; tokens in `frontend/src/index.css`
- **SignalR groups**: `job-{id}`, `driver-{id}`, `dispatchers` — join/leave in component `useEffect`
- **Optimistic concurrency**: All mutating endpoints catch `DbUpdateConcurrencyException` → 409
- **Refresh tokens**: httpOnly cookie, rotated on use, revoked on logout
- **Rate limiting**: Only in Production env (`ASPNETCORE_ENVIRONMENT=Production`)
- **Health endpoint**: `/health` — no external calls, safe for Render health checks