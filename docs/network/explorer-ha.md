# Explorer high availability

Explorer is a rebuildable projection of finalized chain data. It is
never an authoritative database.

## Indexer fleet

Each `ExplorerIndexer` member tracks:

- source node
- finalized height
- indexed height
- lag
- projection version
- health

A new indexer rebuilds from canonical chain data. Checkpoint mismatch
requires rebuild; the chain is never repaired from the index.

## Consistency

`ExplorerIndexerFleet.compare()` detects projection divergence.
Canonical chain remains the source of truth.

## Query failover

`ExplorerQueryApi` fails over between healthy projections, preferring
the lowest lag. Corrupt or down members are excluded.

## Public data

Public projections may show blocks, transactions, accounts, native
asset activity, fees, validators, governance, MoonRey issuance
provenance, protocol treasury, capability status, and network phase.

Human Information may show only privacy-safe rights and attestation
metadata already approved for public chain exposure. Machine-economic
activity follows the canonical public classification. Exchange market
data may be referenced when that capability is active; it is not
authoritative chain state.
