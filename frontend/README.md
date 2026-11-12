# DispatchTrack Frontend

React 19 + TypeScript + Vite 8 + Tailwind CSS 4 single-page application for the DispatchTrack logistics platform.

## 🚀 Quick Start

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173 (proxies /api and /hubs to localhost:5084)
npm run build        # tsc -b && vite build → dist/
npm run lint         # oxlint (fast, Rust-based)
npx playwright test  # E2E smoke spec (needs dev server + API running)
```

> `npx tsc --noEmit` does nothing here: `tsconfig.json` is a solution file with `references` and no
> `files`. Use `npm run build` (it runs `tsc -b` first).

## 📦 Dependencies

| Package | Purpose |
|---------|---------|
| `react`, `react-dom` | UI framework |
| `react-router-dom` | Client-side routing |
| `@tanstack/react-query` | Server state, caching, refetching |
| `axios` | HTTP client with interceptors |
| `@microsoft/signalr` | Real-time connection to the three hubs |
| `leaflet` + `react-leaflet` | Driver map (OpenStreetMap tiles) |
| `lucide-react` | Icons (tree-shakeable) |
| `@fontsource/inter` | Self-hosted Inter font |
| `tailwindcss` + `@tailwindcss/vite` | Utility-first CSS (v4, CSS variables) |

**Dev Dependencies:** `typescript`, `vite`, `@vitejs/plugin-react`, `oxlint`, `@playwright/test`, `@types/*`

`src/utils/cn.ts` is a 2-line class-name joiner — there is no `clsx`/`tailwind-merge` dependency.

## 🏗 Project Structure

```
frontend/
├── src/
│   ├── api/
│   │   ├── client.ts         # Axios instance + 401 refresh interceptor
│   │   └── endpoints.ts      # Typed API functions (authApi, jobsApi, ...)
│   ├── components/
│   │   ├── ui/               # 8 hand-rolled primitives + DriverMap
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── StatusBadge.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Drawer.tsx
│   │   │   ├── Skeleton.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   └── DriverMap.tsx # Leaflet wrapper (stops + live driver marker)
│   │   ├── auth/
│   │   │   └── ProtectedRoute.tsx
│   │   └── layout/
│   │       └── Shell.tsx     # Sidebar, topbar, bottom nav, modals
│   ├── context/
│   │   ├── AuthContext.tsx   # JWT in memory, refresh via cookie, SignalR lifecycle
│   │   └── ThemeContext.tsx  # Dark/light toggle (localStorage)
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── JobsPage.tsx
│   │   ├── DispatchBoardPage.tsx
│   │   ├── DriverViewPage.tsx
│   │   └── AdminUsersPage.tsx
│   ├── services/
│   │   └── signalr.ts        # Singleton, one connection per hub, auto-reconnect
│   ├── types/
│   │   └── index.ts          # Shared TypeScript interfaces
│   ├── utils/
│   │   └── cn.ts             # Class-name joiner
│   ├── App.tsx               # Routes + providers
│   ├── main.tsx              # Entry point
│   └── index.css             # Design tokens + Tailwind imports
├── e2e/
│   └── smoke.spec.ts         # Playwright (not wired into CI)
├── public/                   # Static assets (favicon, icons.svg)
├── dist/                     # Production build (gitignored, created by build)
├── package.json
├── playwright.config.ts
├── tsconfig.json             # Solution file — references only
├── tsconfig.app.json
├── tsconfig.node.json
└── vite.config.ts
```

## 🎨 Design System

**Tokens** (`src/index.css` — CSS variables consumed by Tailwind):
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
.dark { /* inverted palette, accent #FF5A3D */ }
```

**Status Badge** — signature pattern: tinted bg (~10%) + solid text + 6px dot

**Components** — all in `src/components/ui/`:
| Component | Key Features |
|-----------|--------------|
| `Button` | variants: primary, outline, ghost, danger, success; sizes: sm, md, lg; loading state |
| `Input` | label, error, focus ring, hover state |
| `Card` | `interactive` prop for clickable cards with focus ring |
| `StatusBadge` | JobStatus, JobPriority, DriverStatus; sizes: sm, md |
| `Modal` | Focus trap, ARIA, Escape handling, focus restoration |
| `Drawer` | Slide-over panel (job detail), same a11y as Modal |
| `Skeleton` | Variants: table-row, card, stat-tile |
| `EmptyState` | Message + optional action button |
| `DriverMap` | Leaflet + OpenStreetMap; job markers and live driver position; `h-[350px]` on the driver page |

## 🔐 Authentication Flow

1. **Login** → `POST /api/auth/login` → returns access token (15 min) + sets httpOnly refresh cookie
2. **Access token** stored in memory (`client.ts` closure), attached via axios interceptor
3. **401 response** → interceptor calls `POST /api/auth/refresh` (with cookie) → new access token
4. **Refresh rotation** → old refresh token revoked, new one set in cookie
5. **Logout** → `POST /api/auth/logout` revokes refresh token, clears cookie
6. **Session restore** → on app load, `AuthContext` calls `/auth/refresh` automatically

## 🎯 Pages Overview

| Page | Route | Roles | Key Features |
|------|-------|-------|--------------|
| Login | `/login` | Public | Demo autofill buttons, theme toggle |
| Dashboard | `/dashboard` | Admin, Dispatcher | 4 stat tiles (clickable), jobs table, unassigned queue, fleet status |
| Jobs | `/jobs` | Admin, Dispatcher | Filter chips, pagination, search, detail drawer (assign/unassign), create modal |
| Dispatch Board | `/dispatch-board` | Admin, Dispatcher | Pending-job pool (status chips/search), open trip sheets, select jobs → create trip sheet, manifest modal + `window.print()`. Create posts to a not-yet-implemented endpoint, so it currently fails with a console error; drag highlight is visual only and reordering isn't wired |
| Driver View | `/driver` | Driver, Admin | Mobile-first cards, thumb-reachable actions (Start → Delivered/Failed), failed modal, Leaflet map with live position |
| Admin Users | `/users` | Admin | Provision staff, driver fleet table, demo reset (styled modal) |

## ♿ Accessibility (WCAG AA)

- **Focus management:** Traps in Modal/Drawer, restoration on close, Escape to close
- **Keyboard nav:** All interactive elements reachable, `Enter`/`Space` activation
- **Focus visible:** `focus-visible:ring-2 ring-[var(--color-accent)]` on all interactives
- **ARIA:** `role="dialog"`, `aria-modal="true"`, `aria-label` on icon buttons
- **Touch targets:** ≥48×48dp (Button `lg` = `h-12`, base `min-h-[44px]`)
- **Tables:** Sticky headers, keyboard-accessible rows (`tabIndex=0`, `role="button"`)
- **Live regions:** Error banners use `role="alert"`
- **Color:** Never sole indicator (badges have dot + text, bottom nav has border indicator)

## 🌐 API Integration

**Base URL:** `/api` (proxied to backend in dev via Vite, same-origin in prod)

**Endpoints** (`src/api/endpoints.ts`):
```typescript
authApi.login(email, password)
authApi.refresh()
authApi.logout()
authApi.me()

