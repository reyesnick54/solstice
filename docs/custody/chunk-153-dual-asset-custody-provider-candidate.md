# Chunk 153 — Dual-native-asset custody hardening

SunRey Chain has two native assets: `SUNREY_COIN` and `MOONREY_COIN`.
Institutional custody must support both without a second custody stack.

## Owners

| Concern | Owner |
| --- | --- |
| Custody control plane | `packages/custody` |
| HSM / KMS / credentials | `packages/security` |
| Canonical native state / supply | `packages/sunrey-chain` |
| Exchange reservations / DVP | `packages/sunrey-exchange` via `ExchangeCustodyPort` |

Do not create `packages/moonrey-custody`, `packages/sunrey-custody-v2`,
`packages/key-vault`, `packages/hsm-v2`, `packages/mpc-v2`, or
`packages/custody-provider-v2`.

## Native asset type

`NativeCustodyAssetId` reuses `NativeAssetId` from
`packages/sunrey-chain/src/protocol/assets.ts`:

- `SUNREY_COIN`
- `MOONREY_COIN`

Lowercase duplicates are forbidden.

## Version-safe institutional records

| schemaVersion | Meaning |
| --- | --- |
| 1 | Historical SunRey-only compatibility. Not reinterpreted. |
| 2 | Dual native assets. Vaults may authorize one or both. |

A wallet binds `walletId`, `vaultId`, `assetId`, `address`, `network`,
`chainId`, `signerHandle`, security tier, and `createdAt`. The wallet
asset cannot mutate after creation. One chain address may hold both
assets at the protocol layer; a custody wallet still binds one asset.

## Position isolation

`InMemoryCustomerAssetPort` keys positions by `ownerId + assetId`.
There is no `lastAssetId`. `position(ownerId, assetId)` is required.
Holds carry `assetId`. Debit requires `amount.assetId === hold.assetId`.

One owner may hold `100 SUNREY_COIN` and `200 MOONREY_COIN` concurrently.
Those positions must not overwrite each other.

## Exchange / DVP

SunRey Exchange reservations are asset-specific. DVP debits the reserved
asset only. Cross-asset debit is rejected.

`DerivedPosition` v2 includes `assetId` and `notALedgerBalance: true`.
Custody / on-chain position is not the fiat customer ledger.

## Provider candidate

`packages/custody/src/provider-candidate/` is a production-candidate
framework. Existing `CustodyProviderPort` remains `SIMULATION_ONLY`.

Transports are `FixtureCustodyTransport` and
`ScriptedCustodySandboxTransport` only. No vendor SDK. No real custody
API.

Submission states:

`NOT_SUBMITTED`, `SUBMITTED`, `PENDING`, `FINALIZED`, `REJECTED`,
`SUBMISSION_UNKNOWN`, `RECONCILIATION_REQUIRED`.

`SUBMISSION_UNKNOWN` after a withdrawal timeout must query the provider
and chain before retry. A second withdrawal is never submitted blindly.

A provider deposit callback is evidence. Credit requires an authentic
callback, transaction reference, asset, quantity, destination mapping,
chain finality, and reconciliation. Callbacks do not credit customer
balances by themselves.

Provider operational balance is reconciliation evidence. It is not
`AssetSupplyBook`, native supply, or a customer fiat ledger balance.
Reconciliation reports mismatch. It does not auto-correct chain state
or ledger balances.

## HSM / KMS

Institutional signing keys are `exportable = false`. Private material
never leaves the HSM/KMS boundary. Key origin is explicit:
`GENERATE_IN_HSM`, `IMPORT_WRAPPED_KEY`, `EXTERNAL_MPC_KEY`,
`COLD_OFFLINE_KEY`. Plaintext import is not silently permitted.

Software fixture attestation is not hardware attestation.

Workload binding:

- `custody_worker` cannot use governance KMS
- `oracle_collector` cannot use custody HSM

AI may propose a rebalance. AI cannot approve a withdrawal, sign, modify
an allowlist, reduce quorum, or disable a cooling period.

## Production posture

`productionAuthorized: false`. `LIVE_CRYPTO_ENABLED` remains `false`.
Capability `sunrey-dual-asset-custody-provider-candidate` is
`IMPLEMENTED` on `packages/custody`.
