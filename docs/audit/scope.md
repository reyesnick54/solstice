# Security review scope

Machine-readable source: `packages/sunrey-chain/audit/audit-scope.yaml`
and `packages/sunrey-chain/src/audit/scope.ts`.

## Domains

| Domain | Canonical owner |
| --- | --- |
| CONSENSUS | `packages/sunrey-chain/rust/crates/consensus` |
| PROTOCOL_ENCODING | `packages/sunrey-chain/src/protocol` |
| CRYPTOGRAPHY | `packages/security` |
| PQC | `packages/security` |
| WALLETS | `packages/sunrey-chain/src/wallet` |
| VALIDATORS | `packages/sunrey-chain/src/ops` |
| NATIVE_ASSETS | `packages/sunrey-chain/src/native-assets` |
| MOONREY_ISSUANCE | `packages/sunrey-chain/src/productive` |
| EXCHANGE | `packages/sunrey-exchange` |
| CUSTODY | `packages/custody` |
| ORACLES | `packages/sunrey-chain/src/oracle` |
| MACHINE_ECONOMY | `packages/sunrey-chain/src/machine-economy` |
| INTEROPERABILITY | `packages/sunrey-chain/src/interop` |
| PRIVACY | `packages/personal-data-vault` |
| SUPPLY_CHAIN | `packages/sunrey-chain/src/supply-chain` |
| OPERATIONS | `packages/sunrey-chain/src/ops` |

Alternate subsystem owners are not invented. Paths are the current
canonical implementations.
