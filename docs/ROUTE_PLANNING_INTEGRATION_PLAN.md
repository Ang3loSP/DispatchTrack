# Route Planning System — Integration Plan (Final)

## Overview
Integrate the route planning system (from `dispatch route planning/current source`) into DispatchTrack main codebase using **phased, free-tier approach**.

**Source features:** Auto-clustering (15km radius + depot ordering), manual stop editing, OSRM road routing, Nominatim geocoding, background geocoding, session persistence, TripSheet creation with workflow sync.

---

## Decisions (Locked)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Integration approach** | **Phased** (4 phases) | Ships value early; defers complexity |
| **OSRM Hosting** | Public demo dev / Docker self-host prod | Free dev; prod on Render or Oracle Cloud Free Tier |
| **Session TTL** | **90 days** + nightly cleanup job | Prevents DB bloat; covers recurring routes |
| **Map Tiles** | **OpenStreetMap** (OSM) | Free, global, no API key |
| **Geocoding** | Public Nominatim + Redis cache (30-day TTL) | 1.1s rate limit; background job pre-warms; local instance deferred |
| **Cost** | **$0** — all free tiers | Portfolio constraint |

---

## Phased Rollout

| Phase | Features | Effort | Deliverable |
|-------|----------|--------|-------------|
| **1** | TripSheet entity, StopNumber, Dispatch Board (queue + open trips), one-click TripSheet creation | ~1 week | Core dispatch workflow |
| **2** | Trip Sheet Detail page, printable manifest, PDF export (wkhtmltopdf) | ~3 days | Driver manifest |
| **3** | Auto-clustering (15km), manual group editing, session persistence (90-day TTL) | ~1 week | Route optimization |
| **4** | OSRM road routing, Nominatim geocoding + cache, background geocoding job | ~1 week | Full route planning |

**Each phase deploys independently.**

---

## 1. Database Schema Migrations

### Phase 1 (TripSheet Core)
```sql
-- TripSheet entity
CREATE TABLE TripSheet (
    TripSheetId BIGINT IDENTITY PRIMARY KEY,
    TripNumber NVARCHAR(50) NOT NULL UNIQUE,
    Status INT NOT NULL DEFAULT 0, -- 0=Created, 1=InProgress, 2=Returned, 3=Complete, 4=Cancelled
    DispatchDestinationCategory NVARCHAR(50) NULL, -- Local/Export/Collection
    DriverId INT NOT NULL, -- FK to Driver
    DriverName NVARCHAR(200) NOT NULL,
    TripStartDateTime DATETIME2 NULL,
    TripEndDateTime DATETIME2 NULL,
    CreatedByUserId INT NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

-- TripSheetItem (stops)
CREATE TABLE TripSheetItem (
    TripSheetItemId BIGINT IDENTITY PRIMARY KEY,
    TripSheetId BIGINT NOT NULL REFERENCES TripSheet(TripSheetId),
    JobId INT NOT NULL, -- FK to Job
    StopNumber INT NOT NULL,
    NonCustomerDestinationId INT NULL, -- FK to Del_NonCustomerDestination
    NonTicketCustomerId INT NULL,
    NonTicketDescription NVARCHAR(500) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

-- Add to Job table
ALTER TABLE Job ADD DispatchPlan INT NOT NULL DEFAULT 0; -- 0=None, 1=Queue, 2=Planned, 3=InProgress/Complete
ALTER TABLE Job ADD TripSheetId BIGINT NULL; -- FK to TripSheet
```

### Phase 3 (Sessions + Geocoding)
```sql
-- Route planning sessions
CREATE TABLE RoutePlanningSession (
    SessionId BIGINT IDENTITY PRIMARY KEY,
    Name NVARCHAR(200) NOT NULL,
    ClusterRadiusKm INT NOT NULL DEFAULT 15,
    DepotLatitude DECIMAL(9,6),
    DepotLongitude DECIMAL(9,6),
    DepotAddress NVARCHAR(500),
    CreatedByUserId INT NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE RoutePlanningSessionStop (
    SessionStopId BIGINT IDENTITY PRIMARY KEY,
    SessionId BIGINT NOT NULL REFERENCES RoutePlanningSession(SessionId),
    JobId INT NOT NULL,
    GroupId INT NOT NULL,
    SortOrder INT NOT NULL,
    DriverId INT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE GeocodeAuditLog (
    LogId BIGINT IDENTITY PRIMARY KEY,
    Address NVARCHAR(500) NOT NULL,
    Status NVARCHAR(50) NOT NULL, -- Success, Failed, RateLimited, Invalid
    Latitude DECIMAL(9,6) NULL,
    Longitude DECIMAL(9,6) NULL,
    ErrorMessage NVARCHAR(1000) NULL,
    AttemptedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

-- Settings (Aspect = 'Dispatch')
-- RoutePlanning_MaxClusterRadiusKm = 15
-- RoutePlanning_DepotLatitude, DepotLongitude, DepotAddress, DepotGeocoded
-- RoutePlanning_MaxDriverRangeKm = 44
```

