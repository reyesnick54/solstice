# SunRey Access V1 Architecture

Classification: engineering simulation on current `main`. Access V1 launch scope frozen 2026-08-31.

## V1 scope (frozen)

Access V1 delivers **non-cash entitlements** backed by **fiat-funded pools**, redeemed against **commercial provider adapters** with **user fiat co-pay** where coverage is partial. Settlement is **fiat to providers** via payment-rail intents. **No direct SR/MR settlement. No native MoonRey provider settlement.**

```
SR / MR participation (read-only inputs)
        ↓
TWAB (time-weighted average balance snapshots)
        ↓
Access Allocation Engine (epoch policy, diminishing returns)
        ↓
Access Entitlement Ledger (non-cash units by category)

External Provider Network
        ↓
Access Provider SDK / Gateway / Capability Registry
        ↓
Discovery → Availability → Firm Quote → Reserve → Book → Cancel

Fiat treasury / promotional / provider-discount sources
        ↓
Access Funding Pool + Access Funding Ledger
        ↓
Access Solvency Service (category pools, reservations, exhaustion)

Entitlement capacity  +  Funded capacity
        ↓
Access Coverage Engine (coverage-policy.ts + evaluateRedemption)
        ↓
Transaction Orchestrator (RedemptionWorkflow / CanonicalAccessRedemptionOrchestrator)
        ↓
Settlement Orchestrator (RedemptionFundingRouter → funding intents)
        ↓
Provider Fiat Payment (intent to packages/payments — simulation only at V1)
        ↓
Fulfillment evidence + chain commitments (simulation)
        ↓
Reconciliation (ledger evidence refs; operator metrics partial)
        ↓
Consumer BFF (packages/human-access-economy → services/api/src/consumer/access.ts)
        ↓
SunRey App (frontend contract via OpenAPI / SDK types)
```

## Canonical owners

| Component | Owner |
| --- | --- |
| Access domain models | `packages/access-economy/src/domain/` |
| Allocation engine + TWAB | `packages/access-economy/src/allocation-engine/` |
| Dual-token TWAB (ACCESS-15) | `packages/access-economy/src/dual-token-allocation/` |
| Entitlement ledger | `packages/access-economy/src/funding-solvency/entitlement-ledger.ts` |
| Funding ledger + pools | `packages/access-economy/src/funding-solvency/` |
| Solvency service | `packages/access-economy/src/funding-solvency/solvency-service.ts` |
| Provider gateway + adapters | `packages/access-economy/src/providers/` |
| Coverage policy | `packages/access-economy/src/providers/coverage-policy.ts` |
| Redemption workflow | `packages/access-economy/src/providers/redemption/` |
| Canonical orchestrator | `packages/human-access-economy/src/canonical-redemption-orchestrator.ts` |
| Personal Access Envelope | `packages/access-fabric` |
| Exchange clearing (priced access) | `packages/sunrey-exchange/src/access-fabric/` |
| Chain access rights | `packages/sunrey-chain/src/access/` |
| Consumer projection | `packages/human-access-economy` |
| BFF routes | `services/api/src/consumer/access.ts` |

## TokenConversionContribution

At V1 launch:

```
TokenConversionContribution = 0
```

Enforced by:

- `packages/access-economy/src/domain/invariants.ts` — `defaultTokenConversionContribution()` returns `0n`
- `packages/access-economy/src/funding-solvency/` — `TOKEN_CONVERSION_CONTRIBUTION = 0n`
- `packages/access-economy/src/providers/funding-router.ts` — SR/MR coin kinds exist in schema but are not emitted in V1 redemption paths

SR and MR balances inform allocation via TWAB. They are **not** liquidated for provider settlement at V1.

## Money boundaries

| Layer | Role |
| --- | --- |
| Access Entitlement Ledger | Non-cash unit accounting (days, nights, meals) |
| Access Funding Ledger | Fiat pool capacity, reservations, capture, refund |
| Canonical Money Ledger | User fiat contribution settlement (via Kernel + Execution Authority) |
| Funding router | Emits intents only; does not post journals |

Access coverage is **settlement economics**, not withdrawable cash. Entitlements are **not** payment instruments.

## Settlement rails (V1)

| Rail | Status |
| --- | --- |
| User fiat co-pay | Intent to `packages/payments` — simulation / production-candidate only |
| Access pool fiat | Internal funding ledger + reservation |
| Restricted virtual card | `packages/cards` simulation; production issuance **blocked** |
| SR/MR direct settlement | **Out of scope V1** |
| MoonRey provider settlement | **Out of scope V1** |

## Consumer BFF surface

Primary routes (`api/sunrey-consumer-bff-v1.openapi.yaml`):

- `GET /api/v1/access/overview`
- `GET /api/v1/access/entitlements`
- `POST /api/v1/access/search`, `/quotes`, `/reservations`, `/reservations/{id}/confirm`, `/reservations/{id}/cancel`
- `GET /api/v1/access/activity`, `/reservations`
- Allocation surfaces: `/access/allocation`, `/access/epoch`, `/access/participation`

Frontend should consume BFF DTOs only. Provider IDs and internal policy versions are opaque.

## Simulation vs production data

| Mode | Behavior |
| --- | --- |
| `ENVIRONMENT=simulation` | Fixture and adapter-backed inventory; `simulationOnly` flags on quotes |
| Production (not active) | Must serve `UNAVAILABLE` or `STALE` — never silent simulation inventory |
| Preview / test | Explicit fixture endpoints only |

## Explicit non-goals (V1)

- Access Wave 6: regulated SR/MR conversion, MoonRey provider settlement, productive-capacity contribution settlement
- Live provider activation without external gates
- Guaranteed redemption language or APY/yield on entitlements
- Second ledger, Kernel, or Execution Authority in Access packages

## Related documentation

- `docs/access/ACCESS_DOMAIN_ARCHITECTURE.md`
- `docs/access/ACCESS_ALLOCATION_ENGINE.md`
- `docs/access/ACCESS_FUNDING_AND_SOLVENCY.md`
- `docs/architecture/ACCESS_17_CANONICAL_RUNTIME.md`
- `docs/architecture/ACCESS_PROVIDER_NETWORK.md`
- `docs/access/FINAL_ACCESS_PROVIDER_MATRIX.md`
- `docs/access/ACCESS_PRODUCTION_READINESS_SCORECARD.md`
