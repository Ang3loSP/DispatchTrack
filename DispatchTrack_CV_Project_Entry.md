# DispatchTrack — Full-Stack Logistics Dispatch Platform

**Portfolio Flagship Project** | *Oct 2026 – Present* | **Tech Stack:** React 19, TypeScript, ASP.NET Core 10, PostgreSQL, Redis, Docker, GitHub Actions, Render, Neon, Upstash

---

## Project Overview

Built a production-grade **real-time delivery dispatch & logistics management system** from scratch to demonstrate end-to-end full-stack delivery capability: architecture, implementation, testing, containerization, CI/CD, and free-tier cloud deployment. Designed as a portfolio centerpiece to close gaps from previous ASP.NET MVC/Razor projects (SmartGear, TechStock IMS, BugTrack).

**Constraints:** 3–5 hrs/week | $0/month hosting (Render, Neon, Upstash) | Single-container architecture

---

## Architecture & Infrastructure

| Layer | Technology | Key Decisions |
|-------|------------|---------------|
| **Frontend** | React 19, TypeScript 6, Vite 8, TanStack Query 5, React Router 7 | Hand-rolled UI primitives (8 components), Tailwind CSS v4 with CSS-variable design tokens, Inter font self-hosted |
| **Backend** | ASP.NET Core 10, EF Core 10, Npgsql, JWT Bearer, Serilog | JWT (15 min) + rotating httpOnly refresh tokens (7 days, SHA-256 hashed), ProblemDetails errors |
| **Database** | PostgreSQL 16 (Neon Serverless) | `xmin` optimistic concurrency, auto-suspend to zero, TLS no IP whitelist |
| **Cache** | Redis (Upstash TLS) | Non-critical cache-aside pattern with DB fallback, 30s TTL, health checks never call Redis |
| **Auth** | ASP.NET Identity PasswordHasher | Rate-limited login/refresh (10/min/IP, Production only) |
| **Container** | Multi-stage Docker (Node 22 → .NET SDK 10 → ASP.NET 10) | Frontend builds to `wwwroot`, SPA fallback, single Render service |
| **CI/CD** | GitHub Actions | Build → Test → Docker → Deploy (Render deploy hook, gated by green CI) |
| **Monitoring** | `/health` (no deps), Serilog structured logs, Render logs | Uptime pinger hits `/health` only |

---

## Core Features Delivered

### Authentication & Authorization
- JWT access tokens (15 min) with `sub`, `role`, `email` claims
- Rotating refresh tokens stored hashed (SHA-256) in DB, delivered via `httpOnly` + `Secure` + `SameSite=Strict` cookie
- Replay detection: revoked token → invalidate all user tokens
- Role-based access: **Admin**, **Dispatcher**, **Driver** (enforced on API + UI)

### Job Lifecycle & State Machine
- Server-enforced transitions: `Pending → Assigned → InTransit → Delivered/Failed` (409 on violation)
- Optimistic concurrency via PostgreSQL `xmin` — prevents lost updates
- Full `StatusHistory` audit trail (user, timestamp, old/new status)
- Driver assignment validates driver not `Offline`; unassign/finalize frees driver

### Dashboard & Operations
- Real-time aggregates: jobs by status, drivers by status, jobs created today
- Redis-cached (30s TTL) with transparent DB fallback — Neon compute stays cold
- 10s auto-poll on frontend via TanStack Query

### Frontend (5 Pages, 8 Primitives)
| Page | Highlights |
|------|------------|
| **Login** | Demo autofill (Admin/Dispatcher/Driver), theme toggle |
| **Dashboard** | 4 clickable stat tiles, active jobs table, unassigned queue, fleet status |
| **Jobs Management** | Filter chips, pagination, search, detail drawer (assign/unassign), create modal |
| **Driver Portal** | Mobile-first cards, thumb-reachable actions (Start → Delivered/Failed), failed confirmation modal |
| **Admin Users** | Staff provisioning, driver fleet table, demo reset with styled modal |

### Accessibility (WCAG AA)
- Focus traps + `aria-modal` in Modal/Drawer, Escape handling, focus restoration
- Keyboard-accessible tables (`tabIndex=0`, `role="button"`, Enter/Space activation)
- Visible focus rings (`focus-visible:ring-2 ring-[var(--color-accent)]`) on all interactives
- Touch targets ≥ 48×48dp, color never sole indicator, `role="alert"` error banners

---

## Testing & Quality

