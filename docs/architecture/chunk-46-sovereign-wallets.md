# Chunk 46 — SunRey sovereign wallets, addresses, and recovery

Implemented on latest `main` after Chunk 45. Canonical owner remains
`packages/sunrey-chain`.

- TypeScript engine: `packages/sunrey-chain/src/wallet/`
- Rust primitives and CLI: `packages/sunrey-chain/rust/crates/wallet`
- Node RPC: `/wallet/*` on the local development API
- CLI: `sunrey-wallet …`
- Demos: four-validator transfer, 2-of-3 multi-auth, height-delayed
  recovery, CryptoSuite migration

Do not create `packages/wallet-v2`, `packages/blockchain-wallet`,
`packages/crypto-wallet`, or `packages/sunrey-wallet-ledger`.

Chunk 100 can project privacy-minimized Human Information mobile
events (new request, consent, usage receipt, compensation,
revocation, security) onto the wallet/mobile surface. Payloads never
include legal name or raw personal data.

## Account distinction

A `BlockchainAccount` is not a bank deposit, brokerage, card, or
`packages/domain` Account. Native SunRey Coin and MoonRey Coin balances
remain canonical blockchain state. Wallet metadata must never become a
second ledger. The fiat Ledger is unchanged.

## Address format

SunRey Address v1:

- canonical binary: 42 bytes (`SR` + version + network class +
  address class + algorithm + 32-byte payload + 4-byte SHA-256 checksum)
- canonical text: `{hrp}1{base32}` with HRP `srdev` / `srtst` / `srprd`
- maximum text length: 90
- payload is SHA-256 of the public-key or account descriptor
- algorithm is versioned (`ED25519_V1`, `HYBRID_SIM_V1`, `PQ_SIM_V1`)
  and is not frozen forever

Wrong-network and checksum failures are rejected.

## Wallet and authorization

`WalletDescriptor` holds identity, network, account descriptors, crypto
policy, and recovery policy references. It never stores private keys.

Authorization policies: `SINGLE_SIGNATURE`, `M_OF_N`, `ROLE_BASED`,
`OWNER_PLUS_RECOVERY`, `INSTITUTIONAL_POLICY`, `MACHINE_MANDATE`.
Thresholds are integers. Duplicate and unauthorized signers are
rejected.

## Recovery and rotation

Recovery is a provider abstraction. Classical mnemonic / hierarchical
schemes are an optional adapter, not the protocol. Guardians do not
receive everyday spend. Optional delay is measured in protocol height.

Key rotation requires current authorization. Old keys become historical
for new transactions. Historic signatures remain verifiable.

## Machine mandates

Machine accounts consume Chunk 45 `MachineEconomicIdentity` and
spending/resource mandates. The wallet layer cannot bypass them.

## Development posture

Simulation only. Public tickers remain `NOT_ASSIGNED`. Production
network activation is out of scope.
