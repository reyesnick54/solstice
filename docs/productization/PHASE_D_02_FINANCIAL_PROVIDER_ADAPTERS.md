# Phase D Prompt 2 — Banking, payment-rail, FX, and card production adapters

Canonical owners:

- Bank / BaaS / rails / FX: `packages/payments`
- Cards / digital wallet: `packages/cards`
- Treasury reconciliation bridge: `packages/treasury`

Authoritative contracts:

- `packages/payments/src/production-adapters`
- `packages/cards/src/production-adapters`

This is not a second Ledger, Kernel, payment system, or card processor.

`PRODUCTION_READY=false`
`PRODUCTION_ACTIVE=false`
`LIVE_CONNECTIVITY_ENABLED=false`
`REAL_BANKING_CONNECTED=false`
`REAL_CARD_PROCESSOR_CONNECTED=false`
`REAL_FX_PROVIDER_CONNECTED=false`

Phase C closed with `READY_FOR_PHASE_D=true`. This prompt productizes
the adapter contracts a selected vendor must implement. It does not
connect a live bank, rail, FX desk, or card network.

## Pattern

```
SUNREY DOMAIN INTENT
→ EXECUTION AUTHORITY
→ PROVIDER ADAPTER
→ EXTERNAL PROVIDER
→ VERIFIED RESULT
→ LEDGER / SETTLEMENT / RECONCILIATION
```

Adapters never post journals and never issue Execution Authority.
Provider balance is not customer Ledger authority.

## Integrating a vendor

1. Implement the adapter contract (`BankAdapter`, `ProductionRailAdapter`,
   `ProductionFxAdapter`, or `ProductionCardIssuer`).
2. Map vendor payloads inside the adapter only.
3. Bind credentials as `SecretReference` values (Chunk 149 plane).
4. Configure webhook verification.
5. Pass the sandbox contract / certification suite.
6. Complete provider certification.
7. Pass preproduction.
8. Obtain independent authorization for live rollout.

Do not redesign SunRey domain types around a vendor API.

## Bank / BaaS

`BankAdapter` supports customer profile, provider-account create/get/status,
balance, transactions, statement, and close/restrict. Identifiers
(IBAN, routing+account, sort code, local) are sealed into a fingerprint
plus display mask. Raw values are not returned.

`ExternalAccountLinkage` binds SunRey account, Ledger account, and
external provider account with currency, jurisdiction, status,
timestamps, and reconciliation metadata.

Funding adapters emit verified notices. Inbound credit still requires
the approved Kernel → Execution Authority → Ledger path.

## Payment rails

`ProductionRailAdapter` extends the existing `RailAdapter`. Product
kinds ACH, WIRE, RTP, SEPA, SEPA Instant, SWIFT, Saudi/local, and
international remittance map onto engineering `RailClass` values.
Mapping is not network membership and is not live connectivity.

Unknown vendor statuses normalize to `UNKNOWN` /
`REQUIRES_RECONCILIATION`. They never become `SETTLED`.

SunRey keeps its own execution/idempotency reference. UNKNOWN
submission requires status inquiry before resubmission.

## FX

`ProductionFxAdapter` extends `FxLiquidityProvider`. Simulation and
future vendors share getReferenceRate, getQuote, executeQuote,
getTradeStatus, cancel, retrieveSettlement, and retrieveProviderBalance.

Quote integrity checks provider quote id, rate, amounts, pair,
expiration, and provider-level fees. Customer pricing remains SunRey
owned unless the adapter is explicitly configured as
`PROVIDER_RATE_INPUT`.

## Cards and wallets

`ProductionCardIssuer` extends `CardProcessor`. The authorization
bridge is timed:

`signature/auth validation → normalize → card/domain policy →
balance/hold decision → response mapping`

Controls are not bypassed for latency. PAN/CVV are refused. Preferred
channels are provider-hosted retrieval, ephemeral token, PCI iframe,
and network token.

Digital-wallet hooks cover eligibility, provisioning, token status,
suspend, resume, and delete for Apple Pay and Google Wallet. This
repository is `NOT_CERTIFIED` with Apple and Google.

## Webhooks

Normalized event families: `bank.account.*`, `bank.transaction.*`,
`payment.*`, `fx.*`, `card.*`. Missing verification fails closed.
Duplicate callbacks are acknowledged without reprocessing.

## Reconciliation

Every financial adapter exposes balances, transactions, settlements,
statements, and fees where the vendor can provide them. Phase C
treasury consumes the snapshot through
`treasuryAdapterFromFinancialSnapshot`. An integration that can send
money but cannot reconcile is incomplete.

## Certification suites

| Suite | Owner | Covers |
| --- | --- | --- |
| BANK | payments | account lifecycle, balance, statement, transactions, isolation |
| PAYMENT | payments | submit, status, pending, reject, return, timeout, unknown, idempotency, webhook duplicate, reconciliation |
| FX | payments | quote, expiry, execute, status, failure, settlement, precision |
| CARD | cards | issue, freeze/unfreeze, auth, decline, capture, reversal, refund, duplicate callback, wallet eligibility |

Passing a suite is not production authorization.

## Simulation path

`SimulatedBankAdapter`, `SimulatedProductionRailAdapter` (extends
`SimulatedRailAdapter`), `SimulatedProductionFxAdapter` (wraps
`SimulationFxProvider`), and `SimulatedProductionCardIssuer` (extends
`SimulatedCardProcessor`) implement the same contracts a real vendor
will implement. There is no parallel production path B.

## Adapter template

`FinancialProviderAdapterTemplate` is a skeleton with placeholders for
configuration, credentials, capabilities, requests/responses, webhook
verification, health, error normalization, reconciliation, and tests.
No fake vendor-specific code.

## Consumer API

Lovable and other frontends call SunRey. SunRey routes the provider.
Consumer resources remain provider-neutral.

## Live gates

Sandbox bank / FX cannot be invoked as production. Simulation card
providers cannot produce a production card. Uncertified adapters cannot
enter the production lifecycle. Missing credential references fail
closed. Missing webhook verification prevents callback processing.

`ENVIRONMENT` stays `simulation`. Every `LIVE_*` flag stays `false`.
