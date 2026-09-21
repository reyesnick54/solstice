# HELIOS Multi-Asset Expansion — M13–M16 Intelligence Layer Closure

Date: 2026-09-21 (UTC)

This document closes the HELIOS Multi-Asset intelligence layer milestones M13 through M16: cross-asset regime classification, opportunity graph wiring, multi-source assembly, and deterministic opportunity ranking.

## Implemented architecture

### M13 — Cross-Asset Regime Engine

Owner: `packages/platform/src/helios/intelligence/m13-regime/`

| Component | Responsibility |
|-----------|----------------|
| `engine.ts` | Deterministic regime classification from canonical `MarketState` |
| `taxonomy.ts` | Regime labels and strategy-family compatibility matrix |
| `qualification.ts` | Emits `HELIOS_MULTI_ASSET_M13_REGIME_ENGINE_QUALIFIED` |

Regimes: `TRENDING_UP`, `TRENDING_DOWN`, `MEAN_REVERTING`, `HIGH_VOL`, `LOW_VOL`, `RANGE_BOUND`, `UNKNOWN`.

No LLM or provider adapter access. Regime output feeds M16 scorecard `regimeCompatibility`.

### M14 — Cross-Asset Opportunity Graph

Owner: `packages/platform/src/helios/intelligence/m14-opportunity-graph/`

| Component | Responsibility |
|-----------|----------------|
| `graph.ts` | Builds deterministic cross-asset graph with correlation and exposure edges |
| `types.ts` | Node/edge model for instruments, strategy families, and candidates |
| `qualification.ts` | Emits `HELIOS_MULTI_ASSET_M14_CROSS_ASSET_OPPORTUNITY_GRAPH_QUALIFIED` |

Graph is non-authoritative intelligence. Correlation warnings feed M16 `correlationExposure` and portfolio overlap checks.

### M15 — Multi-Source Opportunity Assembly

Owner: `packages/platform/src/helios/intelligence/m15-opportunity-assembly/`

| Component | Responsibility |
|-----------|----------------|
| `assembly.ts` | Validates work-order binding, envelope refs, expiry, and evidence before ranking |
| `types.ts` | `AssembledOpportunityCandidate` from Strategy Lab, commodity trend, stat arb, Agentic Capital Mesh |

Assembly rejects expired, duplicate, envelope-invalid, and evidence-missing candidates. Does not rank or authorize trades.

### M16 — Multi-Asset Opportunity Ranking Engine

Owner: `packages/platform/src/helios/intelligence/m16-opportunity-ranking/`

| Component | Responsibility |
|-----------|----------------|
| `scorecard.ts` | Explainable factor scorecard; no invented expected-return without evidence |
| `ranker.ts` | Deterministic composite ranking and output-state assignment |
| `meta-allocator-bridge.ts` | Hands off only `QUALIFIED_FOR_ALLOCATION_REVIEW` candidates to H20 Meta Allocator |
| `evidence.ts` | Seals ranking runs in Evidence Vault |
| `store.ts` | Restart-safe in-memory persistence |
| `service.ts` | End-to-end M13→M16 pipeline orchestration |

#### Scorecard factors

`strategyConfidence`, `historicalQualification`, `regimeCompatibility`, `expectedReward`, `expectedDownside`, `realizedVolatility`, `liquidity`, `spread`, `estimatedFees`, `estimatedSlippage`, `dataQuality`, `evidenceQuality`, `signalFreshness`, `correlationExposure`, `capitalRequirement`, `providerAvailability`, `executionReadiness`, `timeToExpiry`.

Expected reward and downside factors reject when Strategy Capsule evidence is absent.

#### Output states

`HIGH_PRIORITY_RESEARCH`, `QUALIFIED_FOR_ALLOCATION_REVIEW`, `WATCH`, `WAIT`, `REJECT`, `INSUFFICIENT_EVIDENCE`, `EXPIRED`.

Rank is not permission to trade. Ranking engine does not authorize or execute trades.

#### Ranking versions

- `HELIOS_M16_OPPORTUNITY_RANKING_V1` — baseline weights
- `HELIOS_M16_OPPORTUNITY_RANKING_V2` — adjusted regime/evidence weights for reproducible version-change tests

## Integration points

| Upstream | Usage |
|----------|-------|
| M04 `MarketState` | M13 regime inputs |
| M09/M10 Strategy Lab | Candidate sources and qualification evidence |
| H09 executable opportunity | Work-order and evidence patterns |
| H21 Decision-Validity Envelope | Assembly envelope validation |
| H20 Meta Allocator | Handoff for allocation-review-eligible opportunities only |

Risk, Compliance, and Execution retain final independent authority.

## Qualification markers

| Milestone | Marker |
|-----------|--------|
| M13 | `HELIOS_MULTI_ASSET_M13_REGIME_ENGINE_QUALIFIED` |
| M14 | `HELIOS_MULTI_ASSET_M14_CROSS_ASSET_OPPORTUNITY_GRAPH_QUALIFIED` |
| M15 | `HELIOS_MULTI_ASSET_M15_OPPORTUNITY_ASSEMBLY_QUALIFIED` |
| M16 | `HELIOS_MULTI_ASSET_M16_OPPORTUNITY_RANKING_QUALIFIED` |

Tests: `tests/helios-multi-asset-m16-opportunity-ranking.test.ts`

Qualify script: `scripts/helios-m16-opportunity-ranking-qualify.ts`

## Known limitations

1. **In-memory ranking store** — durable PostgreSQL persistence for ranking runs is not part of M16.
2. **Static correlation matrix input** — M14 consumes caller-supplied correlation bps; live covariance estimation belongs in a later milestone.
3. **Strategy-family stubs** — commodity trend and stat arb families use assembly/ranking contracts; dedicated Strategy Capsules may land in later milestones.
4. **Meta Allocator handoff is advisory** — eligible handoff does not post reservations or grant Execution Authority.

## M17

Not started (per scope).
