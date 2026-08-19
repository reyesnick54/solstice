# Chunk 111 — Human Contribution Valuation Engine

Canonical owner: `packages/human-economic-contribution/src/valuation`.

This module produces a **reference settlement value**. It does not
produce a SunRey Coin quantity and does not mint.

Capability `sunrey-human-economic-contributions` remains singular.
Do not create `packages/human-valuation-engine` or
`packages/contribution-valuation`.

## What it implements

- Privacy-safe `HumanContributionValuationResult`
- Simulation valuation policy with an explicit reference cap
- Engineering-implemented measurement-scale valuation
- Fail-closed production, PEVE, human-worth, AI, and raw-personal-data
  refusals

## What it does not implement

- SunRey quantity
- PEVE composite scoring
- Human-worth or social-credit scoring
- Production valuation activation
- Monetary issuance

`finalReferenceValue` is a contribution reference settlement value.
`sunReyQuantity` is always `null`.
`referenceValueEqualsSunReyByDefinition` is always `false`.

Production policy remains `UNCONFIGURED` / `NOT_ACTIVATED`.

Simulation parameters are labeled
`ENGINEERING_SIMULATION_PARAMETERS`.

Chunk 112 converts a valid result into a settlement authorization.
The valuation result cannot mint by itself.
# Chunk 111 — Deterministic Human Contribution Valuation Engine

Canonical owner: `packages/human-economic-contribution/src/valuation`.

Capability `sunrey-human-contribution-valuation` is `IMPLEMENTED`.

This chunk implements the **engine** that evaluates an active
`VERIFIED` human contribution under an active versioned valuation
policy. It extends the Chunk 110 valuation constitution at the same
owner. It does not create a second valuation package.

## What a valuation result is not

- A valuation result is **not** settlement authorization.
- A valuation result is **not** SunRey issuance.
- A valuation result is **not** PEVE.
- A valuation result is **not** a human-worth score.

`createsMintAuthority`, `createsExecutionAuthority`,
`isSunReyQuantity`, `isPeveScore`, `isHumanWorthScore`,
`isCreditScore`, `isSettlementAuthorization`, and
`productionEligible` are hard-false.

## Pipeline

```
Verified Contribution
  → Method Eligibility
  → Required Evidence Check
  → Reference Data Resolution
  → Base Reference Value
  → Allowed Contribution-Level Adjustments
  → Caps / Floors
  → Deterministic Rounding
  → Final Reference Settlement Value
  → Valuation Result + explanation receipt
```

Every step is reason-coded. The engine does not invent a value when
methods, references, jurisdiction, confidence, rights scope, or
outcome attribution are ambiguous. Those cases return
`VALUATION_REVIEW_REQUIRED` or `VALUATION_REJECTED`.

## Arithmetic

Economic value is `bigint` minor units of
`SIMULATION_REFERENCE_MINOR_UNIT`. Factors use basis points or exact
rationals. The policy supplies `ROUND_DOWN` or `ROUND_HALF_UP`.
Floating point is forbidden.

## Methods

The engine implements the Chunk 110 methodologies:

- `CONTRACTUAL_COMPENSATION`
- `GOVERNED_FIXED_SCHEDULE`
- `INFORMATION_USAGE_RIGHT_SCHEDULE`
- `PROFESSIONAL_SERVICE_SCHEDULE`
- `CREATOR_ROYALTY_SCHEDULE`
- `RESEARCH_PARTICIPATION_SCHEDULE`
- `COMMUNITY_CONTRIBUTION_SCHEDULE`
- `MARKET_REFERENCE` (approved snapshot only; no live HTTP)
- `VERIFIED_OUTCOME_ATTRIBUTION` (explicit outcome evidence required)

## Reference data

A provider-neutral `ValuationReferenceDataPort` supplies in-memory
fixtures. There is no network call and no live pricing API.

## Revaluation

History is append-only. A later policy version creates a new
valuation that may reference `supersedesValuationId`. It does not
overwrite a historic result and does not automatically rewrite
settlements.

## Commands

```
npm --workspace @solstice/human-economic-contribution test
npm run demo:sunrey-human-contribution-valuation
```

## What this chunk does not do

- mint SunRey Coin or compute a SunRey quantity
- issue Execution Authority
- authorize settlement or production issuance
- accept PEVE, person-level multipliers, protected traits, or AI
  subjective scores as value
- connect to a live bank, FX source, or market API
- weaken the Chunk 108 monetary-evidence firewall
