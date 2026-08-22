# Phase D Prompt 3 — Compliance provider adapters

Identity verification, KYC, KYB, sanctions, PEP, adverse media, AML,
fraud, and Travel Rule adapter contracts. Simulation / sandbox only.

This is not production authorization and not a second compliance engine.

`PRODUCTION_READY=false`
`PRODUCTION_ACTIVE=false`
`LIVE_CONNECTIVITY_ENABLED=false`
`LIVE_EXTERNAL_KYC=false`
`ENVIRONMENT=simulation`

## Canonical owners

| Concern | Owner | Adapter path |
| --- | --- | --- |
| Identity / KYC / document / KYB | `packages/identity` | `src/production-candidate` |
| Sanctions / PEP / adverse media / AML / fraud / findings / cases | `packages/kernel/src/compliance` | `src/compliance/production-candidate` |
| Travel Rule | `packages/custody` | `src/production-candidate` |
| Provider runtime lifecycle | `packages/sunrey-chain/src/provider-runtime` | binding only |
| Consumer-safe states | `services/api` consumer BFF | `identityVerification` |
| Facade | `services/compliance` | re-exports |

Forbidden parallel packages were not created: `packages/compliance`,
`packages/kyc`, `packages/aml`, `packages/sanctions`.

Chunk 152 fixture adapters remain. This layer productizes
provider-independent contracts on top of those owners.

## Critical path

```
provider result
  → normalized compliance finding
  → Compliance Fabric / policy
  → automated allowed policy or human review
  → Kernel decision
  → evidence
```

A provider `MATCH` is not a Kernel `ALLOW` or a prohibition decision.
Sandbox `VERIFIED` is never production KYC.

## Status

| Surface | Status |
| --- | --- |
| KYC adapter | IMPLEMENTED simulation contract (`createApplicant`, start, retrieve, webhook, refresh, evidence refs) |
| Document verification | IMPLEMENTED simulation contract; images rejected; storage refs only |
| KYB adapter | IMPLEMENTED separate from individual KYC |
| Sanctions | IMPLEMENTED `NO_MATCH` / `POSSIBLE_MATCH` / `CONFIRMED_MATCH` / `REQUIRES_REVIEW` |
| PEP / adverse media | IMPLEMENTED optional findings |
| AML / transaction monitoring | IMPLEMENTED signals → finding / alert / case; no ledger edit |
| Fraud / risk signals | IMPLEMENTED score + recommended action; Kernel remains decisive |
| Travel Rule | IMPLEMENTED applicability-driven contract |
| Kernel / case integration | IMPLEMENTED via `ComplianceProviderOrchestrator` |
| Privacy / webhooks / lifecycle | IMPLEMENTED |
| Certification suites | IMPLEMENTED |
| BFF client states | `NOT_STARTED` / `IN_PROGRESS` / `ACTION_REQUIRED` / `VERIFIED` / `REVIEW` |
| Production | disabled |

## Failure behavior

Required screening outage is fail-closed:

- `TEMPORARILY_UNAVAILABLE`
- `REQUIRES_REVIEW`
- `BLOCK`

Never automatic `ALLOW`.

## Real partners still required

No live KYC, KYB, sanctions, PEP, adverse-media, AML, fraud, or Travel
Rule vendor is connected. Certification, DPA, jurisdictional coverage,
and counsel review remain outstanding. See
[SUNREY_COMPLIANCE_PROVIDER_ONBOARDING_CHECKLIST.md](./SUNREY_COMPLIANCE_PROVIDER_ONBOARDING_CHECKLIST.md).

## Regulatory dependencies

- Unknown corridors stay `RESEARCH_REQUIRED` and disabled
- Travel Rule packs stay `RESEARCH_REQUIRED`
- No policy rule is `CONFIRMED_BY_COUNSEL`
- Human review remains required for hard sanctions matches
- Country-specific regulatory logic stays in the Kernel, not adapters

## Validation

Prompt 3 adapter, Kernel, identity, and Exchange eligibility suites
pass in this revision. Production remains disabled.

Pre-existing `main` breakage outside this prompt still blocks a full
productization preflight (`docs/architecture/manifest.json` duplicate
`npmName`) and some consumer/payments files that do not parse. Those
are not a second compliance engine and are not required to use these
adapter contracts.

`SAFE_TO_PROCEED_TO_PHASE_D_PROMPT_4=true`
