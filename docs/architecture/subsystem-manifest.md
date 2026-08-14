# Solstice subsystem manifest

This file names extractable subsystems and the event that forces a
subsystem to be split out of the monolith. Extraction is a security and
licensing event, not a refactoring convenience.

| Subsystem | Package path | Extracted | Extraction trigger | Review required before implementation |
| --- | --- | --- | --- | --- |
| Compliance Kernel | `packages/kernel` | no | First non-simulation policy pack marked for production use | Counsel |
| Universal Ledger Fabric | `packages/ledger` | no | First durable (non-heap) journal store | Architecture |
| Payments / rails | `packages/payments` | no | First live rail flag (forbidden in this build) | Counsel + payments |
| Personal Economy Agent | `packages/agent` | no | First additional runtime port beyond context/claims/mandates | Architecture (isolation) |
| **Crypto-custody** | `packages/crypto-custody` | **no** | **First introduction of real MPC, HSM, seed phrase, private key, or a non-simulated wallet provider. Also triggered by any plan to generate, import, export, or persist key material.** | **Security specialist. No implementation of real key material is permitted before that review is recorded.** |
| PYR ledger | `packages/pyr-ledger` | no | First durable PYR store or any live crypto flag (forbidden) | Counsel + ledger |
| Data exchange | `packages/data-exchange` | no | First live data-market flag (forbidden) or cross-cell raw data movement | Counsel + privacy |
| Proof of Contribution | `packages/proof-contribution` | no | First non-simulated chain submission | Counsel + architecture |
| Consent Ledger | `packages/consent` | no | First durable consent store spanning cells | Privacy + counsel |
| Clean Room | `packages/clean-room` | no | First compute job that leaves the in-process simulator | Privacy + security |
| Chain gateway | `packages/chain-gateway` | no | First contact with a node, RPC, testnet, or wallet provider (forbidden while `LIVE_CRYPTO_ENABLED` is false) | Security + architecture |

## Crypto-custody boundary (this phase)

`packages/crypto-custody` exposes a `CustodyProvider` interface and a
`SimulatedCustodyProvider` only.

The interface **must not** grow methods named or equivalent to
`importSeed`, `exportKey`, `generateMnemonic`, `connectWallet`, or
`signWithHsm` until the extraction trigger fires and a security
specialist has recorded a review.

Simulation holds only in-memory balance references. It does not hold
keys. There is no key material in this repository.

## Flags

`LIVE_CRYPTO_ENABLED` and `LIVE_DATA_MARKET_ENABLED` stay `false`.
Flipping either is a product decision reviewed under `config/` CODEOWNERS,
not an implementation convenience.
