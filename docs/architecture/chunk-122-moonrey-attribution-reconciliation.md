# Chunk 122 — MoonRey attribution accounting and reconciliation

Canonical owner: `packages/sunrey-chain/src/productive/policy-governance`.

Capability `moonrey-policy-governance` remains `IMPLEMENTED`. This chunk
extends that owner. It does not create a second ledger capability.

See [`docs/economics/chunk-122-moonrey-attribution-reconciliation.md`](../economics/chunk-122-moonrey-attribution-reconciliation.md).

## Authority rule

`ProductiveAttributionBook` records which portion of a verified
productive event has already been assigned to which contribution. It
does not hold MoonRey balances, customer positions, or supply.

Reservation is required before any future Productive Value Function.
This chunk does not calculate productive value and does not change
MoonRey quantities.

## What it implements

- `ProductiveAttributionBook` with RESERVED / FINALIZED /
  RELEASED_BY_CORRECTION / SUPERSEDED entries
- bigint aggregate-share invariant
- deterministic reservation and idempotent retry
- replay protection from event identity and canonical normalization
- overlapping-window and batch split/merge handling
- correction / supersession without history deletion
- issuance-status awareness without performing valuation transitions
- `ProductiveAttributionReconciliationReport`
- attribution-sensitive eligibility gating
- optional Economic Asset Registry lineage reflection
