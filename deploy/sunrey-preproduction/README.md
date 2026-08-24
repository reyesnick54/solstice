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
```

`SUNREY_PREVIEW_SANDBOX_PERSONAS=true` is for non-production frontend integration only. When it is false or omitted, `/api/v1/sandbox/personas` returns 404.

Do not set wildcard CORS. Give `SUNREY_API_ALLOWED_ORIGINS` the exact frontend origins.

## Local run

```bash
SUNREY_PREVIEW_SANDBOX_PERSONAS=true \
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
  -e SUNREY_API_ALLOWED_ORIGINS=https://<lovable-preview-host> \
  sunrey-preview:local
```

The container healthcheck calls `http://127.0.0.1:8443/health`.

## Lovable integration

Set the frontend environment variable to the deployed backend origin, for example:

```text
VITE_SUNREY_API_BASE_URL=https://api-preview.sunrey.xyz
```

For preview personas, request `GET /api/v1/sandbox/personas`, select a persona, and send its returned token as:

```text
Authorization: Bearer <token>
```

Then bootstrap the application from `GET /api/v1/me/bootstrap` and use the canonical OpenAPI routes for Home, accounts, payments, FX, cards, Grow, Agent, Exchange, wallets, HIN/data, and economy surfaces.

## Deployment acceptance

Before connecting Lovable to a hosted preview, verify:

1. `/health` and `/ready` return HTTP 200 and still report production/live connectivity as false.
2. An allowed frontend origin succeeds and an unknown origin receives HTTP 403.
3. An authenticated sandbox persona can load `/api/v1/me/bootstrap` and `/api/v1/me/home`.
4. Unauthorized financial endpoints fail closed.
5. Payment/FX/Grow/Agent/Exchange/wallet/economy flows remain server-owned and simulation-only.
6. CI, architecture, production-safety, API, and security gates are green.
