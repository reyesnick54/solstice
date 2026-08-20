# Chunk 145 — SunRey Coin Production-Candidate Policy Package

This chunk defines the **type-safe production-candidate** policy package
for SunRey Coin human-contribution valuation, settlement conversion,
supply, and issuance parameters.

It does **not** select real production quantities.
It does **not** activate SunRey Coin issuance.

Canonical owners are unchanged:

| Concern | Owner |
| --- | --- |
| Human contribution valuation | `packages/human-economic-contribution/src/valuation` |
| Monetary settlement conversion | `packages/sunrey-chain/src/economics/human-contribution-bridge` |
| Production parameter assembly | `packages/sunrey-chain/src/economics/production-activation` |

Capability: `sunrey-production-issuance-policy-candidate`.

## Architectural path

```
Human Information / Human Activity
        ↓
Rights / Consent / Provenance
        ↓
Canonical Human Economic Contribution
        ↓
Verification
        ↓
Human Contribution Valuation
        ↓
REFERENCE VALUE
        ↓
Governed SunRey Conversion Policy
        ↓
SunRey Settlement Authorization
        ↓
Chunk 71 MonetaryIssuanceAuthority
        ↓
AssetSupplyBook
        ↓
SunRey Coin
```

Never:

- PEVE → SunRey quantity
- human identity → human-worth score → SunRey

## What this is

A production-candidate policy may be `STRUCTURALLY_COMPLETE` or
`VALUES_UNCONFIGURED`. Numeric bases, factors, floors, ceilings,
conversion rationals, and supplies are **not** invented by agents.

Tests and the demo use values labeled:

- `REHEARSAL_FIXTURE`
- `NO_PRODUCTION_ECONOMIC_MEANING`

Those numbers are not recommended tokenomics.

## Permanent valuation constitution

Unchanged from Chunks 110–111:

- valuation is event-specific
- valuation is not human worth
- valuation is not PEVE
- valuation is not a credit score
- valuation is not social credit
- valuation does not mint
- protected-trait valuation is forbidden
- person-level desirability multipliers are forbidden

Person-level multipliers explicitly rejected include celebrity, income,
net-worth, follower-count social rank, citizenship desirability,
creditworthiness, and personal prestige.

## Reference value

`REFERENCE_VALUE_EQUALS_SUNREY_BY_DEFINITION = false`.

There is no implicit 1:1 and no fiat peg. Reference denomination is a
policy field. Do not hardcode USD, EUR, or SAR here.

## Conversion and caps

Conversion uses exact rational arithmetic (`FLOOR`, `CEILING`,
`NEAREST_EVEN`). JavaScript floating point is forbidden.

Per-contribution, per-class, epoch, and global caps cannot bypass the
maximum supply guard. Candidate validation does not mutate
`AssetSupplyBook`.

## AI boundary

AI / S3M / Grok may explain a candidate, simulate outcomes, identify
missing data, or compare versions.

They may not choose final production values, activate valuation policy,
authorize settlement, or authorize issuance.

## Firewall

Chunk 143 consumes a validated package. A fixture package cannot make
`SUNREY_COIN_ISSUANCE = PRODUCTION_CANDIDATE_READY`. The current
repository remains `ECONOMIC_ACTIVATION_BLOCKED`.
`productionActivated` stays `false`. Chunk 71 remains the only monetary
authority.

## Demo

```
npm run demo:sunrey-production-policy-candidate
```

Prints the candidate path and stops before production issuance.
