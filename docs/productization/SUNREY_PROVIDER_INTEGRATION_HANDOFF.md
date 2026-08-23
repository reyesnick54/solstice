# SunRey provider integration handoff

Definitive checklist for binding a selected vendor behind an existing
owner. This is not a vendor contract and not production authorization.

`PROVIDER_INTEGRATION_READY=true` means the backend does **not** need
architectural redesign for these classes. It does **not** mean a
vendor is selected or live.

`PRODUCTION_READY=false`
`LIVE_CONNECTIVITY_ENABLED=false`

Companion: `docs/productization/SUNREY_EXTERNAL_PROVIDER_INTEGRATION_PACKAGE.md`
and `docs/productization/SUNREY_PROVIDER_INTEGRATION_STANDARD.md`.

Canonical commands: `npm run provider:test` and `npm run provider:certify`.

| Provider class | Canonical owner | Interface | Backend redesign required? | Current class | Remaining external work |
| --- | --- | --- | --- | --- | --- |
| Bank / BaaS | `packages/payments` | banking provider-candidate + account references | no | SANDBOX_FUNCTIONAL | contract, license, sandbox→certification |
| Payments rail | `packages/payments` | `RailAdapter` | no | SANDBOX_FUNCTIONAL | network membership, sponsor bank |
| FX liquidity | `packages/payments` | `FxLiquidityProvider` | no | SANDBOX_FUNCTIONAL | liquidity contract; counsel corridor |
| Card issuer / processor | `packages/cards` | `CardProcessor` | no | SANDBOX_FUNCTIONAL | BIN, PCI, wallet certification |
| KYC / KYB | `packages/identity` provider-candidate | identity adapter | no | SANDBOX_FUNCTIONAL | vendor + counsel-confirmed program |
| AML / sanctions | `packages/kernel` compliance fabric | screening ports | no | SANDBOX_FUNCTIONAL | list provider, counsel review |
| Travel Rule | `packages/custody` | Travel Rule port | no | SANDBOX_FUNCTIONAL | network membership |
| Custody | `packages/custody` | custody provider-candidate | no | SANDBOX_FUNCTIONAL | qualified custodian |
| Blockchain analytics | `packages/kernel` provider-candidate | analytics port | no | SANDBOX_FUNCTIONAL | vendor + evidence policy |
| Market data | `packages/sunrey-exchange` `src/market-data` | quote/freshness port | no | SANDBOX_FUNCTIONAL | data license |
| Oracles | `packages/sunrey-chain` oracle production | signed facts; not money | no | SANDBOX_FUNCTIONAL | licensed feeds; no auto-mint |
| AI model provider | `packages/ai-runtime` | inference gateway | no | SANDBOX_FUNCTIONAL | production model contract; S3M-primary |

Shared binding rules:

1. Implement the SunRey interface. Do not rewrite domain logic around a vendor API.
2. Bind secrets through Chunk 149 (`packages/security/src/regulated/credentials`). Raw credentials never enter domain configuration.
3. Verify webhook signatures before mutation. Replay is rejected.
4. Regulatory compatibility is a filter, not a score.
5. Do not promote an adapter to `PRODUCTION` from this handoff.
6. Do not flip `LIVE_*`, `ENVIRONMENT`, `PRODUCTION_READY`, or `PRODUCTION_ACTIVE`.