### Common (All Phases)
```sql
-- Lat/lng on existing entities
ALTER TABLE Customer ADD Latitude DECIMAL(9,6) NULL;
ALTER TABLE Customer ADD Longitude DECIMAL(9,6) NULL;
ALTER TABLE Del_NonCustomerDestination ADD Latitude DECIMAL(9,6) NULL;
ALTER TABLE Del_NonCustomerDestination ADD Longitude DECIMAL(9,6) NULL;

-- Indexes
CREATE INDEX IX_TripSheetItem_TripSheetId ON TripSheetItem(TripSheetId);
CREATE INDEX IX_TripSheetItem_JobId ON TripSheetItem(JobId);
CREATE INDEX IX_RoutePlanningSessionStop_SessionId ON RoutePlanningSessionStop(SessionId);
CREATE INDEX IX_RoutePlanningSessionStop_JobId ON RoutePlanningSessionStop(JobId);
CREATE INDEX IX_GeocodeAuditLog_Address ON GeocodeAuditLog(Address);
CREATE INDEX IX_Customer_LatLng ON Customer(Latitude, Longitude) WHERE Latitude IS NOT NULL;

-- 90-day session cleanup (run nightly via background job)
-- DELETE FROM RoutePlanningSession WHERE UpdatedAt < DATEADD(day, -90, SYSUTCDATETIME());
```

---

## 2. Backend Services (DI in Program.cs)

### Phase 1
| Service | Interface | Lifetime |
|---------|-----------|----------|
| `TripSheetDAL` | `ITripSheetDAL` | Scoped |
| `TripSheetService` | `ITripSheetService` | Scoped |

### Phase 3+
| Service | Interface | Lifetime |
|---------|-----------|----------|
| `RoutePlanningDAL` | `IRoutePlanningDAL` | Scoped |
| `RoutePlanningSessionDAL` | `IRoutePlanningSessionDAL` | Scoped |
| `GeocodingService` | `IGeocodingService` | Scoped |
| `GeocodingBackgroundService` | — | Hosted |
| `RoutePlanningSignalRService` | `IRoutePlanningSignalRService` | Scoped |
| `RoutePlanningCleanupService` | — | Hosted (90-day TTL) |

### Settings
```csharp
builder.Services.Configure<RoutePlanningSettings>(builder.Configuration.GetSection("RoutePlanning"));
// MaxClusterRadiusKm=15, DepotLat/Lng/Address, MaxDriverRangeKm=44, GeocodeRateLimitMs=1100
```

### SignalR Hubs
```csharp
// Phase 1: JobHub, DriverHub (already done)
// Phase 3: RoutePlanningHub at /hubs/routeplanning
// Groups: session-{id}, dispatchers
```

---

## 3. Frontend Components & Pages

### Phase 1
| Component | Purpose |
|-----------|---------|
| `DispatchBoardPage.tsx` | `/dispatchboard` — queue left, open TripSheets right; drag-drop allocate |
| `TripSheetDetailPage.tsx` | `/tripsheet/{id}` — printable manifest with check columns |
| `TripSheetPdf.tsx` | PDF export (wkhtmltopdf via backend endpoint) |

### Phase 3
| Component | Purpose |
|-----------|---------|
| `RouteMap.tsx` | Leaflet + OSRM (colored markers, road routes, depot) |
| `TripGroupList.tsx` | Sidebar: groups, drag-drop, assign driver |
| `GeocodeInput.tsx` | Inline Nominatim search (debounced) |
| `SessionManager.tsx` | Save/load/delete sessions, auto-restore |
| `RoutePlanningPage.tsx` | `/routeplanning` — full planning board |

### Dependencies (Phase 3+)
```json
{
  "leaflet": "^1.9.4",
  "react-leaflet": "^5.0.0-rc.2",
  "@types/leaflet": "^1.9.12"
}
```

---

## 4. SignalR Integration

### Phase 1 (Existing + New)
- `JobHub` — job status, assignment, creation, dispatcher counts
- `DriverHub` — driver location/status
- `TripSheetHub` (`/hubs/tripsheet`) — TripSheet CRUD, group updates

### Phase 3+
- `RoutePlanningHub` (`/hubs/routeplanning`) — session groups, stop moves, route calc

### Client Services
- `signalr.ts` — existing singleton
- `routeplanning.ts` — Phase 3+ (session groups, stop moves)

---

## 5. Workflow Integration

