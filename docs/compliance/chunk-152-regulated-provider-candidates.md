# Chunk 152 — Regulated provider-candidate adapters

This chunk connects **fixture provider-candidate adapters** to existing
domain ports. It does not connect live vendors, make external network
calls, or replace the Compliance Kernel.

## Ownership

| Concern | Canonical owner |
| --- | --- |
| Identity / KYC facts | `packages/identity` |
| Compliance interpretation and gating | `packages/kernel` |
| Travel Rule custody workflow | `packages/custody` |
| Market surveillance | `packages/market-surveillance` |
| Provider acceptance | `packages/sunrey-chain/src/providers` |

Capability `sunrey-regulated-provider-candidates` records this
integration. It does **not** replace `identity`, `compliance-screening`,
`custody`, or `market-surveillance`.

## Architecture

```
External Provider Candidate
        ↓
Credential-Bound Adapter
        ↓
Domain Port
        ↓
Normalized Provider Result
        ↓
Canonical Identity / Compliance Fabric
        ↓
Compliance Kernel
        ↓
ALLOW / HOLD / BLOCK / DEFER / MANUAL REVIEW
        ↓
Execution Authority only where existing architecture permits
```

Provider output never directly issues Execution Authority.

## Invariants

- `UNAVAILABLE`, timeout, schema error, authentication failure, and
  unknown results are never rewritten to `CLEAR`.
- A vendor score is evidence only. It is not a Kernel decision, credit
  score, human-worth score, PEVE value, or SunRey valuation.
- KYC `VERIFIED` does not open an account, enable payments or trading,
  or issue Execution Authority.
- Raw passport, national-ID, driver-license, selfie, liveness video, and
  biometric templates are not persisted in Identity.
- Travel Rule payloads are envelope-encrypted, purpose-bound, and
  recipient-bound. They are not placed on SunRey Chain or in ordinary
  event metadata. An acknowledgement does not authorize withdrawal.
- External surveillance signals create alerts or restriction proposals
  only. They do not cancel orders, freeze wallets, seize balances, or
  block accounts.
- AI, S3M, and Grok cannot satisfy `COUNSEL_REVIEWER`,
  `SECURITY_REVIEWER`, `OPERATIONS_REVIEWER`, or `COMMERCIAL_REVIEWER`.
- `LIVE_EXTERNAL_KYC` remains `false`. `productionAuthorized` remains
  `false`.

## Fixtures

`fixture-identity`, `fixture-sanctions`, `fixture-pep`, `fixture-aml`,
`fixture-travel-rule`, and `fixture-surveillance` are fake providers.
They contain no real person or vendor data.
