# Route Planning — Integration Plan

## Overview

Port the route-planning capability from the PMDOnline *Dispatch Route Planning System* into
DispatchTrack, on the same free-tier infrastructure (Render, Neon, Upstash).

**Source system features:** trip-sheet creation with a driver and destination category, a dispatch
queue, per-item stop numbers, depart/cancel workflow, geocoded customer addresses, greedy
auto-clustering (15 km radius) with nearest-neighbour ordering from a depot, a Leaflet route page with
on-demand OSRM road geometry, and a Nominatim geocoder with a background pre-warm.

**What actually ships here:** the parts that are cheap, testable and demoable — stop sequencing, a real
route line, and on-demand geocoding. Session persistence, a background geocoder, a separate planning
hub and the Google Maps variant are deliberately cut; the rationale is in the decisions table.

Last updated: 2026-11-12.

---

## How the inspiration's map works (verified reading of the source system)

1. Leaflet 1.9.4 + OpenStreetMap tiles, no API key, loaded from CDN inside a Blazor component.
2. All map work goes through `window.routePlanning` (`initMap`, `renderStops`, `renderRoutes`,
   `fitToStops`, `fitToGroup`) in `wwwroot/js/routePlanning.js`.
3. `initMap` polls for `window.L` (up to 10 s), centres on the depot, adds the OSM tile layer, draws a
   🏠 depot marker and one coloured marker per stop (colour = trip group).
4. **Route lines are on-demand only.** `Check Route` calls OSRM
   (`router.project-osrm.org/route/v1/driving/{lng,lat;...}?overview=full&geometries=geojson`) with the
   depot plus the ordered stops, and draws the returned geometry as a solid line (weight 3, opacity
   0.75). On failure it draws a **dashed straight line** as an explicit "OSRM could not resolve this"
   signal. Requests are spaced ~500 ms to be kind to the public server.
5. The depot is geocoded once from a settings row and cached for the service lifetime.
6. Geocoding is a 4-tier Nominatim strategy (structured queries with and without house number →
   free-text variants → wrong-area guard on suburb/town tokens → South Africa bounding-box check),
   rate-limited to ~1.1 s with a descriptive `User-Agent`, plus a hosted background service that
   geocodes unresolved addresses 1 minute after startup and nightly at 02:00.
7. Stops without coordinates are listed in a `NoCoordinates` bucket and never drawn on the map.

None of those map files exist in the PMDOnline repo snapshot — the technique is standard Leaflet +
OSRM, so the files are not needed; this plan reimplements only what DispatchTrack needs.

---

## Verified on 2026-11-12

Probes run from the dev machine with no API key:

