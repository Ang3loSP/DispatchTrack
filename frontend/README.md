# DispatchTrack Frontend

React 19 + TypeScript + Vite 8 + Tailwind CSS 4 single-page application for the DispatchTrack logistics platform.

## 🚀 Quick Start

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173 (proxies /api to localhost:5084)
npm run build        # Production build to dist/
npm run lint         # oxlint (fast, Rust-based)
npx tsc --noEmit     # TypeScript typecheck
```

## 📦 Dependencies

| Package | Purpose |
|---------|---------|
| `react`, `react-dom` | UI framework |
| `react-router-dom` | Client-side routing |
| `@tanstack/react-query` | Server state, caching, refetching |
| `axios` | HTTP client with interceptors |
| `lucide-react` | Icons (tree-shakeable) |
| `@fontsource/inter` | Self-hosted Inter font |
| `zod` | Schema validation (forms) |
| `tailwindcss` + `@tailwindcss/vite` | Utility-first CSS (v4, CSS variables) |

**Dev Dependencies:** `typescript`, `vite`, `@vitejs/plugin-react`, `oxlint`, `@types/*`

## 🏗 Project Structure

```
frontend/
├── src/
│   ├── api/
│   │   ├── client.ts         # Axios instance + 401 refresh interceptor
│   │   └── endpoints.ts      # Typed API functions (authApi, jobsApi, ...)
│   ├── components/
│   │   ├── ui/               # 8 hand-rolled primitives
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── StatusBadge.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Drawer.tsx
│   │   │   ├── Skeleton.tsx
│   │   │   └── EmptyState.tsx
│   │   ├── auth/
│   │   │   └── ProtectedRoute.tsx
│   │   └── layout/
│   │       └── Shell.tsx     # Sidebar, topbar, bottom nav, modals
│   ├── context/
│   │   ├── AuthContext.tsx   # JWT in memory, refresh via cookie
│   │   └── ThemeContext.tsx  # Dark/light toggle (localStorage)
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── JobsPage.tsx
│   │   ├── DriverViewPage.tsx
│   │   └── AdminUsersPage.tsx
│   ├── types/
│   │   └── index.ts          # Shared TypeScript interfaces
│   ├── utils/
│   │   └── cn.ts             # clsx + tailwind-merge helper
│   ├── App.tsx               # Routes + providers
│   ├── main.tsx              # Entry point
│   └── index.css             # Design tokens + Tailwind imports
├── public/                   # Static assets (favicon, icons.svg)
├── dist/                     # Production build (gitignored, created by build)
├── package.json
├── tsconfig.json
├── vite.config.ts
└── .env.example              # (optional) VITE_API_BASE_URL
```

## 🎨 Design System

**Tokens** (`src/index.css` — CSS variables consumed by Tailwind):
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
| Driver View | `/driver` | Driver, Admin | Mobile-first cards, thumb-reachable actions (Start → Delivered/Failed), failed modal |
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
```

## 🧪 Quality Gates

```bash
npm run lint        # oxlint — 0 errors, 0 warnings expected
npx tsc --noEmit    # Strict TypeScript — no errors
npm run build       # Vite production build — <2s, verbatimModuleSyntax compliant
```

## 📱 Responsive Breakpoints

| Breakpoint | Usage |
|------------|-------|
| `< 640px` | Mobile — bottom nav, stacked layouts, full-width buttons |
| `640px - 1024px` | Tablet — sidebar collapsible, 2-col grids |
| `> 1024px` | Desktop — fixed sidebar, 4-col stat tiles, 3-col dashboard grid |

## 🔧 Configuration

| File | Purpose |
|------|---------|
| `vite.config.ts` | Vite plugins, dev server proxy (`/api` → `localhost:5084`) |
| `tsconfig.json` | Strict mode, `verbatimModuleSyntax`, path aliases |
| `tsconfig.app.json` | App-specific TS config (extends base) |
| `tsconfig.node.json` | Node scripts config (Vite config itself) |

## 🐳 Docker Integration

Frontend builds in **Dockerfile Stage 1** → output copied to `wwwroot` in Stage 3 → served by ASP.NET Core.

**Local dev:** Run `npm run dev` separately (hot reload). `docker-compose` runs API + DB only.

## 📚 Further Reading

- Root [README.md](../README.md) — full project overview, architecture, deployment
- [docs/DESIGN.md](../docs/DESIGN.md) — design direction, tokens, component inventory
- [docs/adr/](../docs/adr/) — Architecture Decision Records