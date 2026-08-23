# Phase H Prompt 3 — Human Contribution Registry and HIN Economic Value Engine

This record productizes the Human Information Network contribution and
economic-measurement layer.

It does not authorize production. `ENVIRONMENT` stays `simulation`.
All `LIVE_*` flags stay `false`. Mainnet remains inactive.

`PRODUCTION_READY=false`
`PRODUCTION_ACTIVE=false`
`LIVE_CONNECTIVITY_ENABLED=false`

Phase H Prompts 1 and 2 are treated as complete on the existing
IMPLEMENTED HIN, consent, Personal Data Vault, and Human Contribution
Registry capabilities. This prompt does not reimplement those owners.

## Critical rule

Raw personal data must not directly mint SunRey Coin.

The architecture remains:

verified contribution
→ provenance
→ rights/consent
→ contribution classification
→ valuation methodology
→ policy/governance
→ issuance proposal if permitted
→ protocol-native issuance

Phase G native-asset authority remains final.

## Canonical implementation

| Concern | Owner | Notes |
| --- | --- | --- |
| Human Contribution Registry | `packages/human-economic-contribution/src/registry.ts` | Chunk 106 |
| Contribution ontology | `packages/human-economic-contribution/src/taxonomy.ts` | Chunk 104 |
| Verification | `packages/human-economic-contribution/src/verification` | Chunk 109 |
| Valuation constitution / engine | `packages/human-economic-contribution/src/valuation` | Chunks 110–111 |
| HIN rights / usage | `packages/information-market/src/network` | Chunks 100 / 107 |
| HIN Economic Value Engine | `packages/human-economic-contribution/src/hin-value` | This prompt |
| Phase G issuance basis | `packages/sunrey-chain/src/economics/human-contribution-bridge/hin-issuance-basis.ts` | Proposal only |
| Consumer BFF | `services/api` `/api/v1/hin*` | Read-only |
| Agent | `packages/sunrey-agent` `getHin*` | Read-only |

Do not create `packages/hin-value-engine`, `packages/hin-economic-value`,
`packages/human-information-value-engine`, or
`packages/hin-contribution-registry`.

## Product categories

Versioned registry `sunrey-hin-contribution-categories` v1 maps
client-facing categories onto the canonical taxonomy:

- `KNOWLEDGE` → `VERIFIED_KNOWLEDGE_CONTRIBUTION`
- `SKILL` / `EDUCATION_LEARNING` → `EDUCATION_SKILL_ATTESTATION`
- `CREATIVE_OUTPUT` → `CREATIVE_PRODUCTION`
- `WORK_PRODUCTIVE_ACTIVITY` → `HUMAN_SERVICE_DELIVERY`
- `COMMUNITY_PARTICIPATION` → `COMMUNITY_CONTRIBUTION`
- `DATA_CONTRIBUTION` → `INFORMATION_RIGHT_CONTRIBUTION`
- `ATTENTION_ENGAGEMENT` → `OTHER_GOVERNED_HUMAN_CONTRIBUTION` (consent required; not a biological or behavioral trait score)
- `RESEARCH_CONTRIBUTION` → `RESEARCH_PARTICIPATION`
- `OTHER_APPROVED_HUMAN_INPUT` → `OTHER_GOVERNED_HUMAN_CONTRIBUTION`

Adding a category does not grant settlement or issuance eligibility.

## Verification model

Product states overlay the registry lifecycle:

`UNVERIFIED`, `SELF_DECLARED`, `SOURCE_VERIFIED`, `SYSTEM_VERIFIED`,
`DISPUTED`, `INVALIDATED`.

Frontend, Agent, and AI cannot declare a contribution verified.

## Provenance

Every product record binds source, method, time, rights, consent where
required, verification, and an integrity digest. Anonymous fabricated
contributions cannot enter verified HIN metrics.

## Valuation methodologies

Versioned methodology records declare eligible categories, inputs,
units, normalization, caps, confidence treatment, quality weighting,
effective dates, and governance status. Coefficients are data, not
buried scalars. Default methodology
`hin-evi-governed-schedule` v1 is `SIMULATION_APPROVED` and
`productionAuthorized=false`.

See `docs/productization/SUNREY_HIN_VALUATION_METHODOLOGY_STANDARD.md`.

## Economic value input

A HIN Economic Value Input is an auditable metric. It is not SunRey
Coin market price and not a mint amount. It tracks methodology,
inputs, normalized value, confidence, timestamp, and provenance.

## Anti-gaming

Policy-configurable per-event, per-category, and per-period caps,
quality thresholds, duplicate/replay suppression, and anomaly flags.
AI may flag anomalies. AI must not independently determine minting.

## Aggregates

Privacy-safe metrics expose verified contributors, category volume,
economic value inputs, quality shares, and geographic summaries only
when k-anonymity (`k=5`) is met. Individual records are not exposed.

## SunRey Coin interface

`createHinIssuanceBasisProposal` emits
`ECONOMIC_INPUT_ISSUANCE_BASIS`. Phase G
`acceptHinIssuanceBasis` records a draft proposal and does not mint.
`mintRequested` stays `false`. `sunReyQuantity` stays `null`.

## Agent and Lovable

Agent may list contributions, read metrics, read the customer summary,
and read methodology metadata. Agent may not verify, mint, set policy,
or approve issuance.

Lovable reads `/api/v1/hin/contributions`, `/api/v1/hin/contributions/{id}`,
`/api/v1/hin/metrics`, `/api/v1/hin/me/summary`, and
`/api/v1/hin/valuation-methodologies`. Privileged verification and
issuance endpoints are not exposed.

## Unresolved economic policy decisions

- Production HIN valuation coefficients and caps
- Whether any category is issuance-eligible on mainnet
- Conversion from HIN Economic Value Input units into SunRey Coin
- Geographic aggregation jurisdictions and counsel confirmation
- Compensation rails beyond simulation settlement instructions

Those remain human / governance decisions. This prompt does not choose
them.

`SAFE_TO_PROCEED_TO_PHASE_H_PROMPT_4=true` after the HIN value,
Consumer BFF, Agent security, and SDK contract suites in this prompt,
with production still disabled and Phase G remaining the mint authority.
