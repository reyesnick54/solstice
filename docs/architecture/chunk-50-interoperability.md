# Chunk 50 — SunRey sovereign interoperability gateway

Implemented on latest `main` after Chunks 40–45. SunRey Blockchain
remains the sovereign authoritative base layer for SunRey economic
state. External chains may interoperate. They are not SunRey's
authoritative source of truth.

Canonical owner remains `packages/sunrey-chain`.

- TypeScript engine: `packages/sunrey-chain/src/interop/`
- Local-node module: `packages/sunrey-chain/rust/crates/interop`
- CLI: `sunrey-node interop …`
- Relayer: `sunrey-relayer run`

Do not create `packages/ibc`, `packages/bridge`, `packages/interop`,
`packages/light-client`, or `packages/relayer`.

## Core principle

Interop is independently verified foreign-chain headers, membership
proofs, explicit connections and channels, replay-protected packets,
fail-closed timeouts, and untrusted relayers.

There is no trusted-multisig lock-and-mint bridge. There is no
wrapped fiat. A user-supplied endpoint does not register a chain.

## What this chunk implements

- Governed `ExternalChainDefinition` registry
- `LightClient` with initialize / verify header / membership /
  non-membership / finality / misbehavior
- Fully implemented `SIMULATED_DETERMINISTIC_BFT_EXTERNAL_CHAIN`
- Rigorous interfaces (not pretend verification) for other finality
  models
- IBC-class connection handshake `INIT → TRY → ACK → CONFIRM`
- Typed channels and packet lifecycle
- Isolated `RelayerPort` with no validator or governance keys
- `DEV_INTEROP_TEST_ASSET` supply invariant
- Oracle-fact and identity-attestation ports that do not auto-trust
- Derived `InteropSecurityProfile` (not an absolute security claim)

## What this chunk does not implement

- Production interoperability or a live bridge
- Wrapped fiat or arbitrary foreign mint
- Production SunRey Coin or MoonRey Coin interop
- Counsel-confirmed policy (`RESEARCH_REQUIRED`)

`ENVIRONMENT` remains `simulation`. Every `LIVE_*` flag remains false.
