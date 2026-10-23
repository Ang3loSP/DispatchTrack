# DispatchTrack - Single-Container Multi-Stage Build
# Stage 1: Build frontend with Node/Vite
# Stage 2: Build & publish ASP.NET Core API
# Stage 3: Runtime - copy frontend dist to wwwroot, run API

# =============================================================================
# STAGE 1: Frontend Build
# =============================================================================
FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend

# Install dependencies (cache layer)
COPY frontend/package*.json ./
RUN npm ci --prefer-offline --no-audit --no-fund

# Build frontend
COPY frontend/ ./
RUN npm run build

# =============================================================================
# STAGE 2: Backend Build & Publish
# =============================================================================
FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS backend-build
WORKDIR /app

# Restore NuGet packages (cache layer)
COPY DispatchTrack.API/DispatchTrack.API.csproj DispatchTrack.API/
COPY DispatchTrack.API.Tests/DispatchTrack.API.Tests.csproj DispatchTrack.API.Tests/
RUN dotnet restore DispatchTrack.API/DispatchTrack.API.csproj

# Copy source and publish
COPY DispatchTrack.API/ DispatchTrack.API/
RUN dotnet publish DispatchTrack.API/DispatchTrack.API.csproj \
    -c Release -o /app/publish \
    --no-restore \
    -p:PublishSingleFile=false \
    -p:PublishTrimmed=false

# =============================================================================
# STAGE 3: Runtime
# =============================================================================
FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine AS runtime
WORKDIR /app

# Install curl for health checks (optional but useful)
RUN apk add --no-cache curl

# Create non-root user
RUN addgroup -g 1000 -S appgroup && \
    adduser -u 1000 -S appuser -G appgroup

# Copy published API
COPY --from=backend-build /app/publish ./

# Copy frontend build output to wwwroot (served as SPA fallback)
COPY --from=frontend-build /app/frontend/dist ./wwwroot

# Fix permissions
RUN chown -R appuser:appgroup /app
USER appuser

# Environment
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production

# Health check (no dependency calls - per architecture)
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

EXPOSE 8080

ENTRYPOINT ["dotnet", "DispatchTrack.API.dll"]