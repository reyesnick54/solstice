# Phase E Prompt 2 — Growth Orchestrator and opportunity discovery

Status: productized on the canonical Growth Orchestrator. Not a second
orchestrator. Not an investment engine. Not production authorization.

`ENVIRONMENT` remains `simulation`. Every `LIVE_*` flag remains `false`.

## Canonical owner

| Surface | Path |
| --- | --- |
| Growth Orchestrator | `packages/platform/src/service.ts` |
| Opportunity model | `packages/platform/src/growth/opportunity/` |
| Existing plans / mandates | `packages/platform/src/growth/` and `src/mandate/` |
| PEG facts | `packages/personal-economic-graph` (non-authoritative) |
| Persistence | `packages/persistence/src/growth/` + `db/customer/migrations/V034__growth_opportunities.sql` |
| Consumer BFF | `services/api/src/consumer/grow-adapter.ts` |
| OpenAPI | `api/sunrey-consumer-bff-v1.openapi.yaml` |
| SDK | `packages/sunrey-sdk/src/consumer-bff/` |

Do not create `packages/growth-os`, `packages/compounder`, or a parallel
recommendation engine.

The Orchestrator answers: *what financially useful actions could improve
this customer's position, given goals, resources, risks, constraints,
jurisdiction, and available SunRey products?*

It does not answer: *what action guarantees the highest return?*

## Detectors

Deterministic only. An LLM is never the sole detector.

| Detector | Category | When it fires |
| --- | --- | --- |
| `EXCESS_IDLE_CASH` | `CASH_OPTIMIZATION` | Liquid above reserve floor by ≥ $500 |
| `INSUFFICIENT_RESERVE` | `EMERGENCY_RESERVE` | Liquid below reserve target |
| `RECURRING_SURPLUS` | `RECURRING_SAVING` | Monthly net flow ≥ $200 |
| `GOAL_FUNDING_GAP` | `GOAL_FUNDING` | PEG/mandate goal target not funded |
| `PORTFOLIO_CONCENTRATION` | `DIVERSIFICATION` | A holding ≥ 40% of provided amounts |
| `PORTFOLIO_DRIFT` | `PORTFOLIO_REBALANCE` | Weight differs from target by ≥ 5pp |
| `UNINVESTED_INVESTMENT_CASH` | `INVESTMENT_ALLOCATION` | Investment-class cash ≥ $500 |
| `CURRENCY_CONCENTRATION` | `CURRENCY_OPTIMIZATION` | One currency ≥ 80% of multi-currency liquid |
| `HIGH_FEES` | `EXPENSE_OPTIMIZATION` | Catalog alternative is cheaper |
| `MISMATCHED_LIQUIDITY` | `CASH_OPTIMIZATION` | Mandate/obligation vs available cash |

Missing comparison or holding data means the detector stays silent.
Unsupported products are not invented.

## Eligibility

Server-owned checks, fail closed:

1. Jurisdiction (`US`, `GB` in simulation)
2. KYC state (verified required for KYC-gated products)
3. Product availability
4. Provider availability
5. Risk profile / suitability maximum
6. Product minimum amount
7. Mandate liquidity and prohibited categories
8. Frozen/restricted accounts
9. Customer compliance restriction

An unavailable investment product is never `immediatelyExecutable`.
`LIVE_INVESTMENT_EXECUTION` stays false. Paper review is proposal-only.

Preferences may hide a category. They cannot make an ineligible
opportunity eligible or raise risk above suitability.

## Prioritization

`OPPORTUNITY_RANKING_V1` is explainable and testable.

Weights: urgency 25, goal relevance 20, risk-adjusted impact 20,
confidence 15, liquidity fit 10, cost 5, preference fit 5.

Uncertain market outcomes contribute **zero** impact score.
Deterministic cash-flow effects rank above estimated ranges.

## Impact modeling

| Kind | Use |
| --- | --- |
| `KNOWN_FINANCIAL_EFFECT` | Reserve gap, surplus, avoidable fee |
| `ESTIMATED_RANGE` | Idle cash vs simulation catalog rate |
| `SCENARIO_RANGE` | Investment review; achievement not promised |
| `NON_QUANTIFIED_BENEFIT` | Concentration, FX, timing |

Every estimate carries assumptions, optional `rateSource`
(`SIMULATION_CATALOG_NOT_A_PROMISE` + integer basis points + as-of),
fees, time, and a tax disclaimer. There is no APY, APR, yield, or
blended-return field. `returnGuaranteed` is always `false`.

## Goal integration

Opportunities link to mandate and PEG goals with:

- monthly required contribution (gap ÷ remaining months, rounded up)
- current funding
- projected shortfall versus surplus
- available surplus

`achievementPromised` is always `false`.

## Lifecycle

`DETECTED` → `ELIGIBLE` / `INELIGIBLE` → `PRESENTED` → `DISMISSED` /
`ACCEPTED_FOR_PROPOSAL` / `EXPIRED` / `SUPERSEDED` / `COMPLETED`.

Dismissed or superseded fingerprints do not reappear unchanged.
A material amount change (≥ 20%) may create a fresh review.

Diversity: max two presented cards per category, max five total.

## AI explanation boundary

`sunrey.growth.opportunity.explanation.v1` is the only Agent input.

The Agent may describe why the opportunity was found, how it relates to
a goal, which assumptions were used, and what risks exist.

The Agent must not invent balances, rates, fees, or dates, and must not
promise a return. Structured facts are copied, not recomputed.

## API / Lovable feed

| Method | Path | Effect |
| --- | --- | --- |
| GET | `/api/v1/grow` | Feed / cards |
| GET | `/api/v1/grow/opportunities` | Ranked opportunities |
| GET | `/api/v1/grow/opportunities/:id` | Detail |
| POST | `/api/v1/grow/opportunities/:id/dismiss` | Suppress fingerprint |
| POST | `/api/v1/grow/opportunities/:id/start-proposal` | Proposal receipt only |

Cards include enough structured money fields for UI. The frontend must
not compute rates, totals, or goal math.

Sandbox persona `grow` (`sandbox.grow`) has idle USD cash plus a
savings account for card demos.

## Events / jobs

Material recomputes: new account activity, mandate change, PEG snapshot,
KYC change, restrictions, investment cash funding, preference updates.

Minor fees and card authorizations do not recompute everything.
Cash changes below $100 and 5% are ignored.
Scheduled recalculation is skipped if the last run was under one hour.

Events: `GrowthOpportunityDetected`,
`GrowthOpportunityLifecycleChanged`,
`GrowthOpportunityPreferencesUpdated`,
`GrowthOpportunitiesRecomputed`.

## Production posture

`PRODUCTION_READY=false`
`PRODUCTION_ACTIVE=false`
`LIVE_CONNECTIVITY_ENABLED=false`

Starting a proposal does not post a journal or issue Execution Authority.
