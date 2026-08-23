# SunRey HIN Valuation Methodology Standard

This standard describes how Human Information Network economic value
inputs are computed from verified contributions.

It is not production tokenomics. It is not legal advice. It does not
authorize minting SunRey Coin.

`PRODUCTION_READY=false`
`PRODUCTION_ACTIVE=false`

## What a methodology is

A methodology is a versioned data record, not a coefficient buried in
application code. Required fields:

| Field | Meaning |
| --- | --- |
| `methodologyId` | Stable identifier |
| `version` | Integer string version |
| `eligibleCategories` | HIN product categories the method may score |
| `inputs` | `quantity`, `qualityBps`, `confidenceBps`, `verificationState` |
| `units` | `HIN_ECONOMIC_VALUE_INPUT_UNIT` |
| `normalization` | Integer numerator / denominator scale |
| `caps` | Per-event, per-category-period, per-subject-period |
| `confidenceTreatment` | Minimum bps and weight |
| `qualityWeighting` | Minimum bps and weight |
| `verificationWeightsBps` | Weight by verification state |
| `effectiveFrom` / `effectiveUntil` | UTC interval |
| `governanceApprovalStatus` | `SIMULATION_APPROVED`, `RESEARCH_REQUIRED`, or `NOT_AUTHORIZED_FOR_PRODUCTION` |
| `productionAuthorized` | Always `false` in this prompt |

## Arithmetic

All values are integers. No floating-point monetary math.

```
scaled = quantity * numerator / denominator
qualityAdjusted = scaled * qualityBps * qualityWeightBps / 10000 / 10000
confidenceAdjusted = qualityAdjusted * confidenceBps * confidenceWeightBps / 10000 / 10000
verificationAdjusted = confidenceAdjusted * verificationWeightBps / 10000
normalized = min(verificationAdjusted, perEventCap)
```

Then apply per-category-period and per-subject-period caps.

## Verification treatment

| State | Eligible | Default weight |
| --- | --- | --- |
| `UNVERIFIED` | no | 0 |
| `SELF_DECLARED` | yes | 2500 bps |
| `SOURCE_VERIFIED` | yes | 7000 bps |
| `SYSTEM_VERIFIED` | yes | 10000 bps |
| `DISPUTED` | no | 0 |
| `INVALIDATED` | no | 0 |

## Forbidden inputs

A methodology must not consume PEVE scores, human-worth scores, credit
scores, protected traits, person-level desirability multipliers, or AI
subjective scores. Raw personal data is not an input.

## Output

The output is a HIN Economic Value Input:

- methodology and version
- inputs used
- normalized value
- confidence
- timestamp
- provenance digest
- `isSunReyQuantity=false`
- `isMintAmount=false`
- `isMarketPrice=false`

## Path to issuance

An Economic Value Input may become an
`ECONOMIC_INPUT_ISSUANCE_BASIS` proposal. That proposal is not a mint
call. Phase G native-asset governance and `authorizeIssuance` remain
required. AI cannot approve the proposal.

## Simulation default

`hin-evi-governed-schedule` v1 is labeled
`ENGINEERING_SIMULATION_PARAMETERS`. It is approved only for
simulation. Production coefficients remain unresolved.
