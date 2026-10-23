# ADR 002: JWT Access Tokens + HttpOnly Rotating Refresh Tokens

## Status
Accepted

## Context
DispatchTrack needs stateless authentication for a React SPA backed by ASP.NET Core. Requirements:
- Short-lived access tokens (minimize blast radius if leaked)
- Secure refresh mechanism (no localStorage exposure)
- Token rotation (detect replay attacks)
- Revocation on logout
- Works with same-origin cookies (no CORS preflight complexity)

## Decision
**Access Token:** JWT, 15-minute expiry, signed with HS256 (32+ char secret), claims: `sub` (user ID), `role`, `email`. Sent as `Authorization: Bearer <token>`.

**Refresh Token:** Cryptographically random opaque value (256-bit), 7-day expiry, **stored hashed (SHA-256)** in database. Sent as **httpOnly + Secure + SameSite=Strict cookie** (`refreshToken`).

**Rotation:** On every `/api/auth/refresh`:
1. Validate cookie → hash → lookup in DB
2. If revoked/expired/missing → 401, delete cookie
3. If **already revoked** (replay detected) → revoke **all** user's tokens, 401
4. Otherwise: revoke old, issue new access + refresh pair, set new cookie

**Logout:** Revokes current refresh token in DB, deletes cookie.

**Rate Limiting:** Fixed window (10 req/min per IP) on `/login` and `/refresh` — **enforced only outside Development** so local dev/tests unaffected.

## Consequences

### Positive
- **No tokens in localStorage** — immune to XSS token theft
- **Rotation detects replay** — stolen refresh token usable once
- **Revocation works** — logout + replay detection invalidate server-side
- **Short access tokens** — limited damage window
- **SameSite=Strict** — CSRF protection on refresh endpoint
- **HttpOnly** — JavaScript cannot read refresh token

### Trade-offs
- **Cookie dependency** — requires same-origin or proper CORS with credentials (handled via Vite proxy in dev, single-origin in prod)
- **DB lookup on every refresh** — acceptable (7-day TTL, low volume)
- **Clock skew** — `ClockSkew = TimeSpan.Zero` on JWT validation; servers must sync via NTP
- **No sliding window on access token** — deliberate; forces refresh flow

## Implementation References
- `DispatchTrack.API/Services/TokenService.cs` — token generation, hashing
- `DispatchTrack.API/Controllers/AuthController.cs` — login, refresh, logout, me
- `frontend/src/api/client.ts` — axios 401 interceptor with refresh queue
- `frontend/src/context/AuthContext.tsx` — in-memory access token, session hydration

## Alternatives Considered
| Option | Rejected Because |
|--------|------------------|
| Access token only (no refresh) | Poor UX — frequent re-login |
| Refresh token in localStorage | XSS steals both tokens |
| Long-lived JWT (no refresh) | Large blast radius if leaked |
| Refresh token rotation without replay detection | Stolen token usable until expiry |
| Sliding expiration on access token | Masks token leakage; complicates revocation |
| Reference tokens (opaque access tokens) | Adds DB lookup to every request; JWT is standard |

---

*Recorded: 2026-10-23 | Related: ADR-001 (DB), ADR-003 (Redis), ADR-004 (Container)*