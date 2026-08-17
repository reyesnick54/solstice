# Chunk 54 — SunRey validator operator infrastructure

Owner: `packages/sunrey-chain` (`src/ops`, `node/src/ops.rs`).

This chunk builds the secure operational platform around the existing
validator registry (36R), BFT engine (37–38), signer safety, P2P,
governance (40), testnet, remote-signer interface, and CryptoSuite.
It does not create a second consensus engine or validator registry.

Capability `sunrey-validator-operations` is `IMPLEMENTED` on that
owner. `evaluateChunkRequirements` returns `mustStop: false`.

Do not create `packages/sunrey-ops`, `packages/validator-ops`,
`packages/sentry`, or `packages/remote-signer`.

## Trust zone

A validator node is a high-security trust zone. It must not host a
public web UI, Explorer, faucet, customer API, exchange matching, or
custody operations. Ordinary RPC binds locally or to a private
operator network. Public RPC lives on non-validator nodes.

## Sentry topology

Internet / broader P2P → sentry nodes → validator node.

At least two sentries are required. Sentries gossip and relay. They
have no consensus voting key. A compromised sentry cannot forge
validator votes.

## Remote signer

The reserved `REMOTE_SIGNER` provider is completed for validator use.

- Authenticated encrypted transport: mTLS or Unix-domain socket
- Validator client authentication
- Request policy: network, chain, validator ID, height, round, step,
  canonical bytes, CryptoSuite, validator-set context
- Signing through the configured CryptoSuite provider
- Private key bytes never leave the provider

## Double-sign database

Signer-safety state is critical security data: atomic storage, backup
with a high-watermark integrity record, restore verification, and
monotonicity checks. A restore must never roll signer safety
backwards.

Exactly one signing authority may be active for one consensus key.
Fencing/leases prevent two regions from signing simultaneously.

## Operator workflows

`sunrey-ops` automates key generation, epoch-based rotation, join,
exit, replacement, jail inspection, snapshots, state sync, and
upgrade precheck. No local command can erase finalized evidence.

## Upgrades

Running a newer binary does not change consensus rules. Governed
activation still occurs at the authorized height from Chunk 40. A
seven-validator rolling deployment keeps old rules until `H`, retains
quorum, and lets a lagging node catch up.

## What this chunk does not implement

- Production mainnet operations
- A second validator registry or consensus engine
- Public staking or customer-asset slashing
- Live bank, FX, or payment connections
- Counsel-confirmed policy

`ENVIRONMENT` remains `simulation`. Every `LIVE_*` flag remains false.
