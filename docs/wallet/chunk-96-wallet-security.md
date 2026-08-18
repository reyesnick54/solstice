# Chunk 96 — SunRey advanced wallet security

Capability `sunrey-wallet-security` is `IMPLEMENTED` at
`packages/sunrey-chain/src/wallet/security`. It extends Chunk 46
sovereign wallets. It does not create a second wallet ledger, identity
system, custody plane, key provider, or authorization root.

Wallet balances remain canonical SunRey Blockchain state. Fiat balances
remain the canonical Ledger. Private keys are never exposed to SunRey
application servers unless the existing custody architecture already
owns that key under an approved provider model.

## Wallet classes

Existing Chunk 46 `WalletType` values remain canonical. Chunk 96 adds a
locked custody class that is never silently converted:

- `SELF_CUSTODY`
- `ASSISTED_SELF_CUSTODY`
- `INSTITUTIONAL_CUSTODY`
- `MACHINE_CONTROLLED`
- `DELEGATED_AGENT`

## Authentication versus signing

Application authentication (passkeys, device authentication, approved
MFA, recovery authentication) opens a `WalletSession`. Blockchain
transactions still require canonical signing authority. Logging into the
SunRey app is not equivalent to signing a blockchain transaction.

## Formal result

Bounded model `WALLET_AUTHORIZATION_SAFETY` is
`VERIFIED_WITHIN_MODEL_BOUNDS`. See
[`../architecture/chunk-96-wallet-security.md`](../architecture/chunk-96-wallet-security.md).
