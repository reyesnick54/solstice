# Phase G Prompt 5 — Wallets, custody, deposits, withdrawals

This record productizes the customer wallet and asset-movement backend.

It does not authorize production. `ENVIRONMENT` stays `simulation`.
All `LIVE_*` flags stay `false`. Production signing stays disabled
without external HSM/KMS/custody infrastructure.

Phase G Prompts 1–4 (Exchange core, settlement/compliance, chain
runtime, native-asset controls) were still in flight when this work
started. Wallet productization uses existing custody, Kernel, Travel
Rule, and blockchain-analytics ports so those planes can attach without
replacing the customer wallet contract.

`SAFE_TO_PROCEED_TO_PHASE_G_PROMPT_6=true` after the wallet domain,
key boundary, deposit/withdrawal workflows, and Lovable/Agent contracts
in this prompt.

## Owner

Canonical owner: `packages/custody` (`src/product/`).

Orchestration: `services/api/src/consumer/wallets.ts`.

Lovable contract: `packages/sunrey-sdk/src/consumer-bff` plus
`api/sunrey-consumer-bff-v1.openapi.yaml`.

Do not create `packages/wallet`, `packages/wallet-v2`,
`packages/crypto-wallet`, or a second custody / ledger / key authority.

Card Apple/Google provisioning remains `packages/cards`. Sovereign
`BlockchainAccount` remains `packages/sunrey-chain/src/wallet`. This
prompt productizes the **customer custody wallet resource**.

## Wallet model

Client-safe resource `sunrey.consumer.wallet.v1`:

`walletId`, `owner`, asset/network, custody model, address references,
status, balance read model (total / available / pending),
provider/custody reference, `createdAt`.

Custody models:

- `SUNREY_NATIVE` — SunRey Chain native wallets
- `EXTERNAL_CUSTODY` — Phase D custody adapters
- `INTERNAL_OPERATIONAL` — only when explicitly approved; withdrawals
  off by default

Balances are read models. Provider balance is never truth. There is no
percentage-return, yield, or growth-rate field.

## Wallet status

`PENDING`, `ACTIVE`, `RESTRICTED`, `FROZEN`, `CLOSED`.

`withdrawalEnabled` is independently controllable. A wallet can be
`ACTIVE` and still refuse withdrawals.

## Addresses

Deposit addresses are bound to one network and one asset. SunRey Coin
uses `sr1…`. MoonRey Coin uses `mr1…`. Wrong-network destinations fail
before signing.

## Key boundary

Frontend never receives server-controlled signing material.
Agent never receives signing material.
Clients cannot select `complianceApproved`, `providerOverride`, or
`signingKey`.

Backend signing uses the existing HSM/KMS/custody ports. Production
signing remains disabled (`productionSigningAuthorized: false`).

## Deposit flow

```
address assigned
  → transaction detected
  → validation
  → blockchain analytics / compliance where required
  → confirmation / finality
  → custody / chain reconciliation
  → account / wallet credit (Kernel + Execution Authority)
  → evidence
```

Mempool / `PENDING_PROPOSAL` is not final. Duplicate deposit events
reuse the first record and do not double-credit.

## Withdrawal flow

A withdrawal starts as a controlled quote/proposal:

wallet, asset, destination, amount, network, estimated fee, Travel Rule
applicability, risk, required approval, expiry.

Execution:

```
authenticated request
  → ownership
  → destination validation
  → step-up
  → blockchain analytics
  → Travel Rule where required
  → compliance
  → Kernel
  → Execution Authority
  → custody / native wallet signing (simulation)
  → broadcast / provider submission
  → confirmation
  → reconciliation
  → evidence
```

## Finality

Client-safe states: `PENDING`, `BROADCAST`, `CONFIRMING`, `FINALIZED`,
`FAILED`, `REVIEW`.

Native assets use SunRey Chain BFT semantics
(`PENDING_PROPOSAL` / `MEMPOOL` / `BFT_FINALIZED`).
External assets use normalized provider confirmations.

## Compliance / Travel Rule / analytics

Phase D blockchain analytics (`packages/kernel` provider-candidate)
feeds risk. It does not independently authorize or deny.

Travel Rule applies only when the simulation policy pack and
jurisdiction/transfer type require it. Customer-safe states:

`NOT_REQUIRED`, `ADDITIONAL_INFORMATION_REQUIRED`, `PROCESSING`,
`COMPLETE`, `REVIEW`.

Protected counterparty information is not returned.

## Reconciliation

Planes compared: SunRey Chain/native, custody provider, Exchange
position, customer read model.

Mismatches create breaks. `autoCorrected` is always `false`.

## API / BFF / SDK

| Method | Path |
| --- | --- |
| GET | `/api/v1/wallets` |
| GET | `/api/v1/wallets/:id` |
| GET | `/api/v1/wallets/:id/deposit-address` |
| GET | `/api/v1/wallets/:id/transactions` |
| POST | `/api/v1/wallets/:id/withdrawal-quote` |
| POST | `/api/v1/wallets/:id/withdrawals` |
| GET | `/api/v1/wallets/:id/withdrawals/:id` |
| GET | `/api/v1/assets` |
| GET | `/api/v1/assets/:assetId` |

SDK: `SunReyConsumerBffClient` wallet and asset helpers.

## Lovable

Wallet Home, Assets, SunRey Coin, MoonRey Coin, Deposit, Receive,
QR/address, Send, Withdrawal Review, Network Fee, Confirmation
Progress, and Transaction History can be built from the contract
above without interacting with signing material.

## Agent

May show wallet, balance, address, explain a transaction, and create a
withdrawal proposal.

May not sign, broadcast directly, bypass step-up, or bypass compliance.

## Sandbox

Deterministic scenarios in `packages/custody/src/product/sandbox.ts`:

native SunRey deposit, native SunRey withdrawal, MoonRey transfer,
pending confirmation, invalid destination, high-risk destination,
Travel Rule required, custody outage, chain outage, failed broadcast,
successful finalization.

Seeded wallets: `wal_sandbox_basic_sunrey`,
`wal_sandbox_basic_moonrey`, `wal_sandbox_exchange_sunrey`,
`wal_sandbox_agent_sunrey`, `wal_sandbox_restricted_sunrey`.

## External dependencies

- Existing `CustodyService` Kernel gating and evidence
- Phase D custody provider-candidate adapters
- Phase D blockchain analytics fixture
- Simulation Travel Rule pack (`RESEARCH_REQUIRED`)
- HSM/KMS ports in `packages/security` (production signing disabled)
- Exchange / chain productization from Phase G Prompts 1–4 attach via
  ports; this prompt does not reimplement them

## What this does not claim

- Live custody, live Travel Rule networks, or production HSM
- A second ledger or mint
- Counsel-confirmed Travel Rule thresholds
- Agent execution
