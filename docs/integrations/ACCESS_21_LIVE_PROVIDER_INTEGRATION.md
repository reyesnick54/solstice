# ACCESS-21 — Real Provider Sandbox Integration

Classification: engineering simulation on current `main`.

## Mission

ACCESS-21 moves the SunRey Access Provider Network from simulation-only Expedia
adapters toward genuine external-provider sandbox integration while preserving
production safety.

First integrated provider: **Expedia Rapid Lodging v3** (travel / lodging).

## Production posture (unchanged)

```
ENVIRONMENT=simulation
PRODUCTION_READY=false
LIVE_CONNECTIVITY_ENABLED=false
PRODUCTION_ACTIVE=false
LIVE_PROVIDER_CONNECTIVITY=false
```

Credentials alone cannot set `LIVE_ENABLED`. Commercial gates remain unsatisfied.

## Capability states

| State | Expedia |
| --- | --- |
| `SANDBOX_AVAILABLE` | Default on `main` — injected Rapid sandbox transport |
| `CREDENTIALS_REQUIRED` | Returned when API key / shared secret are absent |
| `PRODUCTION_REVIEW_REQUIRED` | Commercial checklist not satisfied |
| `LIVE_DISABLED` | Default until explicit gate approval |
| `LIVE_ENABLED` | Not reachable from credential presence alone |

`SimulationExpediaProvider` remains available via `createExpediaProvider({ preferSimulation: true })`.

## Architecture

```
Consumer BFF (/api/v1/access/*)
  → human-access-economy
  → Access Provider Gateway
    → SandboxExpediaProvider (ACCESS-21)
      → ProviderRuntimeControls (rate limit, circuit breaker, retry, timeout)
      → Injected ExpediaProviderTransport (fixture/scripted sandbox on main)
      → ProviderCredentialPort → regulated secret references
  → Redemption Engine + Funding Router (intents only)
  → Canonical payments / custody / ledger owners
```

Provider response models stop at the adapter boundary. No ledger posting occurs
inside Access.

## Official Expedia Rapid integration

Based on Expedia Group Developer Hub documentation:

- Sandbox host suffix: `test.ean.com`
- Production host suffix: `api.ean.com` (not enabled on `main`)
- Authentication: `EAN APIKey=...,Signature=sha512(apiKey+secret+timestamp),timestamp=...`
- Lodging paths: `/v3/properties/availability`, `/v3/itineraries`, etc.

No unofficial endpoints. No browser scraping. No invented provider URLs in
`packages/access-economy` source (architecture guard).

## Credential security

| Concern | Implementation |
| --- | --- |
| Retrieval | `ProviderCredentialPort` + `EXPEDIA_CREDENTIAL_REFS` |
| Rotation | `rotateExpediaCredentials()` |
| Token refresh hook | `ExpediaTokenRefreshPort` |
| Request signing | `buildExpediaAuthorizationHeader()` |
| Rate limiting | `ProviderRuntimeControls` |
| Circuit breaker | `ProviderRuntimeControls` |
| Retry + idempotency | `ProviderRuntimeControls` + transport idempotency cache |
| Audit | `ProviderAuditPort` (no secrets, no raw payloads) |

## Settlement and FX

- Funding composition remains intent-only via `RedemptionFundingRouter`.
- Fiat, SunRey Coin, and MoonRey Coin intents route to canonical owners.
- FX conversion uses `ProviderFxQuotePort` — injected canonical quotation;
  Access does not hard-code exchange rates.

## Webhook security

- `ExpediaWebhookVerifier` — signature verification when signing key present
- Replay protection — event id deduplication + timestamp window
- Unknown / unverified events fail closed via `ProviderWebhookNormalizer`

## Production gate

`expediaProductionGateChecklist()` enumerates ten external requirements
(agreement, commercial terms, refund policy, SLA, privacy, security, legal,
payment/custody license, production credentials, monitoring). Code completion
does not satisfy these.

## E2E sandbox test

`packages/access-economy/src/providers/access-21-e2e.test.ts` proves:

Rome lodging search → availability → quote → entitlement coverage → reservation
→ booking → AccessRight → cancellation → webhook evidence.

Uses `ScriptedExpediaSandboxTransport` — no real network on `main`.

## Observability

`ProviderEconomicMetrics` extended with:

- latency samples
- quote / booking failures
- webhook failures
- timeouts
- rate-limit events
- circuit breaker state
- refund latency

## Invariants

ACCESS-21 adds permanent invariants:

- `NO_UNOFFICIAL_PROVIDER_API`
- `NO_REAL_MONEY_IN_SANDBOX`
- `NO_PROVIDER_RESPONSE_BECOMES_FINANCIAL_TRUTH_WITHOUT_CANONICAL_POSTING`
- `NO_HARDCODED_FX`
- `WEBHOOK_SIGNATURE_REQUIRED_WHERE_SUPPORTED`
- `NO_LIVE_PROVIDER_WITHOUT_COMMERCIAL_GATE`

## Related runbook

See `docs/integrations/EXPEDIA_RAPID_SANDBOX_RUNBOOK.md`.
