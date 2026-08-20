# Chunk 161 — Jurisdictional operating scope matrix

This is a **readiness / operating-scope control plane**. It is **not
legal advice**. Software capability never infers regulatory permission.

Capability: `sunrey-production-operating-scope`

Canonical owner: `packages/sunrey-chain` under mainnet readiness at
`packages/sunrey-chain/src/mainnet/operating-scope`.

Do not create `packages/licensing`, `packages/global-regulation`,
`packages/country-law`, or `packages/legal-engine`.

## What this answers

**Where**, and **for which product / capability**, SunRey has evidence
to operate.

Operating eligibility is keyed by jurisdiction, activation domain,
legal-entity reference, provider dependencies, and — where relevant —
customer class, currency/corridor, and native asset. There is no global
`licensed=true` boolean.

## Status model

`RESEARCH_REQUIRED`, `EVIDENCE_REQUIRED`, `UNDER_REVIEW`,
`ENGINEERING_READY`, `EXTERNALLY_VERIFIED`, `HUMAN_APPROVAL_REQUIRED`,
`ELIGIBLE_CANDIDATE`, `DISABLED`, `EXPIRED`, `REVOKED`.

Unknown jurisdiction: `RESEARCH_REQUIRED` and unavailable.
Unknown corridor: disabled.
Missing evidence: disabled.
No permissive defaults.

## Evidence binding

Chunk 160 owns the external evidence registry. This module consumes
references. Evidence belonging to Entity A does not authorize Entity B.
Fixture counsel opinions are insufficient. Engineering tests are not
legal approval. Provider technical health is not legal eligibility.
FX evidence cannot authorize a payment rail.

SunRey Coin and MoonRey Coin are independently scoped. Exchange
eligibility does not imply custody. Custody eligibility does not imply
native issuance. Blockchain anchoring is not HIN legal authorization.
A public productive data feed is not commercial monetary-use rights.

## Kernel

The module emits `OperatingScopeFact` (jurisdiction, activation domain,
eligibility, reason codes, evidence references). Kernel still decides.
This module cannot issue Execution Authority. The Regulatory Digital
Twin may simulate scope changes and cannot mark
`EXTERNALLY_VERIFIED`.

## Demo

```
npm run demo:sunrey-operating-scope
```

Expected flags:

```
UNKNOWN_JURISDICTION_ENABLED=false
ENGINEERING_TEST_EQUALS_LEGAL_APPROVAL=false
SUNREY_SCOPE_EQUALS_MOONREY_SCOPE=false
EXCHANGE_SCOPE_EQUALS_CUSTODY_SCOPE=false
AI_CAN_APPROVE_JURISDICTION=false
PRODUCTION_ACTIVE=false
```

Fixtures use ISO 3166-1 user-assigned codes `XA` / `XB` and are marked
`TEST_FIXTURE_NOT_LEGAL_CONCLUSION`. No repository legal position is
`CONFIRMED_BY_COUNSEL`.
