# Chunk 49 — SunRey Universal Economic Exchange

Implemented on latest `main` after Chunk 45. This chunk **extends**
`packages/sunrey-exchange`. It does not create a second exchange,
order book, or matching engine.

Canonical owner remains `packages/sunrey-exchange`.

- Engine: `packages/sunrey-exchange/src/universal.ts`
- Instruments: `packages/sunrey-exchange/src/instruments.ts`
- Eligibility: `packages/sunrey-exchange/src/eligibility.ts`
- Auction: `packages/sunrey-exchange/src/auction.ts`
- Demo: `packages/sunrey-exchange/src/universal-demo.ts`
- CLI: `packages/sunrey-exchange/src/cli.ts`

Reuse, do not reimplement:

- `packages/sunrey-chain` native assets, machine economy, oracle, productive graph
- `packages/custody`
- `packages/market-surveillance`
- `packages/consent` / Purpose Firewall
- `packages/clean-room`
- `packages/personal-data-vault` (payloads never leave the clean room)

## Four market families

| Family | Instrument | Settlement |
| --- | --- | --- |
| `DIGITAL_ASSET` | versioned native asset listing | application DVP and native atomic DVP |
| `HUMAN_INFORMATION_RIGHT` | `InformationUseRightInstrument` | delivery-versus-right |
| `INTELLIGENCE_COMPUTE` | compute/service instrument | escrow + oracle + partial pay |
| `PRODUCTIVE_CAPACITY` | `ProductiveCapacityContract` | batch auction + oracle + graph ref |

`INFORMATION_ASSET` remains the historical compute-contract alias.

These are not a single ERC-style token model. Rights, purpose,
eligibility, oracle facts, and delivery windows are first-class.

## Matching

STAGE 1 — deterministic eligibility (identity, rights, consent,
purpose, jurisdiction, capability, counterparty class, geography,
oracle, expiration, market access).

STAGE 2 — economic matching. Price-time priority for continuous
books. An ineligible order cannot match even if the price crosses.

Governed order types: `LIMIT`, `IOC`, `FOK`, `POST_ONLY`.
A MARKET-like order requires an explicit protection price. There is
no unlimited-price order.

## Settlement

- Digital: existing CoinPort/FiatPort DVP plus `SimulationNativeDvpAdapter`
  for SunRey/MoonRey native units. The adapter does not replace the
  current application path.
- Compute/capacity: escrow + verified delivery + exact integer
  partial payment. Conflicted or stale oracle facts block ordinary
  settlement.
- Information rights: payment + valid right + purpose + clean-room
  aggregate → receipt. Raw PDV rows are never returned.

## Governance and risk

New instruments pass schema, family, rights, oracle, legal-research,
and operational-readiness checks. AI cannot approve a listing.

Market access policies are engineering controls:
`PUBLIC_DEVELOPMENT`, `VERIFIED_ACCOUNT`, `INSTITUTIONAL_ONLY`,
`ELIGIBLE_COUNTERPARTY`, `MACHINE_ALLOWED`, `HUMAN_ONLY`.

Cross-market risk limits cover open orders, notional, escrow,
capacity commitments, and provider/oracle/instrument concentration.

## Surveillance

Family detectors live in `packages/market-surveillance`. They emit
candidate alerts only. They do not make legal conclusions.

## Development posture

Simulation only. `LIVE_EXCHANGE_ENABLED` and `LIVE_CRYPTO_ENABLED`
remain false. Public tickers remain `NOT_ASSIGNED`.
