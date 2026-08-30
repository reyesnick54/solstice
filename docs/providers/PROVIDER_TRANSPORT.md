# SunRey Provider Transport

Wave 1 Prompt 3 — universal governed outbound HTTP transport for external
provider adapters.

`ENVIRONMENT=simulation`. No live provider integrations are enabled by this
layer. Adapters remain fixture-first until explicitly certified.

## Purpose

Every future SunRey external provider adapter should route outbound HTTP through
`ProviderTransport` in `packages/provider-sdk` instead of implementing its own
fetch/axios client, retry wrapper, or secret handling.

The transport is vendor-neutral. It does not understand banking, weather,
crypto, or any domain semantics.

## Architecture

```
Provider Adapter
      ↓
ProviderTransport.request(context)
      ↓
ProviderAuthResolver (secret-backed injection)
      ↓
SSRF / network policy (approved base URL only)
      ↓
HTTP request (native fetch, TLS verification always on)
      ↓
Response guard (size, content-type, JSON parse)
      ↓
Provider Adapter (normalization)
```

## Request lifecycle

1. Adapter builds a `ProviderRequestContext` with:
   - `providerId` matching the configured endpoint profile
   - `requestId` and optional `traceId`
   - HTTP `method`, relative `path`, optional `query`, `headers`, `body`
   - optional `timeoutMs`, `expectedContentType`, `maximumResponseBytes`
2. `FetchProviderTransport` validates method, path shape, and provider ID.
3. `ProviderAuthResolver` resolves the configured `ProviderAuthStrategy` and
   returns headers/query parameters. Adapters never read secrets directly.
4. The transport builds an absolute URL from the **approved** `baseUrl` plus the
   relative path. User-supplied absolute URLs are not accepted.
5. SSRF policy validates the destination hostname, port, scheme, and blocks
   loopback, link-local, metadata, and private-network targets unless the
   endpoint profile explicitly allows loopback in `development`/`test`.
6. Standard outbound headers are applied:
   - `User-Agent: SunRey/<service-version>`
   - `X-Request-ID`, `X-Correlation-ID`
   - `Accept`, `Content-Type` when a body is present
7. The transport issues the HTTP request with `redirect: manual`, follows
   redirects up to `maxRedirects`, and re-validates each redirect target.
8. Response size and content-type are checked. JSON is parsed when appropriate.
9. HTTP `4xx`/`5xx` responses map to normalized transport errors. Successful
   responses return `ProviderTransportResponse` metadata for adapter
   normalization.

## Authentication strategies

| Strategy | Injection |
|----------|-----------|
| `none` | No credentials |
| `api_key_header` | Secret reference → header |
| `api_key_query` | Secret reference → query parameter |
| `bearer` | Secret reference → `Authorization: Bearer …` |
| `basic` | Username/password secret references → `Authorization: Basic …` |
| `custom_header` | Secret reference → named header |
| `oauth_access_token` | Adapter-supplied async token hook (no full OAuth flow here) |

Secrets resolve through `SecretProvider` / `SecretReference` from
`packages/security`. Raw credentials never enter adapter configuration.

## Secret redaction

The transport redacts sensitive values before they appear in logs or errors:

- Headers: `Authorization`, `Proxy-Authorization`, `X-API-Key`, `Api-Key`, plus
  catalog-defined names
- Query parameters: `api_key`, `access_token`, `token`, `secret`, `password`,
  plus catalog-defined names

`ProviderTransportError` messages are sanitized. Credential substrings are
replaced with `[REDACTED]`.

## SSRF protection

Outbound requests are allowed only to the configured provider `baseUrl` host,
port, and scheme. The transport blocks:

- `file://`, `ftp://`, and other non-HTTP(S) schemes
- Credentials embedded in URLs
- `localhost`, `127.0.0.0/8`, `::1`
- Link-local and cloud metadata hosts (for example `169.254.169.254`)
- Private IPv4/IPv6 ranges
- Redirect chains that escape the approved destination or exceed `maxRedirects`

HTTPS is required for public provider endpoints. HTTP is permitted only when
`allowHttp: true` on a non-production endpoint profile.

TLS certificate verification is never disabled. `rejectUnauthorized: false` and
equivalent flags are forbidden.

## Error model

| Error kind | Typical cause | Retryable |
|------------|---------------|-----------|
| `ProviderNetworkError` | Connection / transport failure | yes |
| `ProviderTimeoutError` | `timeoutMs` exceeded | yes |
| `ProviderAuthenticationError` | HTTP 401 / 403 | no |
| `ProviderRateLimitError` | HTTP 429 | yes |
| `ProviderClientError` | Other HTTP 4xx | no |
| `ProviderServerError` | HTTP 5xx | yes |
| `ProviderInvalidResponseError` | Malformed JSON / unexpected body | no |
| `ProviderSecurityError` | SSRF, size limit, unsupported content type | no |

Each error includes `providerId`, `requestId`, `httpStatus` when present, and
`retryable`.

## Tracing

Every request carries:

- `provider_id` via `ProviderRequestContext.providerId`
- `request_id` via `X-Request-ID`
- `trace/correlation_id` via `X-Correlation-ID` (defaults to `requestId`)

Response metadata includes duration, HTTP status, content type, and any provider
request ID echoed in response headers.

## Expected adapter usage

```typescript
import {
  createFetchProviderTransport,
  createProviderTransportConfig,
  SecretBackedProviderAuthResolver,
  secretRef,
} from '@solstice/provider-sdk';

const transport = createFetchProviderTransport({
  config: createProviderTransportConfig({
    serviceVersion: '1.0.0',
    environment: 'test',
    endpoint: {
      providerId: 'payments.fixture',
      baseUrl: 'https://api.fixture-payments.test/v1',
    },
  }),
  authResolver: new SecretBackedProviderAuthResolver({ secrets }),
  authStrategy: {
    kind: 'api_key_header',
    headerName: 'X-API-Key',
    secretRef: secretRef('payments', 'api-key'),
  },
});

const result = await transport.request({
  providerId: 'payments.fixture',
  requestId: 'req-123',
  method: 'GET',
  path: '/balances',
});
```

Adapters interpret `result.ok`, normalize provider payloads, and map transport
errors into domain-specific outcomes. They must not call `fetch` directly.

## Environment integration

`createProviderTransportConfig` binds each transport instance to a single
environment (`development`, `test`, `preview`, `production`). Production
profiles reject `allowHttp` and loopback allowances at configuration time so a
development base URL override cannot silently affect production.

## Out of scope (Prompt 4)

This layer intentionally does **not** implement:

- Retries or exponential backoff
- Circuit breakers
- Global rate-limit scheduling
- Caching or persistence
- Provider-specific adapters

Prompt 4 adds reliability controls on top of this transport.

## Package location

Canonical implementation: `packages/provider-sdk`.

Provider runtime orchestration remains in
`packages/sunrey-chain/src/provider-runtime`. Credential binding remains in
`packages/security/src/regulated/credentials`.
