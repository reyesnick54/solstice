# Chunk 36R — SunRey validator control plane

Implemented after Chunks 32R–35R landed on `main` and the prior
Chunk 36 documentation-only gate was recorded.

The earlier stop is historical: [`chunk-36-stop.md`](./chunk-36-stop.md).

Canonical owner remains `packages/sunrey-chain`. The runtime lives
in `packages/sunrey-chain/node`. Do not create `packages/validators`,
`packages/staking`, `packages/validator-v2`,
`packages/consensus-engine`, or `packages/tendermint`.

## What this resume implements

- Named development validators with separated consensus and proposal
  keys (ADR-0018).
- Integer voting power and `SimulationBond` units. Bonds are not
  Money and are not customer assets.
- Epoch-boundary validator-set transitions. The committed
  validator-set hash does not change mid-height.
- Historical set lookup by offense height, so later key rotation
  cannot rewrite the verification key for old evidence.
- Four-validator development genesis used by Chunk 39.

## What this resume does not implement

- A public staking product or validator market.
- Production BFT networking as a licensed network.
- MoonRey issuance.
- Automatic unjail / rehabilitation. Tombstone recovery requires a
  later explicit governance rule.

`ENVIRONMENT` remains `simulation`. Every `LIVE_*` flag remains
false. Legal confidence remains `RESEARCH_REQUIRED`.
