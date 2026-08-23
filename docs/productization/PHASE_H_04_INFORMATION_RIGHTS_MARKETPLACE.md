# Phase H Prompt 4 — Information Rights Marketplace, Licensing and Compensation

This record productizes the controlled economic-use infrastructure for
information rights.

It does not authorize production. `ENVIRONMENT` stays `simulation`.
All `LIVE_*` flags stay `false`. Production remains disabled.

`PRODUCTION_READY=false`
`PRODUCTION_ACTIVE=false`
`LIVE_CONNECTIVITY_ENABLED=false`

Phase H Prompts 1–3 are not documented in this tree (latest prior
productization record is Phase G Prompt 5). This prompt extends the
existing Human Information Network and information-market owners so
those planes can attach without a second marketplace.

`SAFE_TO_PROCEED_TO_PHASE_H_PROMPT_5=true` after the rights, product,
license, privacy, compensation, settlement, metering, revocation,
consumer earnings APIs, and Lovable/Agent contracts in this prompt.

Do not begin Prompt 5 from this document.

## Owner

Canonical owner: `packages/information-market`
(`src/rights-marketplace/`).

Existing HIN engine remains `src/network/engine.ts`.
Existing contribution marketplace remains `src/service.ts`.

Orchestration: `services/api/src/consumer/hin.ts`.

Lovable contract: `packages/sunrey-sdk/src/consumer-bff` plus
`api/sunrey-consumer-bff-v1.openapi.yaml`.

Developer / licensee APIs stay on `/v1/information/marketplace/*`.
They are not exposed through the consumer BFF.

Do not create `packages/licensing`, `packages/data-marketplace`,
`packages/information-rights-v2`, or `packages/data-licensing`.

## Information Rights model

Client-safe resource fields:

`rightId`, `rightsHolder`, underlying category/product, `scope`,
eligible purposes, prohibited purposes, `transferability` /
`licenseability`, `jurisdiction`, privacy requirements, consent
dependency, `status`, `termsVersion`.

`ownershipTransferred` is always `false`. A right is a usage right,
not a sale of the person or of raw vault records.

## Data Product model

Privacy-controlled forms:

- individual-authorized package (only when explicitly permitted)
- aggregated dataset
- derived metric
- statistical insight
- research cohort
- HIN aggregate
- API / query access

Derived and aggregated privacy-preserving forms are preferred when they
satisfy the use case. Licensees never receive general database
credentials.

## Product eligibility

Before creation the backend verifies rights, consent, classification,
purpose, minimum aggregation threshold, jurisdiction, retention,
licensing eligibility, and privacy policy. Sensitive categories require
stricter controls and cannot be licensed for heightened purposes without
separate authorization.

## License model

Statuses: `PROPOSED`, `ACTIVE`, `SUSPENDED`, `REVOKED`, `EXPIRED`,
`TERMINATED`.

A license binds licensee, product, purpose, scope, duration, query and
download limits, redistribution prohibition, retention, compensation,
revocation rules, and terms. Purpose is preserved: `RESEARCH` does not
authorize `MARKETING` or `CREDIT_DECISIONING`.

## Privacy controls

Aggregated products support minimum cohort size, suppression, category
restrictions, query limits, and re-identification controls.
`differentialPrivacyClaimed` is `false`. Formal differential privacy is
not implemented.

## Compensation architecture

Compensation uses a versioned policy. Shares are integer basis points
and must sum to 10_000. Recipients may include individual rights
holders, contribution pools, community pools, SunRey fees, and other
approved participants.

The simulation fixture is not approved economic policy and does not
guarantee compensation.

## Ledger / native-asset integration

Fiat settlement uses the existing Phase C Ledger compensation port
(`FiatCompensationPort` → Kernel → Execution Authority →
`Ledger.postJournal`).

SunRey Coin compensation uses a Phase G native-asset transfer port.
The marketplace cannot mint. `mintFromMarketplace` fails closed.

## Usage metering

Each access records license, access kind, timestamp, volume, product,
purpose, usage count, and billing reference. Raw sensitive query output
is refused in generic logs. Duplicate usage events cannot settle twice.

## Revocation

Where consent or contract permits revocation, future access stops.
The record keeps revocation time, remaining obligations, any
data-deletion obligation, and historical lawful usage.

## Licensee security

Licensees have a client identity, API credential reference (not a
secret), rate limits, purpose restrictions, audit, kill switch, and
incident suspension. No secrets are committed.

## API / BFF / SDK

Consumer BFF (subject-scoped):

- `GET /api/v1/hin/rights`
- `GET /api/v1/hin/licenses`
- `GET /api/v1/hin/earnings`
- `GET /api/v1/hin/earnings/activity`
- `GET /api/v1/hin/permissions`
- `GET /api/v1/hin/usage`
- `GET /api/v1/hin/participation`
- `POST /api/v1/hin/participation/pause`
- `POST /api/v1/hin/participation/withdraw`

Developer marketplace APIs remain on `/v1/information/marketplace/*`.

## Agent contract

The agent may explain rights, show active permissions, show approved
earnings, explain a license, and help initiate a consent change.

The agent may not accept material licensing terms, change compensation
policy, or fabricate earnings.

## External / legal dependencies

- Counsel-confirmed information-rights and data-licensing terms
- Privacy review and jurisdiction policy
- Live buyer / researcher onboarding
- Production consent and vault operations
- Live fiat rails and native-asset production authority

These remain `RESEARCH_REQUIRED`. Engineering completion is not
production legal or privacy authorization.

## Production gates

`PRODUCTION_ACTIVE=false`
`LIVE_CONNECTIVITY_ENABLED=false`
`MARKETPLACE_LEGAL_STATUS.counselConfirmed=false`
`unrestrictedPersonalDataSale=false`
`compensationGuaranteed=false`
`marketplaceCanMint=false`
