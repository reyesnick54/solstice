# Product Data Wiring (Wave 7 / Prompt 25)

This document describes how external provider capabilities wire into SunRey product
domains through canonical services and the Consumer BFF (`/api/v1`).

## Principle

The frontend consumes SunRey APIs. It does not know which external provider
generated underlying information.

```
Frontend (Lovable / mobile)
        ↓
Consumer BFF (/api/v1)
        ↓
Canonical domain services
        ↓
Provider adapters (simulation fixtures today)
```

Domain code must not import vendor SDKs or name upstream hosts.

## Domain ownership

| Product domain | Canonical services | BFF routes |
|---|---|---|
| Home | `services/accounts`, identity | `/api/v1/me/home` |
| World | `ExternalDataPlane`, `EnvironmentalOracleService`, `MarketReferenceService` | `/api/v1/world/*`, `/api/v1/world/snapshot` |
| Money | `PaymentPlatform`, `FxReferenceService` | `/api/v1/accounts`, `/api/v1/payments`, `/api/v1/fx` |
| Grow | `GrowthOrchestrator`, `EconomicGraphService`, external context bridges | `/api/v1/grow/*`, `/api/v1/grow/context` |
| Financial Agent | `AgentEvidenceCatalog`, `ProposalGate` | `/api/v1/agent/*`, `/api/v1/agent/external-evidence` |
| Exchange | `sunrey-exchange` consumer APIs + reference surfaces | `/api/v1/exchange/*`, `/api/v1/markets/*` |
| MoonRey | Productive economy data platform | `/api/v1/economy/productive/*`, `/api/v1/economy/productive/snapshot` |
| HIN / Vault | HEC registry, PDV, consent | `/api/v1/hin/*`, `/api/v1/data/vault/*` |
| Travel | Environmental oracle + FX reference + access economy | `/api/v1/travel/overview`, `/api/v1/access/*` |
| Resources | Resource observations + market reference | `/api/v1/world/resources/*` |
| Real Estate | Productive economy (REAL_ESTATE category) | `/api/v1/economy/productive/*` |
| Action Center | Canonical events + agent actions | `/api/v1/agent/actions`, `/api/v1/agent/external-events` |

## BFF contracts

### World snapshot

`GET /api/v1/world/snapshot`

Schema: `sunrey.world.snapshot.v1`

Sections (independent status per section):

- `economy`, `markets`, `currencies`, `crypto`, `energy`, `resources`
- `environment`, `mobility`, `innovation`, `humanEconomy`

One failing section does not erase the entire response.

### Grow external context

`GET /api/v1/grow/context`

Schema: `sunrey.grow.external-context.v1` plus `dataState` and `dataMode`.

### Travel overview

`GET /api/v1/travel/overview`

Schema: `sunrey.bff.travel.snapshot.v1`

Reference/planning only. `bookingAuthorized: false`.

### Agent external evidence

`GET /api/v1/agent/external-evidence`

Schema: `sunrey.agent.evidence-catalog.v1`

Categories: `MACRO`, `MARKET`, `FX`, `CRYPTO`, `COMPANY`, `COMPLIANCE`, `RISK`,
`RESOURCE`, `ENVIRONMENT`, `OPPORTUNITY`, `RESEARCH`, `PATENT`, `AI_ECONOMICS`.

`grantsExecutionAuthority` is always `false`.

### Action Center external events

`GET /api/v1/agent/external-events`

Canonical backend events (`macro_indicator_updated`, `major_company_filing_available`,
etc.). No direct subscription to external providers.

### Productive economy snapshot (MoonRey analytics)

`GET /api/v1/economy/productive/snapshot`

Schema: `sunrey.productive-economy.snapshot.v1`

`analyticsOnly: true`, `issuanceAuthority: false`.

## Sanitized public metadata

BFF responses may expose:

| Field | Purpose |
|---|---|
| `dataState` | `LIVE`, `STALE`, `PARTIAL`, `SIMULATED`, `UNAVAILABLE`, `DEGRADED`, `ESTIMATED` |
| `dataMode` | `live`, `simulation`, `preview` (from `SUNREY_DATA_MODE`) |
| `source.displayName` | Human-readable source label |
| `source.authorityClass` | `official_statistics`, `reference_data`, `market_data`, etc. |
| `dataTimestamp` / `retrievedAt` / `freshness` | Where applicable per section |

Never exposed on consumer surfaces:

- API keys, internal provider IDs (unless required for debugging — removed from Prompt 25 surfaces)
- Circuit breaker internals, risk scores, infrastructure hostnames
- Raw upstream payloads

## Partial response semantics

Aggregators use `Promise.allSettled` and per-section envelopes. Overall status may be
`PARTIAL` when some sections succeed and others are `UNAVAILABLE`.

## Financial Agent authority boundary

```
AI discovers/proposes
        ↓
Compliance Kernel authorizes
        ↓
User approval (where required)
        ↓
Execution provider executes
        ↓
Canonical ledger records state
```

External data integration does not bypass this sequence. Evidence references never
imply Execution Authority.

## Exchange separation

Exchange may **display** external reference context (crypto quotes, network metadata).
It must not confuse reference data with internal order books, execution pricing,
balances, custody, or settlement.

## HIN / Vault boundary

Public reference experiences (nutrition, health reference) are distinct from private
user HIN/PDV data. Live reference integration does not expand vault permissions.

## Implementation locations

| Component | Path |
|---|---|
| Product data state | `packages/external-data/src/product-data-state.ts` |
| World snapshot | `packages/external-data/src/world-snapshot.ts` |
| Productive economy snapshot | `packages/external-data/src/productive-economy-snapshot.ts` |
| Agent evidence catalog | `packages/external-data/src/agent-evidence-catalog.ts` |
| World BFF adapter | `services/api/src/consumer/world-external-data-adapter.ts` |
| Travel BFF adapter | `services/api/src/consumer/travel-adapter.ts` |
| Agent evidence BFF | `services/api/src/consumer/agent-evidence-adapter.ts` |
| DATA_MODE config | `packages/config/src/data-mode.ts` |
| Simulation inventory | `packages/external-data/src/simulation-inventory.ts` |
| Contract tests | `tests/wave-7-prompt-25-product-wiring.test.ts` |

## Prompt 26 recommendation

Prompt 26 (Trust Engine) should add multi-source reconciliation, confidence
aggregation, and cross-provider deduplication on top of these canonical envelopes
without changing consumer BFF schemas.
