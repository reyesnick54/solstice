# SunRey Productive Economy Data Standard

Binding client and provider contract for MoonRey productive-economy
observations. Companion to
[`PHASE_H_05_MOONREY_PRODUCTIVE_DATA.md`](./PHASE_H_05_MOONREY_PRODUCTIVE_DATA.md).

This is not production authorization.

## 1. Categories

Supported product categories:

- ENERGY
- COMPUTE
- AI_COMPUTE
- MANUFACTURING
- RESOURCES
- AGRICULTURE_FOOD
- REAL_ESTATE_INFRASTRUCTURE
- LOGISTICS
- TRANSPORTATION
- BANDWIDTH
- WATER (where approved)
- OTHER_GOVERNANCE_APPROVED

These map onto the existing `ProductiveCategory` taxonomy. They are
not a second economic constitution.

## 2. Resource / output registry

A resource record includes `resourceId`, `category`, `subtype`,
owner/operator references where appropriate, location at a safe
precision, `unit`, `status`, source requirements, valuation
methodology, and oracle requirements.

Sensitive infrastructure coordinates are `REDACTED` when disclosure
is forbidden.

## 3. Observation model

An observation is labeled economic evidence, not a number. Required
fields:

`observationId`, `category`, `resource`, `metric`, `value`, `unit`,
`timestamp`, `source`, `provider`, `provenance`, `verification`,
`confidence`, `freshness`, `license`, `integrity`, `status`.

Unlabeled numeric input is rejected. It is not economic truth.

## 4. Units

Normalize explicitly inside one category family. Examples:

- energy: kWh / MWh → Wh
- compute: approved compute unit (`GPU_HOUR` / `compute_s`)
- manufacturing: quantity / output unit
- agriculture: kg / tonne
- real estate: area / capacity metric where approved

Do not mix incompatible units. Do not invent a fake universal unit.

## 5. Verification

Statuses are:

- `SINGLE_SOURCE_VERIFIED` — not consensus
- `MULTI_SOURCE_CORROBORATED`
- `DISPUTED`
- `STALE`
- `INVALID`
- `OUTLIER`

Single-source verified is never described as consensus. AI may triage
an outlier. AI cannot convert an anomalous observation into verified
truth.

## 6. Freshness

Every observation has a freshness policy. Expired or stale
observations are not used for time-sensitive valuation without an
explicit override that still does not mint.

## 7. Productive Value methodology

Methodologies are versioned. Fields include methodology, version,
category, eligible metrics, normalization, quality weighting,
confidence, caps, conversion basis, governance approval, and
effective date.

The conversion basis is `GPUV_INPUT_NOT_MOONREY_RATIO`. GPUV is the
canonical productive-value unit already defined by the Productive
Value Function. It is an input, not a token amount. Final MoonRey
issuance ratios are not hardcoded here.

## 8. Separation

These planes are related and not interchangeable:

1. PRODUCTIVE ECONOMIC VALUE (GPUV input)
2. MOONREY SUPPLY POLICY
3. MOONREY EXCHANGE PRICE

## 9. Licensing

Track provider/data license. Externally licensed raw data is not
exposed publicly unless terms allow. Frontend receives
derived/approved metrics. Provider credentials and contracts are
never returned on BFF or Agent tools.

## 10. Agent

The Agent may explain the productive economy, retrieve approved
metrics, compare categories, and explain methodology or freshness.

The Agent may not invent data, change methodology, mint MoonRey, or
predict a guaranteed MoonRey price.
