# ADR 001: Database Selection (PostgreSQL via Neon)

## Status
Accepted

## Context
DispatchTrack requires a relational database for core domain entities (Users, Drivers, Jobs, StatusHistory, RefreshTokens).
- The hosting strategy requires 100% free-tier services.
- The user's Azure Student Subscription allows only 1 free project, which is already consumed by another project (SmartGear).
- Azure SQL free offer also presents operational hurdles:
  - Strict firewall IP rules that conflict with Render's dynamic outbound IP addresses.
  - Auto-pause delays (15–30s resume) and monthly vCore-second quotas that risk being consumed by health pingers or idle wakes.
  - Local Docker development with Microsoft SQL Server requires ~2 GB of memory, adding unnecessary resource overhead.

## Decision
We select **PostgreSQL** hosted on **Neon Serverless Postgres** for production and **`postgres:16-alpine`** for local containerized development.

### Provider Details
- **EF Core Provider:** `Npgsql.EntityFrameworkCore.PostgreSQL`
- **Hosting Platform:** Neon Free Tier (0.5 GB storage, serverless compute with scale-to-zero in 5 min, wakes in ~500ms).
- **Concurrency Strategy:** PostgreSQL `xmin` system column via EF Core's `.UseXminAsConcurrencyToken()`.

## Consequences
- **Positive:**
  - Bypasses Azure student account project limits entirely.
  - Connects reliably via TLS without IP whitelisting issues from Render.
  - Compute auto-suspends to zero when idle, preserving free quotas.
  - Local `docker-compose` PostgreSQL container requires < 50 MB RAM (vs. 2 GB for SQL Server).
- **Trade-offs:**
  - Migrating existing EF Core models from `Microsoft.EntityFrameworkCore.SqlServer` to `Npgsql.EntityFrameworkCore.PostgreSQL`.
  - Re-generating the initial migration to target PostgreSQL types.
