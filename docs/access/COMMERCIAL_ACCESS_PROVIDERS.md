# Commercial Access Providers — ACCESS Wave 2 / Prompt 32

Classification: engineering simulation on current `main`.

## Overview

Prompt 32 adds SunRey's **commercial Access Provider adapter layer** for providers
capable of real availability, firm quotes, reservations, booking, cancellation,
refunds, fulfillment status, and reconciliation.

Canonical owner: `packages/access-economy/src/providers/commercial/`

This layer extends the existing ACCESS-14 provider network. It does **not**
create a duplicate provider framework, payment rail, Access funding consumer,
or SR/MR conversion path. Settlement orchestration remains **Access Wave 3**.

```
CommercialAccessProviderGateway
  → commercial adapters (Amadeus, Booking.com, Viator, Ticketmaster)
  → fixture transport (CI) / injected transport (future sandbox)
  → canonical AccessProviderQuote / Booking / Cancellation models
```

## Provider matrix

| Provider | Search | Availability | Quote | Book | Cancel | Refund | Reconcile | Production Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Amadeus | ✓ fixture | ✓ fixture | ✓ fixture (FIRM) | ✓ fixture | ✓ fixture | — | ✓ fixture | **BLOCKED_PENDING_CREDENTIALS** |
| Booking.com Demand | ✓ fixture | ✓ fixture | ✓ fixture (FIRM) | ✓ fixture | ✓ fixture | — | ✓ fixture | **BLOCKED_PENDING_CONTRACT** |
| Viator | ✓ fixture | ✓ fixture | ✓ fixture (FIRM) | ✓ fixture | ✓ fixture | — | via STATUS | **BLOCKED_PENDING_CREDENTIALS** |
| Ticketmaster Partner | ✓ fixture | ✓ fixture | ✓ fixture (FIRM) | ✓ fixture | ✓ fixture | ✓ fixture metadata | ✓ fixture | **BLOCKED_PENDING_CONTRACT** |
| Ticketmaster Discovery | ✓ fixture | — | — | — | — | — | — | **DISCOVERY_ONLY** (informational) |

**No provider is production-enabled.** `ENVIRONMENT=simulation` blocks production
activation even when credentials and contracts exist.

### Existing ACCESS-14 providers (unchanged)

| Provider | Mode |
| --- | --- |
| Expedia Rapid | `SANDBOX_AVAILABLE` (fixture/injected transport) |
| Turo, DoorDash, Amazon, Airbnb | `SIMULATED` or `PARTNER_APPROVAL_REQUIRED` |

## Capabilities

Commercial capabilities (`AccessProviderCapability`):

- `SEARCH`, `AVAILABILITY`, `QUOTE`, `RESERVE`, `BOOK`, `CANCEL`, `REFUND`, `STATUS`, `RECONCILE`, `FULFILLMENT_EVIDENCE`

Providers declare only supported capabilities. Unsupported methods are not
implemented.

## Activation states

| State | Meaning |
| --- | --- |
| `DISCOVERY_ONLY` | Search/informational only |
| `SANDBOX` | Sandbox credentials configured |
| `PREVIEW` | Limited preview with credentials |
| `PRODUCTION` | Commercial production (blocked in simulation) |
| `BLOCKED_PENDING_CREDENTIALS` | Adapter shell; no credentials |
| `BLOCKED_PENDING_CONTRACT` | Adapter shell; no commercial agreement |
| `BLOCKED_PENDING_COMPLIANCE` | Compliance review required |
| `DISABLED` | Explicitly disabled |

Production must not silently enable a sandbox provider.

## Product mapping

`AccessProviderProductMapping` maps external inventory to canonical Access
products:

- `mappingId`, `providerId`, `providerProductId`, `accessProductId`
- `category`, `providerNativeUnit`, `canonicalUnit`, `conversionPolicy`
- `geography`, `status`, `effectiveFrom`, `effectiveTo`

Registry: `AccessProviderProductMappingRegistry` in `product-mapping.ts`.

## Quote architecture

`AccessProviderQuote` includes:

- `classification`: `REFERENCE` | `INDICATIVE` | `FIRM`
- `baseAmount`, `taxes`, `mandatoryFees`, `optionalFees` (separate)
- `securityDeposit` (separate from service cost; not eligible for Access funding by default)
- `totalAmount`, `cancellationPolicy`, `termsReference`

Only **FIRM** quotes may proceed to settlement in Access Wave 3. Indicative or
reference quotes are never upgraded automatically.

## Reservation and booking

- `AccessProviderReservation` — provider hold only; not Access funding reservation
- `AccessProviderBooking` — normalized status: `PENDING`, `CONFIRMED`, `FAILED`, `CANCELLED`, `FULFILLED`, `UNKNOWN`
- Timeout → `UNKNOWN` + `RECONCILIATION_REQUIRED`; not auto-`FAILED`
- SunRey idempotency keys prevent duplicate bookings

## Cancellation and refund

- `AccessProviderCancellation` — refund eligibility and penalty metadata only
- `AccessProviderRefund` — provider refund state only
- Provider refund state and SunRey funding ledger state remain **distinct** until Wave 3

## Security and privacy

- Credentials via `regulated/*` secret references (`credentials.ts`)
- No API keys, client secrets, or partner tokens in BFF, logs, or errors
- `data-minimization.ts` — booking profile fields only; forbids HIN, vault, token holdings, bank balances
- `redactCredentialFromError()` for safe error surfaces

## Credential status

| Provider | Credential refs | Status |
| --- | --- | --- |
| Amadeus | `regulated/amadeus/api-key`, `api-secret` | MISSING |
| Booking.com | `regulated/booking-com/demand-api-key` | MISSING |
| Viator | `regulated/viator/partner-api-key` | MISSING |
| Ticketmaster Partner | `regulated/ticketmaster/partner-api-key` | MISSING |
| Ticketmaster Discovery | (none) | N/A |

## Contract status

| Provider | Contract |
| --- | --- |
| Amadeus | NONE |
| Booking.com | PENDING |
| Viator | NONE |
| Ticketmaster Partner | PENDING |
| Ticketmaster Discovery | N/A (discovery only) |

## Known restrictions

- No live network calls in CI; fixture transport only
- No Access funding consumed
- No fiat payment or settlement
- No SR/MR conversion or MoonRey issuance
- Ticketmaster Discovery is **not** Ticketmaster Partner
- Cached discovery data is not firm availability

## Tests

`packages/access-economy/src/providers/commercial/commercial-access.test.ts`

Run:

```bash
cd packages/access-economy && npm test
```

## Recommendation for Prompt 33

Prompt 33 should implement **Access settlement orchestration** (Wave 3):

1. Wire FIRM commercial quotes into the Access funding system
2. Separate security-deposit handling from eligible Access coverage
3. Provider refund reconciliation against funding ledger (without double-spend)
4. Production credential and contract gates with Kernel-gated activation
5. End-to-end redemption saga spanning commercial gateway + ACCESS-14 redemption engine

Do not activate production providers or flip `LIVE_*` flags in Prompt 33 prep work.
