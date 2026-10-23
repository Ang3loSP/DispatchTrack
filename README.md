# DispatchTrack

**Real-time delivery dispatch & logistics management** — a full-stack portfolio flagship demonstrating end-to-end software delivery: React + TypeScript frontend, ASP.NET Core Web API, PostgreSQL, Redis, Docker, CI/CD, and free-tier cloud deployment.

> **Live Demo:** [dispatchtrack.onrender.com](https://dispatchtrack.onrender.com) *(free tier: ~30-50s cold start after 15 min idle)*
>
> **API Docs (Swagger):** [dispatchtrack.onrender.com/swagger](https://dispatchtrack.onrender.com/swagger)

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
│                    ┌───────────────────┼───────────────────┐     │
│                    ▼                   ▼                   ▼     │
│             ┌────────────┐     ┌──────────────┐     ┌──────────┐│
│             │  Neon      │     │  Upstash     │     │  GitHub  ││
│             │  PostgreSQL│     │  Redis       │     │  Container││
│             │  (Serverless)     │  (TLS)       │     │  Registry ││
│             └────────────┘     └──────────────┘     └──────────┘│
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
- **Optimistic concurrency**: PostgreSQL `xmin` prevents lost updates
- **Status history**: Every transition recorded with user + timestamp
- **Driver assignment**: Dispatchers assign jobs; drivers cannot be Offline
- **Dashboard**: Real-time counts (jobs by status, drivers by status, jobs created today) — Redis cached
- **Demo reset**: `POST /api/demo/reset` wipes & reseeds database (Admin only)
- **Rate limiting**: 10 req/min on login/refresh (production only)

### Frontend (React + TypeScript + Vite + Tailwind v4)
- **5 Pages**: Login, Dashboard, Jobs Management, Driver Portal, Admin Users
- **8 Hand-rolled UI primitives**: Button, Input, Card, StatusBadge, Modal, Drawer, Skeleton, EmptyState
- **Design system**: CSS variable tokens (light/dark), Inter font, hairline borders, single accent color
- **Accessibility**: WCAG AA — focus traps, ARIA, keyboard nav, focus-visible rings, 48dp touch targets
- **Mobile-first Driver view**: Thumb-reachable action buttons, bottom tab navigation
- **TanStack Query**: Server state, auto-refetch, optimistic updates
- **Axios interceptor**: Silent token refresh on 401

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Docker Desktop
- .NET 10 SDK (for running tests outside container)
- Node 22+ (for frontend dev server)

### One-Command Startup
```bash
# 1. Clone & configure
git clone https://github.com/your-username/DispatchTrack.git
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
# Backend tests (requires PostgreSQL - use docker-compose)
cd DispatchTrack.API.Tests
dotnet test

# Frontend typecheck + lint
cd frontend
npm run lint        # oxlint
npx tsc --noEmit    # TypeScript
npm run build       # Vite production build
```

**Test Coverage:** 50 integration tests (xUnit + WebApplicationFactory) covering:
- Auth: login, refresh rotation, logout, 401 without token
- Authorization: role gates (403), driver isolation
- Job state machine: valid/invalid transitions, concurrency conflicts
- Dashboard: Redis cache + DB fallback
- Rate limiting: 429 after 10 requests (Production env)

---

## 📁 Project Structure

```
DispatchTrack/
├── .github/workflows/          # CI (build, test, docker) + Deploy (Render hook)
├── docs/
│   ├── DESIGN.md               # Frontend design direction (tokens, components, patterns)
│   └── adr/                    # Architecture Decision Records
│       ├── ADR-001-database-selection.md
│       ├── ADR-002-jwt-refresh-tokens.md
│       ├── ADR-003-non-critical-redis.md
│       ├── ADR-004-single-container-serving.md
│       └── ADR-005-free-tier-hosting.md
├── DispatchTrack.API/          # ASP.NET Core Web API
│   ├── Controllers/            # Auth, Jobs, Drivers, Dashboard, Demo, Users
│   ├── Models/                 # Domain entities (User, Driver, Job, StatusHistory, RefreshToken)
│   ├── Services/               # TokenService (JWT + refresh)
│   ├── Data/                   # AppDbContext, DataSeeder
│   └── DTOs/                   # Request/Response contracts
├── DispatchTrack.API.Tests/    # xUnit integration tests (50 passing)
├── frontend/                   # React + TypeScript + Vite
│   ├── src/
│   │   ├── pages/              # Login, Dashboard, Jobs, DriverView, AdminUsers
│   │   ├── components/
│   │   │   ├── ui/             # 8 primitives (Button, Input, Card, ...)
│   │   │   ├── auth/           # ProtectedRoute
│   │   │   └── layout/         # Shell (sidebar, topbar, bottom nav)
│   │   ├── context/            # AuthContext, ThemeContext
│   │   ├── api/                # Axios client + endpoints
│   │   └── types/              # Shared TypeScript interfaces
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
| `MigrateOnStartup` | ⚠️ | `"true"` on Render only |
| `ASPNETCORE_ENVIRONMENT` | ⚠️ | `Development` \| `Production` |

---

## 📦 Deployment (Render Free Tier)

1. **Push to GitHub** → CI runs (build, test, docker)
2. **On main + green CI** → Deploy workflow triggers Render Deploy Hook
3. **Render** pulls image from GitHub Container Registry, runs container
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
| PATCH | `/api/jobs/{id}/status` | Driver (own), Admin |

### Dashboard & Drivers
| Method | Endpoint | Roles |
|--------|----------|-------|
| GET | `/api/dashboard/summary` | Admin, Dispatcher |
| GET | `/api/drivers` | Admin, Dispatcher |
| GET | `/api/drivers/me/jobs` | Driver |

### Admin
| Method | Endpoint | Role |
|--------|----------|------|
| POST | `/api/users` | Admin |
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
  --bg-page: #FAFAFA;
  --bg-surface: #FFFFFF;
  --border-hairline: #E5E7EB;
  --text-main: #111827;
  --text-muted: #6B7280;
  --color-accent: #4F46E5;    /* Indigo */
  --color-success: #059669;   /* Delivered */
  --color-warning: #D97706;   /* InTransit */
  --color-danger: #DC2626;    /* Failed */
  --color-info: #0284C7;      /* Assigned */
}
.dark { /* dark-mode overrides */ }
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

---

## ⚠️ Known Limitations

| Area | Limitation | Future Work |
|------|------------|-------------|
| **Maps** | No Leaflet map view (stretch goal) | Phase 6+ if time permits |
| **Real-time** | No SignalR live updates | Polling every 10-15s currently |
| **Trips/Routes** | No trip grouping — jobs assigned individually | Re-add as stretch |
| **Geocoding** | Seed coordinates only (no live Nominatim) | Add with caching if needed |
| **Frontend tests** | No unit tests (cut from MVP) | Add Vitest + RTL if portfolio demands |
| **Testcontainers** | Tests use shared Neon DB (parallelization disabled) | Phase 8: Testcontainers for isolation |
| **Cold starts** | ~30-50s on Render free tier after idle | Document in README; paid plan removes |

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
| **Frontend** | React 19, TypeScript 6, Vite 8, TanStack Query 5, React Router 7 |
| **Styling** | Tailwind CSS 4 (CSS variables), Fontsource Inter, Lucide React |
| **Backend** | ASP.NET Core 10, EF Core 10, Npgsql, JWT Bearer, Serilog |
| **Database** | PostgreSQL 16 (Neon serverless) |
| **Cache** | Redis (Upstash TLS) / In-memory fallback |
| **Auth** | ASP.NET Identity PasswordHasher, JWT, rotating refresh tokens |
| **Testing** | xUnit, WebApplicationFactory, Playwright (planned) |
| **Container** | Docker multi-stage (Node 22 → .NET 10 → ASP.NET 10) |
| **CI/CD** | GitHub Actions (build, test, docker, deploy) |
| **Hosting** | Render (container), Neon (PostgreSQL), Upstash (Redis) |

---

## 📄 License

MIT License — see [LICENSE](LICENSE)

---

## 🙋 Author

**Angelo** — Full-stack .NET / React developer

- Portfolio: [your-portfolio.dev](https://your-portfolio.dev)
- LinkedIn: [linkedin.com/in/your-profile](https://linkedin.com/in/your-profile)
- GitHub: [github.com/your-username](https://github.com/your-username)

> Built as a flagship portfolio project to demonstrate end-to-end full-stack delivery capability. No employer code, data, or terminology reused — knowledge only.