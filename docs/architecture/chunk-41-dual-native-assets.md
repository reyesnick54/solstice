# Chunk 41 — SunRey and MoonRey native asset protocol

Implemented on latest `main` after Chunks 32R–40. The deterministic
node, P2P plane, BFT finality, validators, governance, and
accountability already exist on `packages/sunrey-chain`. This chunk
does not create a competing blockchain.

Canonical owner remains `packages/sunrey-chain`.

- Protocol crate: `packages/sunrey-chain/rust/crates/native-assets`
- Local node execution: `packages/sunrey-chain/rust/crates/execution`
- Four-validator BFT: `packages/sunrey-chain/node`
- CLI: `sunrey-node asset …`

Do not create `packages/moonrey-coin`, `packages/sunrey-chain-v2`,
`packages/blockchain-runtime`, or an ERC-20 / EVM token package.

## Core principle

SunRey Coin and MoonRey Coin are distinct first-class
protocol-native assets. They are not ERC-20 tokens, Ethereum
contracts, or aliases of each other. Public tickers remain
`NOT_ASSIGNED`.

Development chain units live under
`NATIVE_BLOCKCHAIN_AUTHORITY`. Application SunRey Coin journals stay
under `CURRENT_APPLICATION_AUTHORITY` (`packages/sunrey-coin` +
canonical Ledger). This chunk does not import application supply
and does not perform a production migration.

## Registered assets

| Field | SunRey Coin | MoonRey Coin |
| --- | --- | --- |
| `asset_id` | `SUNREY_COIN` | `MOONREY_COIN` |
| Display name | SunRey Coin | MoonRey Coin |
| Asset class | `FUNGIBLE_NATIVE_ASSET` | `FUNGIBLE_NATIVE_ASSET` |
| Precision | 6 | 6 |
| Maximum quantity | `10^38 - 1` scaled units | `10^38 - 1` scaled units |
| Public ticker | `NOT_ASSIGNED` | `NOT_ASSIGNED` |
| Status | `ACTIVE` at height 0 | `ACTIVE` at height 0 |

Internal asset IDs are immutable. Display metadata may be versioned.

## Operations

Versioned, deterministic, signed, replay-protected, asset-typed,
bounded:

- `NATIVE_ASSET_TRANSFER`
- `NATIVE_ASSET_ISSUE`
- `NATIVE_ASSET_BURN`
- `NATIVE_ASSET_LOCK`
- `NATIVE_ASSET_UNLOCK`

Signatures route through `CryptoSuite` / `AssetCrypto` and
`CryptoPolicy` (`CLASSICAL` / `HYBRID` / `PQ`). Native asset code
does not hard-code Ed25519.

## Supply reconciliation

For each asset:

`issued - burned = circulating + locked`

Inconsistencies are consensus-critical. Quantity is never
auto-created to repair a mismatch.

## Issuance

SunRey native issuance consumes a typed `IssuanceAuthorization`.
It does not replace the application human-information contribution
model. MoonRey issuance requires
`MoonReyIssuanceAuthorityPort` and a verifiable economic
authorization artifact. Production MoonRey economics are Chunk 44.
Ordinary actors cannot arbitrarily issue either asset.
Development fixtures may issue `DEVELOPMENT_ECONOMIC_UNIT` /
`TEST` quantities through an explicit faucet.

## Development faucet

Available only when the network is development/simulation and
`production_network_enabled` is false. Transactions still finalize
through consensus. Production networks cannot invoke the faucet.

## What this chunk does not implement

- Production migration of application SunRey Coin
- Production MoonRey economic issuance (Chunk 44)
- Network fees (Chunk 42)
- Replacing SunRey Exchange `CoinPort`
- Public tickers
- Mainnet, live rails, or any `LIVE_*` flag
- `packages/moonrey-coin`

`ENVIRONMENT` remains `simulation`. Every `LIVE_*` flag remains false.
