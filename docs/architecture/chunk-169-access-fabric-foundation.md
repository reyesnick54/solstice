# Chunk 169 — SunRey Access Fabric Foundation (ACCESS-01)

Canonical owner: `packages/access-economy`.

Capability `sunrey-access-fabric` is `IMPLEMENTED` at foundation scope only.

This chunk freezes architecture, domain boundaries, and canonical ownership
for the Human Access Economy. It does not implement reservation, Exchange
integration, Kernel submission, settlement, or live provider connectivity.

See [`SUNREY_ACCESS_FABRIC.md`](./SUNREY_ACCESS_FABRIC.md).

## Authority rule

An `AccessRight` is not ownership, money, a security (by architectural
assumption), an `ActionIntent`, Execution Authority, a mint instruction, or a
settlement instruction. An `AccessIntent` is not an `ActionIntent`.

## What ACCESS-01 implements

- `AccessRight` and `AccessIntent` type contracts
- access capacity taxonomy aligned with productive categories
- structural invariants refusing ownership, mint, settlement, human-worth, and
  access-coin fields
- `AccessFabric` in-memory orchestration skeleton
- `ACCESS_ECONOMY_ISOLATION` boundary contract
- architecture guards and unit tests

## What ACCESS-01 does not implement

- Kernel `ActionIntent` conversion or policy packs
- Execution Authority issuance
- Exchange reservation or productive capacity auction
- Ledger, custody, or chain settlement
- delivery evidence binding to Evidence Vault
- Consumer BFF HTTP surface
- production activation or `LIVE_*` connectivity

Do not create `packages/access-fabric`, `packages/access-coin`,
`packages/access-exchange`, `packages/access-ledger`, or
`packages/access-economy-v2`.
