# Chunk 139 — HIN → SunRey Chain anchoring foundation

Canonical HIN owner: `packages/information-market` at
`packages/information-market/src/network/chain-anchor`.

Canonical blockchain owner remains `packages/sunrey-chain`.

Capability `sunrey-hin-chain-anchoring` is `PARTIAL`. Chunk 140
completes lifecycle, finality, and reconciliation.

See
[`docs/economics/chunk-139-hin-chain-anchor-foundation.md`](../economics/chunk-139-hin-chain-anchor-foundation.md).

## Authority rule

Human Information Network remains the legal source of information
rights. SunRey Chain stores privacy-safe evidence of those rights.
A chain anchor does not transfer ownership and does not mint.

```
CHAIN_ANCHOR_IS_RIGHTS_EVIDENCE=true
CHAIN_ANCHOR_TRANSFERS_OWNERSHIP=false
```

## What it implements

- `HumanInformationChainAnchorPort`
- `HinChainAnchorAdapter` over existing `SunReyChainService`
- Deterministic privacy-safe `ChainRecordSchema` builders
- `HumanInformationChainAnchorRecord` stored separately from historical HIN records
- `demo:sunrey-hin-chain-anchor-foundation`

## What it does not do

- Create a second blockchain or chain service
- Create another consent ledger or Evidence Vault
- Rewrite historical consent, right, usage, or revocation records
- Mint SunRey or MoonRey
- Invent settlement references
- Require finality (Chunk 140)
