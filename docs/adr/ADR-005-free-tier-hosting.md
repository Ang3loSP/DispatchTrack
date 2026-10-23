# ADR 005: Free-Tier Hosting Constraints & Trade-offs

## Status
Accepted

## Context
DispatchTrack must deploy and run at **$0/month** to serve as a portfolio project without ongoing costs. This constraint shapes every infrastructure decision.

## Decision
**Host entirely on free tiers with full awareness of limits:**

| Component | Provider | Free Tier Limits | Mitigation |
|-----------|----------|------------------|------------|
| **Container Host** | Render Web Service | 512 MB RAM, 750 hrs/mo, spins down after 15 min idle, ~30-50s cold start | Document cold start; health check keeps warm if pinged (but burns hours) |
| **Database** | Neon Serverless PostgreSQL | 0.5 GB storage, compute auto-suspends to 0 after 5 min idle, wakes in ~500ms | Dashboard uses Redis cache; `/health` never calls DB; migrations at startup only |
| **Cache** | Upstash Redis | 256 MB, ~500K commands/mo, TLS | Non-critical cache (falls back to DB); 30s TTL; health check never calls Redis |
| **Container Registry** | GitHub Container Registry (GHCR) | 500 MB storage, 1 GB/mo bandwidth (public) | Multi-stage build keeps image ~200MB; CI pushes only on main |
| **CI/CD** | GitHub Actions | 2,000 min/mo (private repos) | Cache layers; matrix only when needed; ~5 min per run |
| **Secrets** | Render Env Vars + GitHub Actions Secrets | No Key Vault | Document in `.env.example`; never commit secrets |
| **Monitoring** | Render Logs + `/health` + Uptime Pinger | No Datadog/New Relic | Structured Serilog logs; `/health` no deps; pinger hits `/health` only |

## Consequences

### Positive
- **$0/month forever** — no surprise bills, no credit card required for most
- **Portfolio credibility** — demonstrates cloud-native free-tier architecture
- **Forces good patterns** — caching, statelessness, graceful degradation
- **Reproducible locally** — docker-compose mirrors prod stack (PostgreSQL + Redis)

### Trade-offs (Documented Honestly)
| Limitation | Impact | Disclosure |
|------------|--------|------------|
| **Cold starts** | 30-50s first request after 15 min idle | Stated in README, live demo link |
| **No custom domain SSL** (Render free) | Uses `*.onrender.com` | Acceptable for portfolio |
| **Neon compute suspends** | First query after idle ~500ms | Dashboard cached; jobs API hits DB directly |
| **Upstash command limit** | 500K/mo = ~16K/day | 30s TTL + 10s poll = 8.6K/day; headroom |
| **Render 750 hrs/mo** | ~31 days if always on | Spins down after 15 min; 750 hrs covers typical usage |
| **No managed Key Vault** | Secrets in env vars | `.env.example` documents all; never committed |
| **Shared Neon DB for tests** | Test parallelization disabled | Phase 8: Testcontainers for isolation |

## Configuration Management

**Local Development:** `.env` file (gitignored) → `docker-compose.yml` injects into containers

**CI (GitHub Actions):** Repository secrets → injected at runtime

**Production (Render):** Dashboard → Environment Variables → same names as `.env.example`

**Required Secrets (never in git):**
- `ConnectionStrings__Default` (Neon connection string)
- `Jwt__Secret` (32+ chars, `openssl rand -base64 32`)
- `ConnectionStrings__Redis` (Upstash TLS URL)
- `RENDER_DEPLOY_HOOK` (GitHub Actions secret for deploy workflow)

## Health Check Strategy

**`GET /health` returns:**
```json
{ "status": "Healthy", "timestamp": "2026-10-23T12:00:00Z" }
```

**Critical rules:**
- **NO database calls** — would wake Neon compute
- **NO Redis calls** — would burn Upstash commands
- **NO external calls** — self-contained
- Render health check + uptime pinger both hit this endpoint

## Alternatives Considered

| Option | Rejected Because |
|--------|------------------|
| Azure (student subscription) | 1 project limit already used by SmartGear; SQL firewall issues |
| Railway / Fly.io / Koyeb | Free tiers deprecated or time-limited; Render most stable |
| Self-hosted VPS | Not free; requires maintenance |
| Supabase (PostgreSQL + Auth) | Auth tightly coupled; want to demonstrate JWT implementation |
| Firebase / AppWrite | BaaS hides backend work; portfolio needs to show API skills |
| Kubernetes (any) | Overkill; not free-tier friendly |

## Future Upgrade Path (When Budget Allows)
| Component | Paid Upgrade | Benefit |
|-----------|--------------|---------|
| Render | Starter ($7/mo) | No spin-down, custom domain, more RAM |
| Neon | Scale ($19/mo) | No auto-suspend, more storage, branching |
| Upstash | Pay-as-you-go | Higher limits, multi-region |
| GitHub Actions | Included in Pro | More minutes, self-hosted runners |

---

*Recorded: 2026-10-23 | Related: ADR-001 (DB), ADR-002 (Auth), ADR-003 (Redis), ADR-004 (Container)*