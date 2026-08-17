# Trust boundaries

Source: `packages/sunrey-chain/src/audit/trust-boundaries.ts`.

| Boundary | May contain secrets | Owner |
| --- | --- | --- |
| validator | yes | `packages/sunrey-chain/src/ops` |
| remote signer | yes | `packages/sunrey-chain/src/ops/signer.ts` |
| sentry | no | `packages/sunrey-chain/src/ops/sentry.ts` |
| public RPC | no | `packages/sunrey-chain/rust/crates/rpc` |
| SDK | no | `packages/sunrey-sdk` |
| wallet signer | yes | `packages/sunrey-chain/src/wallet` |
| custody HSM | yes | `packages/custody/src/institutional` |
| Exchange | no | `packages/sunrey-exchange` |
| oracle provider | yes | `packages/sunrey-chain/src/oracle` |
| relayer | no | `packages/sunrey-chain/src/interop` |
| Explorer | no | `packages/sunrey-explorer` |
| Personal Data Vault | yes | `packages/personal-data-vault` |
| Clean Room | yes | `packages/clean-room` |
| governance authority | yes | `packages/sunrey-chain/src/governance` |
| release authority | yes | `packages/sunrey-chain/src/supply-chain` |

Sentry, public RPC, SDK, Exchange, relayer, and Explorer must not hold
validator or custody private keys.
