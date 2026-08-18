# Chunk 97 — SunRey mobile wallet synchronization

Capability `sunrey-mobile-wallet-sync` is `IMPLEMENTED` at
`packages/sunrey-chain/src/wallet/mobile-sync`.

It extends Chunk 46 wallets, Chunk 51 SDK, Chunk 93 public RPC, Chunk 94
developer APIs, and Chunk 96 device trust. Wallet projections are
rebuildable. Backend sync is not a second ledger and does not hold
self-custody master keys.

Do not create `packages/mobile-wallet-sync`, `packages/sunrey-mobile-sync`,
`packages/wallet-sync`, `packages/mobile-wallet-v2`, or
`packages/sunrey-push`.

Domain docs: [`docs/wallet/chunk-97-mobile-sync.md`](../wallet/chunk-97-mobile-sync.md).
