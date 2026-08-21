# Phase B Prompt 1 — Production API runtime and gateway foundation

This document records the first Phase B productization prompt. It does
not activate production.

`CORE_CODE_COMPLETE_CANDIDATE=true`
`PRODUCTION_READY=false`
`PRODUCTION_ACTIVE=false`
`LIVE_CONNECTIVITY_ENABLED=false`
`production_authorized=false`

## Architecture

```
LOVABLE / CLIENT APPLICATIONS
        |
        v
SUNREY PLATFORM API  (services/api, /api/v1)
        |
        v
AUTHENTICATION → REQUEST CONTEXT → AUTHORIZATION
        |
        v
KERNEL / COMPLIANCE → EXECUTION AUTHORITY   (later prompts)
        |
        v
CANONICAL SUNREY DOMAIN SERVICES
```

The Platform API is the approved application entry. It orchestrates
existing owners. It is not a second ledger, Kernel, Execution
Authority, Agent runtime, or Exchange.

The existing `packages/sunrey-sdk` `/v1` gateway remains the
developer/simulation surface over `DevelopmentPlatform`. It is
unsuitable as the product BFF because it mutates in-memory fixture
state and is not Kernel-gated.

`apps/api` stays reserved and empty. The reserved bounded context is
`API_INTEGRATION` at `services/api`.

## Chosen runtime / framework

**Node.js `http.createServer`**, with an internal router and
middleware pipeline in `services/api`.

Why:

- The repository already uses Node HTTP for the SDK gateway and
  explorer. There is no Express, Fastify, Hono, or Koa dependency.
- The existing SDK server is the wrong *product* owner, not a
  missing HTTP stack. Introducing a second framework would create a
  competing API runtime.
- The Platform API therefore extends the existing transport
  convention and replaces the product entry, not the HTTP library.

## Route organization

Canonical application namespace: `/api/v1/`.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Process liveness |
| `GET` | `/ready` | Dependency readiness |
| `GET` | `/api/v1/version` | Version and production flags |
| `GET` | `/api/v1/me` | Authenticated placeholder; 401 until a validated session exists |
| `POST` | `/api/v1/_test/*` | Development/test only; forbidden on staging/production |

Reserved future namespaces (not implemented here):

`/api/v1/auth`, `/me`, `/accounts`, `/payments`, `/fx`, `/cards`,
`/grow`, `/agents`, `/exchange`, `/wallets`, `/assets`, `/data`.

Unknown `/api/vN/` prefixes return `UNKNOWN_API_VERSION`.

## Middleware order

1. Accepting / shutdown gate
2. CORS preflight
3. API version guard
4. Authentication (validated principal only; client identity headers are ignored)
5. Request context
6. Origin policy
7. Rate limit
8. Content-type and body limits
9. Schema validation
10. Idempotency (mutation routes that opt in)
11. Handler
12. Structured access log
13. Canonical error envelope

## Request context

Every request receives an internal `RequestContext`:

`requestId`, `correlationId`, `timestamp`, `environment`,
`deploymentTier`, `apiVersion`, `route`, `method`, `userId`,
`sessionId`, `deviceId`, `jurisdiction`, `clientId`, security
metadata, authorization context.

Privileged identity is derived only from a server-side
`Authenticator`. The default authenticator returns no principal.
`X-User-Id` and similar headers are not trusted.

## Error format

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "request validation failed",
    "requestId": "…",
    "category": "VALIDATION",
    "retryable": false,
    "fieldErrors": [{ "field": "name", "code": "REQUIRED", "message": "is required" }],
    "metadata": {}
  }
}
```

Categories: `VALIDATION`, `AUTHENTICATION`, `AUTHORIZATION`,
`COMPLIANCE`, `POLICY`, `CONFLICT`, `NOT_FOUND`, `RATE_LIMIT`,
`PROVIDER`, `TEMPORARY_UNAVAILABLE`, `INTERNAL`.

Stack traces and compliance reasoning are not returned to clients.

## Idempotency

Interface: `IdempotencyRepository`.

Intended production implementation: `PostgresIdempotencyRepository`
against `platform_api.idempotency_record` (customer DB migration
`V031__platform_api.sql`).

Scope = authenticated identity or anonymous client/IP + route.
Fingerprint = SHA-256 of method, path, and body. Same key + same
fingerprint replays. Same key + different fingerprint is
`IDEMPOTENCY_CONFLICT`. Concurrent in-progress requests return
`CONFLICT`. Records expire.

`MemoryIdempotencyRepository` is test/local only
(`productionIntended=false`). Staging/production config requires
`postgres`.

This is HTTP-request idempotency. Chunk 155
(`packages/events` operation execution) remains the distributed
side-effect recovery owner. Do not create
`packages/idempotency-service`.

## Rate limiting

Extensible policies by `ip`, `user`, `session`, `device`, `client`,
and `endpointClass`. Sensitive routes can take a tighter policy.
Default store is in-process; PostgreSQL adapter is available.

## Logging

JSON lines with `requestId`, `correlationId`, `route`, `method`,
`status`, `latencyMs`, `service`, `environment`.

Redaction covers passwords, access/refresh tokens, private keys,
card data, and KYC-style identifiers. Values that look like bearer
tokens or PEM keys are redacted even when the key name is generic.

## Configuration

`validatePlatformApiConfig` / `SUNREY_API_*` environment variables:

environment, port, API base path, allowed origins, logging, rate
limits, idempotency, auth placeholder, database configured,
feature flags.

Startup fails closed on invalid production-tier configuration.
Provider credentials are not required.

A deployment tier of `production` only tightens validation. It does
not set `PRODUCTION_ACTIVE`.

## Health and readiness

`GET /health` — process is alive. Never claims production readiness.

`GET /ready` — configuration validity plus optional persistence /
internal-service probes. A live process with a down required
dependency is not ready. `productionReady` is always `false`.

## Security boundaries

- Content-type enforcement on mutations
- Body size and request timeouts
- Security headers (`nosniff`, `DENY`, `no-store`, CSP none)
- Configurable CORS; no wildcard on staging/production
- Handlers do not import Ledger internals or construct
  `AuthorityIssuer`
- Frontend and AI receive no privileged authority through this
  runtime

## Future BFF integration

Later Phase B prompts should add authenticated `/me`, session
validation against `packages/identity`, and Kernel-gated account /
payment / agent / exchange routes by calling existing services.
They must not grow business logic inside `services/api`.

Lovable and other clients should depend only on this runtime, not
on internal packages.

## Local run

```
npm run sunrey-api
```

Defaults: `127.0.0.1:8787`, `/api/v1`, simulation environment.

```
GET http://127.0.0.1:8787/health
GET http://127.0.0.1:8787/ready
GET http://127.0.0.1:8787/api/v1/version
```

Tests: `node --experimental-strip-types --test services/api/src/*.test.ts`

## Decision record

| Option | Outcome |
| --- | --- |
| Extend SDK `/v1` gateway | Rejected. Wrong mutation authority (`DevelopmentPlatform`). |
| New HTTP framework | Rejected. No existing framework; Node HTTP is the convention. |
| New package `packages/sunrey-api` | Rejected. Constitution reserved `services/api`. |
| Create `services/api` | Accepted. Canonical Platform API runtime. |
