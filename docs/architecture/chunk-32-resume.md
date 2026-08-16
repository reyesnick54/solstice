# Chunk 32R — SunRey economic state machine and transaction protocol

**Status:** IMPLEMENTED.

**Supersedes:** `docs/architecture/chunk-32-stop.md` (historical
documentation-only process-gate record, PR `#59`).

That stop did not implement a transaction protocol. It recorded that
Chunk 31 architecture was not yet canonical. Chunk 31 is now on
`main` (ADR-0016–ADR-0033, authority matrix, protocol spec). This
resume implements the assigned engineering scope.

## Canonical owner

`packages/sunrey-chain` only.

Do not create `packages/sunrey-chain-v2`, `packages/sunrey-protocol`,
`packages/sunrey-tx`, `packages/moonrey`, or `packages/moonrey-coin`.

## What this chunk implements

- Versioned actor descriptors (HUMAN through ORACLE), referencing
  Identity/credential systems rather than rebuilding them
- Versioned economic objects (native asset through composite workflow)
- Explicit rights (`OWN` does not imply unlimited `USE`)
- Closed transaction-family enum with reserved / not-activated IDs
- Envelope v1 (`network_id`, `chain_id`, `codec_id`, `schema_version`,
  typed body, Ed25519 authentication)
- Deterministic Protocol Buffers proto3 codec (ADR-0021 Addendum A)
- Domain-separated SHA-256 hashes via `packages/security`
- Replay protection, rejection codes, and the
  `validateStateless` / `validateStateful` / `apply` port
- Language-neutral schema and test vectors under
  `packages/sunrey-chain/protocol/`

## What this chunk does not do

- Issue MoonRey Coin
- Assign a public ticker (`NOT_ASSIGNED`)
- Create a second Money primitive or a second SunRey Coin ledger
- Change current SunRey Coin supply
- Activate a production network
- Implement consensus, P2P, or a local node (Chunks 33–35)

SunRey Coin accounting authority remains the canonical Ledger
(ADR-0031). Transfer-shaped envelopes are protocol objects only.

## Codec

Protocol Buffers proto3 with a constrained deterministic encoder:

- ascending field tags
- no maps
- no floating point
- unknown fields rejected
- UTF-8 NFC strings
- explicit integer sizes and maximum field lengths

JSON exists only as a debug/API projection and is never hashed for
consensus.