| Event | Action |
|-------|--------|
| TripSheet created | Job `DispatchPlan=2` (Planned), `AssignedDriverId` set |
| TripSheet departed | Job `DispatchPlan=3`, TripSheet `Status=InProgress`, `TripStartDateTime` |
| TripSheet returned | TripSheet `Status=Returned`, `TripEndDateTime` |
| TripSheet completed | TripSheet `Status=Complete`, Job `DispatchPlan=3` |
| TripSheet cancelled | Jobs return to queue (`DispatchPlan=1`), TripSheet `Status=Cancelled` |

---

## 6. Free-Tier Infrastructure

| Component | Dev | Production |
|-----------|-----|------------|
| **OSRM** | Public `router.project-osrm.org` | Docker on Render / Oracle Cloud Free Tier |
| **Nominatim** | Public + Redis cache (1.1s rate limit) | Same (local instance deferred) |
| **Map Tiles** | OSM (`tile.openstreetmap.org`) | OSM |
| **Database** | Neon (PostgreSQL) | Neon |
| **Cache** | Upstash Redis | Upstash Redis |
| **Hosting** | Render Free Tier | Render Free Tier |

---

## 7. Migration & Deployment Strategy

### Phase 1 (Week 1)
1. Migration: `TripSheet`, `TripSheetItem`, `Job.DispatchPlan`, `Job.TripSheetId`
2. Backend: `TripSheetDAL`, `TripSheetService`, `TripSheetHub`
3. Frontend: `DispatchBoardPage`, `TripSheetDetailPage`, PDF endpoint
4. Test locally → CI → Render deploy

### Phase 2 (Week 1-2)
1. PDF export (wkhtmltopdf via backend)
2. Printable manifest UI
2. Deploy

### Phase 3 (Week 2-3)
1. Migrations: Session tables, geocode audit, lat/lng columns
2. Backend: `RoutePlanningDAL`, `SessionDAL`, `GeocodingService`, background jobs
3. Frontend: `RouteMap`, `TripGroupList`, `SessionManager`, `RoutePlanningPage`
4. SignalR: `RoutePlanningHub`
5. Deploy

### Phase 4 (Week 3-4)
1. OSRM integration (public dev, self-host prod)
2. Geocoding cache + background job
3. Driver range guard (straight-line)
4. Deploy

---

## 8. Effort Estimate (Updated)

| Phase | Backend | Frontend | Total |
|-------|---------|----------|-------|
| 1: TripSheet Core | 16h | 16h | 32h |
| 2: Print/PDF | 8h | 8h | 16h |
| 3: Clustering + Sessions | 16h | 20h | 36h |
| 4: Routing + Geocoding | 16h | 12h | 28h |
| **Total** | **56h** | **56h** | **~112h (3-4 weeks)** |

---

## 9. File Inventory (Phased)

### Phase 1 Backend
- `TripSheetDAL.cs` → `Data/DAL/`
- `TripSheetService.cs` → `Services/`
- `TripSheetHub.cs` → `Hubs/`
- `TripSheet.cs`, `TripSheetItem.cs` → `Models/`

### Phase 1 Frontend
- `DispatchBoardPage.tsx` → `pages/`
- `TripSheetDetailPage.tsx` → `pages/`
- `TripSheetPdf.tsx` → `components/routeplanning/`

### Phase 3+ Backend
- `RoutePlanningDAL.cs`, `RoutePlanningSessionDAL.cs` → `Data/DAL/`
- `GeocodingService.cs`, `GeocodingBackgroundService.cs` → `Services/`
- `RoutePlanningHub.cs` → `Hubs/`
- `RoutePlanningCleanupService.cs` → `Services/`

### Phase 3+ Frontend
- `RouteMap.tsx`, `TripGroupList.tsx`, `GeocodeInput.tsx`, `SessionManager.tsx` → `components/routeplanning/`
- `RoutePlanningPage.tsx` → `pages/`
- `routeplanning.ts` → `services/`

---

## 10. Risk Mitigation

| Risk | Mitigation |
|------|------------|
| OSRM public rate limits | Cache routes; self-host Docker for prod |
| Nominatim 429 | 1.1s delay + exponential backoff; Redis cache (30-day TTL) |
| Leaflet SSR hydration | Dynamic import (`React.lazy` + `Suspense`) |
| JS bundle >500KB | Code-split route planning page (`React.lazy`) |
| Migration data loss | Transactional migrations; backup before deploy |

---

## Next Steps

1. **Create branch:** `git checkout -b feature/route-planning-phase1`
2. **Phase 1 DB migration** — `TripSheet`, `TripSheetItem`, `Job.DispatchPlan`
3. **Backend:** `TripSheetDAL`, `TripSheetService`, `TripSheetHub`
4. **Frontend:** `DispatchBoardPage`, `TripSheetDetailPage`
5. **Local test** → CI → Render deploy
6. **Phase 2:** PDF export
7. **Phase 3+:** Per plan above

---

**Angelo — confirm Phase 1 scope and I'll start implementation.**