jobsApi.getJobs({ status, page, pageSize })
jobsApi.getJob(id)
jobsApi.createJob(input)
jobsApi.assignJob(id, driverId)
jobsApi.updateJobStatus(id, status)

driversApi.getDrivers()
driversApi.getMyJobs()

dashboardApi.getSummary()

usersApi.createUser(input)

demoApi.resetDemo()

tripSheetApi.getOpen()
tripSheetApi.getById(id)
tripSheetApi.getByDriver(driverId)
// write calls below have no server endpoint yet (B2) — they 404
tripSheetApi.create(input)
tripSheetApi.addJobs(id, input)
tripSheetApi.removeJob(tripSheetId, jobId)
tripSheetApi.reorderStops(id, map)
tripSheetApi.depart(id)
tripSheetApi.returnTrip(id)
tripSheetApi.complete(id)
tripSheetApi.cancel(id)
tripSheetApi.delete(id)
```

## 🧪 Quality Gates

```bash
npm run lint        # oxlint — 0 errors, 0 warnings expected
npm run build       # tsc -b && vite build — the only real typecheck
```

`npx tsc --noEmit` is not a gate: the root `tsconfig.json` has no files, only project references.
Playwright has one smoke spec (`e2e/smoke.spec.ts`) and is not part of CI.

## 📱 Responsive Breakpoints

| Breakpoint | Usage |
|------------|-------|
| `< 640px` | Mobile — bottom nav, stacked layouts, full-width buttons |
| `640px - 1024px` | Tablet — sidebar collapsible, 2-col grids |
| `> 1024px` | Desktop — fixed sidebar, 4-col stat tiles, 3-col dashboard grid |

## 🔧 Configuration

| File | Purpose |
|------|---------|
| `vite.config.ts` | Vite plugins, dev server proxy (`/api` and `/hubs` incl. WebSocket → `localhost:5084`) |
| `tsconfig.json` | Solution file — references `tsconfig.app.json` and `tsconfig.node.json`, no `files` |
| `tsconfig.app.json` | App TS config — strict, `verbatimModuleSyntax`; no path aliases |
| `tsconfig.node.json` | Node scripts config (Vite config itself) |
| `playwright.config.ts` | Playwright config for the single smoke spec |

## 🐳 Docker Integration

Frontend builds in **Dockerfile Stage 1** → output copied to `wwwroot` in Stage 3 → served by ASP.NET Core.

**Local dev:** Run `npm run dev` separately (hot reload). `docker-compose` runs API + DB only.

## 📚 Further Reading

- Root [README.md](../README.md) — full project overview, architecture, deployment
- [docs/DESIGN.md](../docs/DESIGN.md) — design direction, tokens, component inventory
- [docs/adr/](../docs/adr/) — Architecture Decision Records