| Call | Result |
|---|---|
| OSRM driving route between two Johannesburg points | `code=Ok`, 1,707 m, 160 s, **45-point road geometry** — usable as-is |
| OSRM response headers with an `Origin` set | `Access-Control-Allow-Origin: *`, `Allow-Methods: GET` — a browser call would work, but we still proxy it server-side for caching, one `User-Agent`, and one place to rate-limit |
| OSRM memory, per its own wiki | Runtime RAM ≈ the size of the pre-processed datafiles; pre-processing scales ~6–7× the `.pbf`. Geofabrik `south-africa-latest.osm.pbf` is **405 MB**, so a country build needs multiple GB at build time and hundreds of MB at runtime — it will not sit beside the API in Render's 512 MB |
| Nominatim `q=Sandton City, Johannesburg, South Africa` | resolved `-26.1090427, 28.0524052` |
| Nominatim `4 Nebula Rd, Brakpan` (the inspiration's own depot) | **0 results** |
| Seeded job addresses (`10 Industrial Ring, Zone 1`, …) | fictional; only their coordinates are real — they will not geocode |

Two consequences: the map and the route line work today, and **geocoding is limited by address
quality, not by code** — which is exactly why the inspiration needs the 4-tier strategy and the
`NoCoordinates` bucket.

---

## Current status (2026-11-12)

| Phase | State | Notes |
|---|---|---|
| **1 — Trip sheet core** | Mostly done | `TripSheets` / `TripSheetItems` tables, `TripSheetDAL` + `TripSheetService`, `TripSheetHub`, `DispatchBoardPage`. Create / add / remove / reorder / depart / return / complete / cancel / delete all work in the service layer; **the HTTP write endpoints and response DTOs are missing**, so the board's write calls 404 (slice B2) |
| **2 — Print** | Partial | Manifest modal + `window.print()` exist; the `@media print` rules hide the wrong elements, so the printed page still includes app chrome (slice B3) |
| **3 — Sequencing** | Not started | Slice R1 below |
| **4 — Routing** | Not started | Slice R2 below |
| **5 — Geocoding** | Not started | Slice R3 below |

Already live and reused by this work: Leaflet + `react-leaflet` (`components/ui/DriverMap.tsx`), job
coordinates (`Job.PickupLat/Lng`, `Job.DropoffLat/Lng`), Upstash Redis (dashboard summary; reused for
route and geocode caches), `TripSheetHub` (slice B4 starts broadcasting to it), and the derived
dispatch queue — `Job.Status == Pending && Job.TripSheetId == null`. The `DispatchPlan` column this
plan originally proposed was removed in `20261111112628_DropJobDispatchPlan`; it is not coming back.

On 2026-11-12 the driver map's dashed straight-line polyline was **removed**: it connected pickup,
dropoff, pickup, dropoff in API order, so it zigzagged across unrelated stops and read as a route that
did not exist. Nothing draws a line again until R2 draws a real one.

---

## Decisions (locked)

| Decision | Choice | Rationale |
|---|---|---|
| **Queue model** | Derived (`Status == Pending && TripSheetId == null`) | No status column to drift; already shipped |
| **Coordinates** | On `Job` (`Pickup*`, `Dropoff*`) | DispatchTrack has no `Customer` entity; jobs already carry both endpoints |
| **Route geometry** | Browser → `GET /api/tripsheets/{id}/route`; that endpoint calls public OSRM once per unique stop order and caches the response in Redis (24 h, keyed by the stop-set hash) | Render free tier (512 MB) cannot host OSRM beside the API (see the memory probe above), and a page load draws no route, so upstream calls are rare. The server-side hop keeps one `User-Agent`, one rate limit and one cache |
| **OSRM failure** | Draw the dashed straight line, logged | Matches the inspiration: the dash means "could not resolve", it is never the default |
| **Depot** | Config/env `RoutePlanning__DepotLat` / `__DepotLng` / `__DepotAddress` | No settings table for three values |
| **Sequencing** | Nearest-neighbour from the depot on haversine distance | Pure C#, deterministic, unit-testable, no network |
| **Clustering** | Greedy seed-based, 15 km default, radius configurable per request | Same behaviour as the inspiration, ~40 lines |
| **Geocoding** | Nominatim, 4-tier strategy, SA bounding box, wrong-area guard, 1.1 s spacing, Redis cache 30 days | The guards are what make results usable on South African addresses |
| **Geocode trigger** | Explicit button / endpoint | Render free tier sleeps; a nightly hosted service on a sleeping container is theatre |
| **Sessions (90-day TTL), `RoutePlanningHub`, background geocoder, Google Maps variant, non-ticket stops** | **Cut** | Trip sheets already persist; the existing `TripSheetHub` suffices; nobody asked for the rest |

---

## Slices

Sizes are estimates for one focused session each. Order matters: R1 and R2 ride on B2's write path.

### R1 — Stop sequencing (~2 h)

- `POST /api/tripsheets/{id}/optimize` — Admin, Dispatcher. Orders the sheet's stops
  nearest-neighbour from the depot, writes `StopNumber`, returns the sheet DTO.
- Optional `POST /api/tripsheets/cluster` — greedy groups of queued jobs within a radius, nearest-
  neighbour order per group. Read-only preview; no schema change.
- `DriverMap` markers show their stop number; hover/popup shows the address as today.
- Test: known coordinates → expected order, plus a tie/duplicate-coordinate case.

### R2 — Route geometry (~2 h)

- `GET /api/tripsheets/{id}/route` — ordered stop coordinates (depot first), Redis cache
  `route:tripsheet:{id}:{stopsHash}` for 24 h, upstream timeout 6 s.
- Response: `{ distanceMeters, durationSeconds, source: "osrm" | "none", geometry: [[lat,lng],…] }`.
  `source: "none"` on any failure — the client draws the dashed fallback.
- Board manifest modal gets **Check Route**: solid line when OSRM answers, dashed when it does not.
- Never called on page load; only on the button.

### R3 — Geocoding (~4 h)

- `GeocodingService` — the 4-tier Nominatim strategy, `User-Agent`, 1.1 s spacing, SA bounding box
  `lat -35..-22, lon 16..33`, wrong-area guard, Redis cache 30 days.
- `POST /api/jobs/{id}/geocode` (Admin, Dispatcher) and a bulk `POST /api/jobs/geocode-missing`.
- Admin page: one table of jobs whose addresses have no coordinates, with per-row Geocode and
  Geocode All.
- Seed data gains a few real addresses so the feature is demoable, or the table honestly shows the
  fictional ones as unresolved.

### R4 — Planning page (~5 h, optional)

- `/route-planning` — map plus the pending queue, auto-group, per-group route check, then create trip
  sheets from the groups through B2's endpoints.
- Lowest value of the four: the board plus `DriverMap` already demonstrate the capability.

---

## Data model

As shipped in `20261109131304_Phase1_TripSheet_Core` (PostgreSQL, quoted PascalCase):

| Table | Notes |
|---|---|
| `"TripSheets"` | `TripSheetId bigint identity`, `TripNumber` (≤ 50, unique), `Status` **int** (0 Created, 1 InProgress, 2 Returned, 3 Complete, 4 Cancelled — not an enum), `DispatchDestinationCategory` (≤ 50), `DriverId`, `DriverName`, `CreatedByUserId`, timestamps, unused `byte[]? Version` (slice B5 maps it to `xmin`) |
| `"TripSheetItems"` | `TripSheetItemId`, `TripSheetId`, `JobId`, `StopNumber`, unused `NonCustomerDestinationId` / `NonTicketCustomerId` / `NonTicketDescription` (non-ticket stops are cut, the columns already exist), unused `byte[]? Version` |
| `"Jobs"` | `TripSheetId bigint null` → the queue; `PickupLat/Lng`, `DropoffLat/Lng` for routing |

**No new tables are required for R1–R4.** The inspiration's `RoutePlanningSession`,
`RoutePlanningSessionStop`, `GeocodeAuditLog`, `Customer.Latitude/Longitude` and settings rows are
not needed: trip sheets persist the grouping, jobs already carry coordinates, and geocode results are
cached in Redis.

### Candidate schema change (only if R3 needs an audit trail)

```sql
-- PostgreSQL dialect; only if "why did this address not geocode" has to be answerable later
CREATE TABLE "GeocodeAttempts" (
    "GeocodeAttemptId" bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    "Address"          character varying(500) NOT NULL,
    "Outcome"          character varying(32)  NOT NULL,  -- Success | NoMatch | OutOfBounds | RateLimited
    "Latitude"         double precision NULL,
    "Longitude"        double precision NULL,
    "AttemptedAt"      timestamp with time zone NOT NULL
);
CREATE INDEX "IX_GeocodeAttempts_Address" ON "GeocodeAttempts" ("Address");
```

---

## Infrastructure

| Component | Dev | Production |
|---|---|---|
| **OSRM** | Public `router.project-osrm.org` | Same, cached server-side. Self-host only if the demo server starts refusing requests (needs a paid plan or a second service) |
| **Nominatim** | Public + Redis cache, 1.1 s spacing | Same |
| **Map tiles** | OSM | OSM |
| **Cache** | Upstash Redis (or in-memory when unset) | Upstash Redis |
| **Settings** | `RoutePlanning__DepotLat`, `__DepotLng`, `__DepotAddress` | Render env vars |

---

## Risks

| Risk | Mitigation |
|---|---|
| Public OSRM rate limits or disappears | 24 h Redis cache, on-demand calls only, `source: "none"` + dashed fallback, self-host documented as the upgrade path. CORS is open (`*`) if the proxy ever has to become a direct browser call |
| Nominatim 429 | 1.1 s spacing, 30-day cache, one address per explicit action, no bulk loops on page load |
| Fictional seed addresses never geocode | Say so in the README; add a few real addresses to the seeder |
| Leaflet bundle weight | Route planning page lazy-loaded (`React.lazy`) if R4 happens; the driver map is already in the main chunk |
| Route geometry drifting from stop order | Cache key includes a hash of the ordered stop set, so any reorder invalidates it |

---

## Next steps

1. **B2** — trip-sheet write endpoints + DTOs, role gates, driver ownership, `changedByUserId` from the JWT (prerequisite for R1/R2).
2. **B3** — board wiring, print CSS, real `createdByUserId`.
3. **R1 → R2** — sequencing, then the real route line in the board.
4. **B4** — trip-sheet SignalR broadcasts; **B5** — `xmin`; **B6** — workflow and HTTP tests.
5. **R3** — geocoding; **R4** — planning page, only if it still earns its place.

`docs/WORK_LOG.md` carries the live defect list and the slice status.
