# Chunk 97 — SunRey mobile wallet synchronization

Canonical implementation: `packages/sunrey-chain/src/wallet/mobile-sync`.

Capability `sunrey-mobile-wallet-sync` extends Chunk 46 sovereign wallets,
Chunk 51 SDK, Chunk 93 public RPC/finality, Chunk 94 developer APIs, and
Chunk 96 device registration/trust. It does not create another wallet
authority or a second balance ledger.

## Sync model

Mobile clients may hold user-controlled signing keys according to wallet
class. Backend sync servers never obtain self-custody master private keys.

Canonical chain state comes from Chunk 93 RPC and finality interfaces.
`WalletStateProjection` is rebuildable and explicitly `authoritative: false`.
A device cache cannot override chain state.

Fiat/account products, when present, are read from canonical Ledger APIs
and are never merged with native chain balances.

## Snapshot + delta

`WalletSyncSession` authenticates a trusted device.

`WalletSyncCursor` binds network, chain, wallet, finalized height,
projection sequence, and schema version. An initial sync returns
`WalletSyncSnapshot`. Later syncs return an ordered `WalletEventStream`.
A detected event gap forces rebuild from canonical APIs.

## Multi-device

Authorized devices synchronize independently. No device cache is
authoritative. A revoked Chunk 96 device loses authenticated sync access.

## CLI

```
sunrey-wallet sync
sunrey-wallet sync-status
sunrey-wallet sync-rebuild
sunrey-wallet push-test
sunrey-wallet payment-request
sunrey-wallet offline-draft
sunrey-wallet finality
```

See also:

- [Mobile finality](./mobile-finality.md)
- [Push security](./mobile-push-security.md)
- [Offline transactions](./offline-transactions.md)
- [Payment requests](./payment-requests.md)
- [Secure storage](./mobile-secure-storage.md)
