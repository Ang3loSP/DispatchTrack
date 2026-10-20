# DispatchTrack Frontend — Design Direction

The accepted visual direction for the React frontend (Phase 6). Phase 6/11 work builds
against this document; deviations should update it in the same change.

## Document Info

- Owner: Angelo
- Last updated: 2026-10-20
- Applies to: `frontend/` (not yet scaffolded as of this writing)
- Status: accepted — pending implementation in Phase 6

## Context

The project plan covered frontend *functionality* (Phase 6) and *screenshots* (Phase 11)
but nothing owned how the UI looks. Screenshots are the portfolio payload, so the visual
direction is a decision worth recording before any page is built.

## Goals & non-goals

**Goals** — an operations console that scans fast, photographs well for portfolio use,
meets WCAG AA in both themes, and costs almost nothing to maintain.

**Non-goals** — decorative depth effects, component-library abstraction, custom branding.
This is a dense data tool, not a marketing page.

## Direction

**One-line aesthetic:** Linear/Stripe-grade restraint — near-monochrome, one signal color,
hairline borders, dense-but-breathable tables. Reads like software people pay for.

Separation is done with 1px hairline borders, not shadows or translucency. The accent
color appears only on primary actions, links, focus rings, and status tints.

## Color tokens

Single source of truth, consumed by Tailwind via CSS variables. The toggle swaps the
`dark` set; changing any color is a one-line edit here.

| Token        | Light      | Dark       | Role                             |
| ------------ | ---------- | ---------- | -------------------------------- |
| Background   | `#FAFAFA`  | `#0A0A0B`  | page                             |
| Surface      | `#FFFFFF`  | `#111113`  | cards, tables                    |
| Border       | `#E5E7EB`  | `#262629`  | 1px hairlines (primary separator) |
| Text         | `#111827`  | `#F4F4F5`  | primary                          |
| Text muted   | `#6B7280`  | `#A1A1AA`  | labels, timestamps               |
| Accent       | `#4F46E5`  | `#818CF8`  | primary actions, links, focus    |
| Success      | `#059669`  | `#34D399`  | Delivered                        |
| Warning      | `#D97706`  | `#FBBF24`  | InTransit                        |
| Danger       | `#DC2626`  | `#F87171`  | Failed, destructive actions      |
| Info         | `#0284C7`  | `#38BDF8`  | Assigned                         |

## Status badges — the signature pattern

Job status is the most-scanned datum on every screen. Every status renders as: tinted
background (status color at ~10% opacity) + solid status-colored text + 6px dot.
Consistent everywhere: tables, cards, dashboard tiles, job detail.

## Typography & density

- Inter, self-hosted via fontsource (no CDN dependency).
- 14px base body, 12px table/meta text, 20–24px page titles.
- Tabular numerals for anything that aligns vertically (IDs, counts, timestamps).
- Headings weight 600, tracking-tight. No decorative type.

## Layout patterns

- **Shell:** fixed left sidebar (icon + label, collapsible on desktop), top bar with page
  title, theme toggle, user menu. Collapses to a bottom tab bar on mobile — the driver
  view lives there.
- **Dashboard:** 4 stat tiles (Pending / In transit / Delivered today / Offline drivers),
  each clickable → filtered job list. Below: recent jobs table + unassigned-queue side panel.
- **Jobs list:** real table — Status badge, ID, Pickup → Dropoff, Driver, Time. Status
  filter chips + pagination. Row click → detail view with status-history timeline.
- **Driver view:** mobile-first cards, one job per card, large status-transition button at
  the bottom ("Start delivery" → "Mark delivered"). Thumb-reachable, no tables.
- **States:** skeleton loaders (no spinners), one-line muted empty states ("No unassigned
  jobs — nice work."), inline error banners with retry.

## Motion & polish budget

- 150ms hover/focus transitions, 200ms drawer slide, badge color crossfade on status change.
- No scroll animations, no parallax, no gradients. Restraint is the brand.
- Visible focus rings (accent, 2px) — accessibility is part of the look.

## Theme toggle

- Tailwind `dark:` variant, class strategy. Toggle persists in `localStorage`, defaults to
  `prefers-color-scheme`. Sun/moon icon in the top bar.
- One deliberate glass borrow: a single `backdrop-blur` utility on the sticky top bar and
  mobile bottom nav (content scrolls beneath it). Nothing else is translucent.

## Components

Hand-rolled primitives on Tailwind, no component library — roughly 10 components:
Button, Input, Badge, Table, Card, Drawer, Tabs, Toast, EmptyState, Skeleton.

## Alternatives considered

- **Glassmorphism / Liquid Glass (frosted-glass skills):** rejected — translucent surfaces
  and refraction replace the hairline separation this design depends on, and blur behind
  12px table text is the easiest way to fail WCAG AA contrast. Reads as trend-chasing to a
  recruiter audience. Revisit only for a hypothetical marketing/demo splash page, which is
  the one surface with room for it.
- **Component library (shadcn, MUI):** rejected — keeps the bundle tiny and the code
  demonstrable; 10 primitives is a solvable amount of work.
- **Deliberately plain stock Tailwind:** rejected — weakest portfolio screenshots.
- **Dark-primary theme:** rejected in favor of light+dark toggle; light screenshots are
  more legible in a README.

## Consequences

- All color/type changes route through the token table — no hunting through components.
- ~1–2 hrs added to Phase 6 for the token layer + primitives, then every page is free.
- Accent indigo is the safe default; swapping it (e.g. amber for a freight feel) is a
  one-line token edit at any time.
- No charts on the dashboard in scope; stat tiles + counts first.

## Future work

- Charts on the dashboard — only if Phase 6 time remains.
- Marketing/demo splash page (Phase 11+) — the only candidate for a real glass treatment.
