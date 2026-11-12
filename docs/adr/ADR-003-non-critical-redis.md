# ADR 003: Non-Critical Redis Cache with Database Fallback

## Status
Accepted

## Context
The Dashboard summary endpoint (`GET /api/dashboard/summary`) aggregates job/driver counts across the full dataset. On a free-tier serverless PostgreSQL (Neon), frequent aggregation queries:
- Consume compute seconds (Neon free tier has monthly limits)
- Add latency (~50-200ms per query)
- Wake suspended compute (adds ~500ms cold start)

A Redis cache (Upstash free tier: 256 MB, ~500K commands/mo) can serve the dashboard in <5ms. However:
- Redis is an **additional dependency** that can fail
- Free-tier Redis has limits (commands, storage)
- Health checks pinging Redis would keep DB awake, burning quota

## Decision
**Cache is non-critical.** The dashboard endpoint:
1. **Tries Redis first** (`IDistributedCache.GetStringAsync`)
2. **On any failure** (timeout, connection error, key missing) → **falls back to DB** transparently
3. **Writes to Redis** on successful DB query, errors logged only
4. **TTL: 60 seconds** — balances freshness with command quota
5. **`/health` endpoint NEVER calls Redis** — only returns `{ status: "Healthy", timestamp }`

**Configuration:**
- `ConnectionStrings__Redis` set → use `StackExchangeRedis` (Upstash TLS)
- Empty/unset → use `AddDistributedMemoryCache()` (local dev)

**Cache Key:** `dashboard:summary` (single key; there is **no** `RemoveAsync` invalidation — the client
refetches when SignalR delivers a job event, and the key otherwise expires after 60s)

## Consequences

### Positive
- **Dashboard stays fast** (<5ms cached vs ~100ms DB)
- **Neon compute stays cold** between refreshes — the frontend does not poll, it refetches on SignalR events
- **Zero downtime on Redis failure** — DB fallback is automatic
- **Free tier friendly** — fewer Redis commands than a polling client would issue
- **Local dev works without Redis** — in-memory cache

### Trade-offs
- **Stale data possible** (up to 60s) — acceptable for dashboard counts; a mutation-triggered refetch can still read a summary that is seconds old
- **No explicit invalidation** — a missed or delayed SignalR event shows stale counts until the TTL expires
- **Two code paths** — slightly more complex than "always DB"

## Implementation References
- `DispatchTrack.API/Program.cs` — DI registration (Redis vs MemoryCache)
- `DispatchTrack.API/Controllers/DashboardController.cs` — cache-aside pattern **and** aggregation logic (there is no `DashboardService`)
- `frontend/src/pages/DashboardPage.tsx` — `refetchInterval: false`, refetch driven by SignalR

## Alternatives Considered
| Option | Rejected Because |
|--------|------------------|
| Always query DB | Burns Neon compute seconds; slower UX |
| Redis required (no fallback) | Redis failure breaks dashboard; Upstash free tier has no SLA |
| Longer TTL (5min) | Stale counts confusing for dispatchers |
| Materialized view in DB | Postgres doesn't auto-refresh; triggers add write overhead |

---

*Recorded: 2026-10-23 | Related: ADR-001 (DB), ADR-002 (Auth), ADR-004 (Container)*