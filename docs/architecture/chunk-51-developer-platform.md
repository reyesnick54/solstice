# Chunk 51 — SunRey developer platform

Official developer interface to the SunRey ecosystem. A developer can
build an application without importing internal Rust crates or internal
TypeScript modules.

Canonical owner: `packages/sunrey-sdk`.

Business logic remains at:

- `packages/sunrey-chain`
- `packages/sunrey-exchange`
- `packages/custody`
- `packages/security`
- `packages/consent`
- `packages/clean-room`

The SDK is an adapter and client layer.

## Public API

- Version: `v1`
- Compatibility classes: `BACKWARD_COMPATIBLE`, `DEPRECATED`, `BREAKING_CHANGE`
- A protocol upgrade does not automatically imply an API breaking change
- Specs: `api/sunrey-chain-v1.openapi.yaml`, `api/sunrey-exchange-v1.openapi.yaml`, `api/sunrey-events-v1.md`

## Surfaces

- `PUBLIC_API` at `/v1`
- `OPERATOR_API` at `/operator/v1` with an operator token

Public RPC compromise cannot administer validators.

## Write principle

Public transaction APIs accept already-signed canonical envelopes.
Private keys never leave the injected local signer.

## Status model

`LOCAL_ONLY`, `SUBMITTED`, `MEMPOOL`, `INCLUDED`, `FINALIZED`,
`REJECTED`, `EXPIRED`, `UNKNOWN`.

`FINALIZED` is BFT finality. There are no probabilistic confirmations.

## What this chunk does not implement

- Production mainnet RPC
- Live exchange connectivity
- A second ledger, chain, or matching engine
- Exposure of Personal Data Vault, clean-room rows, or private consent payloads
