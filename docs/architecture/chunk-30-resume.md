# Chunk 30R — SunRey Exchange control plane

Implemented after Chunks 26R–29 marked SunRey Coin, the information
market, SunRey Chain, and SunRey Exchange core `IMPLEMENTED` on green
`main`.

Owners:

- `packages/custody` — provider-neutral simulation custody, external
  deposit ingestion, Kernel-gated credit, destinations, Travel Rule
  applicability, encrypted Travel Rule payloads, withdrawals,
  `SUBMISSION_UNKNOWN`, and custody reconciliation
- `packages/market-surveillance` — deterministic detectors, alerts,
  canonical compliance cases, restriction proposals
- `packages/sunrey-exchange` — versioned listing decisions and
  independent kill switches

Canonical Ledger remains customer-accounting truth. Simulation
providers only. No `LIVE_APPROVED` listing. AI cannot approve
listings, disable kill switches, or punish participants.

This is not a licensed exchange, registered VASP, Travel Rule
compliance program, or regulated market-surveillance system.
Policy thresholds are `RESEARCH_REQUIRED`.

Do not create `packages/custody-ledger`, `packages/travel-rule-v2`,
`packages/crypto-aml`, `packages/surveillance-v2`, or
`packages/exchange-compliance-v2`.
