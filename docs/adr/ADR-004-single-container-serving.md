# ADR 004: Single-Container Serving (Node Build → wwwroot)

## Status
Accepted

## Context
DispatchTrack hosts on Render's free tier (one web service, 512 MB RAM, 750 hrs/mo). The frontend (React + Vite) and backend (ASP.NET Core) must be served from a single origin to:
- Avoid CORS complexity
- Use one free Render service
- Share authentication cookies seamlessly
- Simplify deployment (one Docker image, one deploy hook)

## Decision
**Multi-stage Docker build producing a single ASP.NET Core container that serves both the API and the SPA:**

### Stage 1: Frontend Build (Node)
```dockerfile
FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build          # Outputs to /app/frontend/dist
```

### Stage 2: Backend Build & Publish (.NET SDK)
```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS backend-build
WORKDIR /app
COPY DispatchTrack.API/DispatchTrack.API.csproj DispatchTrack.API/
RUN dotnet restore DispatchTrack.API/DispatchTrack.API.csproj
COPY DispatchTrack.API/ DispatchTrack.API/
RUN dotnet publish DispatchTrack.API/DispatchTrack.API.csproj -c Release -o /app/publish
```

### Stage 3: Runtime (ASP.NET Core)
```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine AS runtime
WORKDIR /app
COPY --from=backend-build /app/publish ./
COPY --from=frontend-build /app/frontend/dist ./wwwroot
ENTRYPOINT ["dotnet", "DispatchTrack.API.dll"]
```

**ASP.NET Core Pipeline (Program.cs):**
```csharp
app.UseDefaultFiles();      // Serves wwwroot/index.html for "/"
app.UseStaticFiles();       // Serves wwwroot/assets/*, favicon, etc.
app.MapControllers();       // API routes under /api/*
app.MapFallbackToFile("index.html");  // SPA fallback for client-side routes
```

**Vite Config:** `base: '/'` (default) — assets referenced as `/assets/...` from `wwwroot`.

## Consequences

### Positive
- **Single Render service** — fits free tier (one web service)
- **No CORS** — same origin for API + frontend
- **Cookie auth works** — httpOnly refresh cookie set on same domain
- **One deploy artifact** — one Docker image, one deploy hook
- **SPA routing works** — `MapFallbackToFile` handles client-side routes
- **Static file performance** — ASP.NET Core serves static files efficiently
- **Cache headers** — can add `Cache-Control` via `UseStaticFiles` options

### Trade-offs
- **Larger Docker image** (~200MB vs ~100MB API-only) — still within Render limits
- **Build time** — Node install + Vite build + .NET publish (~60-90s total)
- **Frontend changes require full rebuild** — no hot reload in production (expected)
- **No CDN** — static assets served from Render (free tier has no CDN)
- **Single point of failure** — API down = frontend down (mitigated by health checks)

## Implementation References
- `Dockerfile` — multi-stage build definition
- `DispatchTrack.API/Program.cs` — static files + SPA fallback middleware
- `frontend/vite.config.ts` — `base: '/'` (default), output to `dist/`
- `.github/workflows/ci.yml` — downloads frontend artifact, builds Docker image

## Alternatives Considered
| Option | Rejected Because |
|--------|------------------|
| Separate Render services (Static Site + Web Service) | Two free services; CORS + cookie complexity; two deploy hooks |
| Nginx reverse proxy in container | Adds complexity; ASP.NET Core static files sufficient |
| Vite dev server in production | Not production-ready; no HTTPS; single-threaded |
| CDN (Cloudflare, etc.) for static assets | Free tier complexity; single container simpler for portfolio |
| Embed frontend as embedded resources | Larger assembly; harder to update; no build cache benefit |

---

*Recorded: 2026-10-23 | Related: ADR-001 (DB), ADR-002 (Auth), ADR-003 (Redis), ADR-005 (Hosting)*