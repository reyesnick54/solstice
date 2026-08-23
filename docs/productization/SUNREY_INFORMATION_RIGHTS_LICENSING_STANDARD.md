# SunRey Information Rights Licensing Standard

Binding productization standard for licensing approved data rights and
derived / aggregated information products.

Companion to:

- `docs/productization/PHASE_H_04_INFORMATION_RIGHTS_MARKETPLACE.md`
- `docs/architecture/information-right-market.md`
- `packages/information-market/src/rights-marketplace/`

This is not legal advice and not production authorization.

`PRODUCTION_READY=false`
`PRODUCTION_ACTIVE=false`
`LIVE_CONNECTIVITY_ENABLED=false`

## Principle

The marketplace licenses **authorized use**, not people and not raw
personal databases.

An Information Right is a usage right. `ownershipTransferred` is always
false. Consent, purpose, scope, privacy, duration, terms, and
compensation must be explicit.

## Required license fields

Every license must name:

1. licensee
2. data product
3. purpose
4. scope
5. duration
6. query / download limits
7. redistribution prohibition
8. retention
9. compensation policy version
10. revocation rules
11. terms version
12. status

## Purpose firewall

A license approved for one purpose does not inherit another.

`RESEARCH` does not authorize `MARKETING`.
`RESEARCH` does not authorize `CREDIT_DECISIONING`.

Wrong purpose is a first-class refusal (`PURPOSE_MISMATCH`).

## Access

Licensees receive one of:

- controlled API
- secure export
- approved query system
- privacy-preserving aggregate output

Licensees never receive general database credentials.

Raw vault records, raw genetic data, and unrestricted sensitive
advertising remain refused products.

## Aggregation and privacy

Aggregated products must enforce:

- minimum cohort size
- suppression below threshold
- category restrictions
- query limits
- re-identification controls

Do not claim formal differential privacy unless a validated
implementation exists. The current product sets
`differentialPrivacyClaimed=false`.

Sensitive categories require stricter thresholds and cannot be licensed
for heightened purposes without separate authorization.

## Compensation

Compensation is allocated from a **versioned policy**. Shares are
integer basis points and must sum to 10_000.

Do not hardcode percentages as approved economic policy.
Do not describe compensation as guaranteed.

Fiat uses the canonical Ledger / payments path.
Native-asset compensation uses Phase G native-asset authority.
The marketplace must not mint.

Duplicate usage events must not pay twice.

## Revocation

If consent or contract permits revocation:

- future access stops
- historical lawful usage may be retained
- remaining obligations and any deletion duty are recorded

## Surfaces

Consumer BFF shows rights, permissions, licenses, earnings, and
pause / withdraw. It does not expose licensee controls.

Developer marketplace APIs are separate and privileged.

Agents may explain and help initiate a consent change. Agents may not
accept material terms, change compensation policy, or fabricate
earnings.

## Production

Engineering completion is not live data monetization.
Unknown corridors remain `RESEARCH_REQUIRED` and disabled.
