# SunRey deployable preview

This deployment runs the existing canonical Consumer BFF as the application-facing backend for Lovable/mobile/web integration. It remains a **simulation preview**. It does not activate production financial connectivity, real customer funds, live banking/payment/FX/card rails, or mainnet production.

## Canonical frontend API

- Base path: `/api/v1`
- OpenAPI: `api/sunrey-consumer-bff-v1.openapi.yaml`
- Health: `GET /health`
- Readiness: `GET /ready`

The frontend must render server state and must not calculate authoritative balances, FX prices, investment returns, token supply, or regulated eligibility locally.

## Runtime environment

Required for a hosted preview:

```text
ENVIRONMENT=simulation
SUNREY_API_HOST=0.0.0.0
SUNREY_API_PORT=8443
SUNREY_API_ALLOWED_ORIGINS=https://<lovable-preview-host>,https://<sunrey-web-host>
SUNREY_PREVIEW_SANDBOX_PERSONAS=true
SUNREY_PREVIEW_AUTH_ENABLED=true
SUNREY_PREVIEW_AUTH_EMAIL=preview@sunrey.xyz
SUNREY_PREVIEW_AUTH_PASSWORD=<secret-at-least-12-characters>
```

`SUNREY_PREVIEW_SANDBOX_PERSONAS=true` is for non-production frontend integration only. When it is false or omitted, `/api/v1/sandbox/personas` returns 404.

`SUNREY_PREVIEW_AUTH_ENABLED=true` enables the simulation-only login bridge. The password must be supplied through the deployment environment or secret manager; never commit it to the repository. When preview auth is disabled, `/api/v1/auth/preview/session` returns 404.

Do not set wildcard CORS. Give `SUNREY_API_ALLOWED_ORIGINS` the exact frontend origins.

## Preview authentication

The Lovable/mobile preview can authenticate through:

```text
POST /api/v1/auth/preview/session
GET  /api/v1/auth/session
POST /api/v1/auth/logout
```

Login body:

```json
{
  "email": "preview@sunrey.xyz",
  "password": "<configured-preview-password>",
  "personaId": "basic_verified"
}
```

A successful login returns a short-lived simulation Identity session token. Send that token on authenticated requests as:

```text
Authorization: Bearer <token>
```

The session is issued by the existing SunRey Identity service and can be revoked through `/api/v1/auth/logout`. It is not a production authentication mechanism and must not be enabled on a live-money deployment.

## Local run

```bash
SUNREY_PREVIEW_SANDBOX_PERSONAS=true \
SUNREY_PREVIEW_AUTH_ENABLED=true \
SUNREY_PREVIEW_AUTH_EMAIL=preview@sunrey.xyz \
SUNREY_PREVIEW_AUTH_PASSWORD=local-preview-password-123 \
SUNREY_API_ALLOWED_ORIGINS=http://localhost:5173 \
npm --workspace services/api run start:preview
```

The default preview entrypoint binds to port `8443` when no platform `PORT` is supplied.

## Container

Build from the repository root:

```bash
docker build \
  -f deploy/sunrey-preproduction/docker/sunrey-platform.Dockerfile \
  -t sunrey-preview:local .
```

Run:

```bash
docker run --rm -p 8443:8443 \
  -e SUNREY_PREVIEW_SANDBOX_PERSONAS=true \
  -e SUNREY_PREVIEW_AUTH_ENABLED=true \
  -e SUNREY_PREVIEW_AUTH_EMAIL=preview@sunrey.xyz \
  -e SUNREY_PREVIEW_AUTH_PASSWORD=local-preview-password-123 \
  -e SUNREY_API_ALLOWED_ORIGINS=https://<lovable-preview-host> \
  sunrey-preview:local
```

The container healthcheck calls `http://127.0.0.1:8443/health`.

## Lovable integration

Set the frontend environment variable to the deployed backend origin:

```text
VITE_SUNREY_API_BASE_URL=https://api.sunrey.xyz
```

The intended preview flow is:

1. POST credentials to `/api/v1/auth/preview/session`.
2. Store the returned token in the client session layer.
3. Call `/api/v1/me/bootstrap` with the bearer token.
4. Use the canonical API routes for Home, accounts, payments, FX, cards, Grow, Agent, Exchange, wallets, HIN/data, and economy surfaces.
5. If the API returns `AUTH_REQUIRED` or `SESSION_INVALID`, clear the client session and route to Login.
6. POST `/api/v1/auth/logout` before clearing a valid client session.

## Deployment acceptance

Before connecting Lovable to a hosted preview, verify:

1. `/health` and `/ready` return HTTP 200 and still report production/live connectivity as false.
2. An allowed frontend origin succeeds and an unknown origin receives HTTP 403.
3. Preview login returns a revocable Identity session and invalid credentials return HTTP 401.
4. An authenticated session can load `/api/v1/me/bootstrap` and `/api/v1/me/home`.
5. Logout invalidates the issued session and subsequent protected requests return HTTP 401.
6. Unauthorized financial endpoints fail closed.
7. Payment/FX/Grow/Agent/Exchange/wallet/economy flows remain server-owned and simulation-only.
8. CI, architecture, production-safety, API, and security gates are green.