- **50 xUnit integration tests** (WebApplicationFactory) — auth, authorization, state machine, concurrency, rate limiting, dashboard cache
- **Frontend:** `oxlint` (0 errors), `tsc --noEmit` (strict), `vite build` (<2s)
- **Test isolation:** Parallelization disabled (shared Neon DB); Testcontainers planned for Phase 8

---

## Documentation & Decision Records

- **Root README** — live demo, architecture diagram, quick start, API reference, known limitations
- **Frontend README** — design tokens, component inventory, auth flow, accessibility, quality gates
- **5 ADRs** in `docs/adr/`:
  - ADR-001: PostgreSQL via Neon
  - ADR-002: JWT + httpOnly rotating refresh tokens
  - ADR-003: Non-critical Redis cache with DB fallback
  - ADR-004: Single-container serving (Node → wwwroot)
  - ADR-005: Free-tier hosting constraints & trade-offs

---

## Known Limitations (Honest Disclosure)

| Area | Limitation | Mitigation / Future |
|------|------------|---------------------|
| **Maps** | No Leaflet map view (stretch) | Coordinates stored; add later |
| **Real-time** | Polling (10–15s), no SignalR | Add if portfolio demands |
| **Trips/Routes** | Jobs assigned individually | Re-add as stretch |
| **Geocoding** | Seed coordinates only | Nominatim with caching if needed |
| **Frontend tests** | None (cut from MVP) | Add Vitest + RTL if required |
| **Cold starts** | ~30–50s on Render free tier | Documented in README |

---

## CV-Ready Bullet Points (Copy-Paste)

**Full-Stack Engineer — DispatchTrack (Portfolio Flagship)**

- Architected and delivered a **full-stack logistics dispatch platform** (React 19 + TypeScript / ASP.NET Core 10 / PostgreSQL / Redis) on **$0/month free tiers** (Render, Neon, Upstash) with single-container Docker deployment
- Implemented **secure authentication**: JWT (15 min) + rotating httpOnly refresh tokens (7 days, SHA-256 hashed, replay detection, revocation on logout) with rate-limited endpoints
- Designed **server-enforced job state machine** (`Pending→Assigned→InTransit→Delivered/Failed`) with optimistic concurrency (PostgreSQL `xmin`) and full audit history
- Built **accessible, mobile-first React frontend** (5 pages, 8 hand-rolled primitives, TanStack Query, Tailwind v4 CSS-variable design system) meeting **WCAG AA** — focus traps, keyboard navigation, visible focus rings, 48dp touch targets
- Implemented **non-critical Redis caching** (cache-aside, 30s TTL, transparent DB fallback) keeping serverless PostgreSQL compute cold; `/health` endpoint has zero dependency calls
- Configured **multi-stage Docker build** (Node → .NET SDK → ASP.NET runtime) serving SPA from `wwwroot` with SPA fallback; docker-compose for local dev parity
- Established **CI/CD pipeline** (GitHub Actions): backend tests (50 passing), frontend typecheck/lint/build, Docker image build; deploy gated by green CI via Render deploy hook
- Authored **5 Architecture Decision Records** documenting trade-offs: auth strategy, cache design, container pattern, free-tier hosting — interview-ready technical depth

---

## Links

- **Live Demo:** `https://dispatchtrack.onrender.com` (free tier — 30–50s cold start after idle)
- **API Docs (Swagger):** `https://dispatchtrack.onrender.com/swagger`
- **GitHub:** `https://github.com/Ang3loSP/DispatchTrack`
- **Architecture Diagram:** See README (Mermaid diagram rendered on GitHub)

---

## Interview Talking Points

> "I chose **Neon PostgreSQL** over Azure SQL because my student subscription was capped at one project, and Neon's serverless scale-to-zero fits a free-tier budget while avoiding firewall IP issues with Render's dynamic IPs."

> "The **refresh token rotation with replay detection** means a stolen refresh token is usable only once — on second use, all tokens for that user are revoked. The httpOnly cookie keeps it out of JavaScript reach."

> "Redis is **non-critical** — the dashboard falls back to PostgreSQL transparently. The `/health` endpoint never calls Redis or the DB, so uptime pingers don't burn free-tier quotas or wake suspended compute."

> "The **single-container pattern** (Node builds Vite → `wwwroot` → ASP.NET Core serves static files + API) avoids CORS, shares cookies seamlessly, and fits Render's one-free-web-service limit."

> "I **cut Trips/TripJobs, multi-tenancy, and frontend unit tests** from MVP to hit the deadline — every cut is documented in the project plan with rationale. What remains is auth, state machine, tests, Docker: the non-negotiables."

---

*Generated: 2026-10-23 | For CV/Portfolio/LinkedIn use*