# Expedia Rapid Sandbox Runbook

Operator guide for SunRey Access Expedia Rapid Lodging sandbox connectivity.

## Prerequisites

1. Expedia partner approval for Rapid API access
2. API key and shared secret from Expedia Connectivity Portal
3. SunRey regulated credential bindings configured (not in source, logs, tests, or docs)

## Credential binding

Store secrets through the canonical regulated credential plane:

| Secret | Reference |
| --- | --- |
| API key | `regulated/expedia/rapid/api-key` |
| Shared secret | `regulated/expedia/rapid/shared-secret` |
| Webhook signing key | `regulated/expedia/rapid/webhook-signing-key` |

Rotate via `rotateExpediaCredentials()` — never commit plaintext values.

## Sandbox endpoint

Use the official Expedia Rapid sandbox host suffix `test.ean.com` with TLS.

Booking requests against the sandbox do not create live reservations or charge
real payment instruments per Expedia documentation.

## Authentication

Generate the authorization header per official signature authentication:

```
Authorization: EAN APIKey=<apiKey>,Signature=<sha512>,timestamp=<unixSeconds>
```

Where `Signature = SHA-512(apiKey + sharedSecret + timestamp)` (unsalted).

Verify locally with Expedia's Signature Generator before first sandbox call.

## Supported flow

1. **Search** — canonical catalog search (Rome lodging fixture maps to property `19248`)
2. **Availability** — `GET /v3/properties/availability`
3. **Quote / price check** — rate token from price check response
4. **Reserve** — hold token (sandbox)
5. **Book** — `POST /v3/itineraries` with idempotency key
6. **Status** — `GET /v3/itineraries/{itinerary_id}`
7. **Cancel** — `DELETE /v3/itineraries/{itinerary_id}/rooms/{room_id}`
8. **Webhook** — verify signature + replay window before normalization

## Test headers

For booking error rehearsal, use official Rapid `test` HTTP headers documented
in Expedia's booking test request guide. Do not use live credit cards in
pre-launch development.

## Production promotion

Production requires **all** items in `expediaProductionGateChecklist()`:

- Signed provider agreement
- Commercial terms
- Refund policy
- Service-level expectations
- Privacy review
- Security review
- Legal jurisdiction review
- Payment / custody license analysis
- Production credentials
- Operational monitoring

Switch host suffix from `test.ean.com` to `api.ean.com` only after commercial
gate approval and BDM production key enablement.

## Failure handling

| Symptom | Action |
| --- | --- |
| `401 invalid_signature` | Verify clock sync and signature material |
| `409 price_mismatch` | Re-run price check; do not book stale rates |
| `429 rate_limited` | Back off; check `ProviderRuntimeControls` metrics |
| `503 service_unavailable` | Circuit breaker may be open; wait for cooldown |
| Webhook replay | Expected idempotent refusal — do not reprocess |

## Financial safety

- Sandbox flows must not move real customer funds
- Provider quotes are not ledger truth
- Settlement intents route through canonical payments / custody owners only

## References

- Expedia Group Developer Hub — Rapid setup
- Expedia Rapid — Signature authentication
- Expedia Rapid — Booking test requests
- SunRey `docs/integrations/ACCESS_21_LIVE_PROVIDER_INTEGRATION.md`
