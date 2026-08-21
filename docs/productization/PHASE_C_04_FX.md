# Phase C Prompt 4 — Multi-currency and FX Engine

Canonical owner: `packages/payments`.
Authoritative quote type: `packages/payments/src/fx-quote.ts`.
This is not a second pricing engine, ledger, or mint.

`PRODUCTION_READY=false`
`PRODUCTION_ACTIVE=false`
`LIVE_CONNECTIVITY_ENABLED=false`

Real liquidity providers are Phase D.

## Currency registry

Supported simulation currencies live in `packages/domain/src/currency.ts`
and are projected by `packages/payments/src/fx-currency.ts`:

| Field | Meaning |
| --- | --- |
| ISO alphabetic / numeric | Identity only |
| `minorUnitExponent` | Scale for integer minor units |
| `simulation.depositAvailable` | Simulation deposit flag |
| `simulation.withdrawalAvailable` | Simulation withdrawal flag |
| `simulation.fxAvailable` | Simulation FX flag |
| `live.*` | Always false |
| legal-entity / product / jurisdiction restrictions | Eligibility metadata |

Metadata existence does not imply a live currency.

## Rate model

Three server-owned rates, all bigint rationals:

1. `REFERENCE` (`marketRate`) — simulation reference observation
2. `PROVIDER` — simulated liquidity-provider rate
3. `CUSTOMER` — priced customer rate after spread

Each rate carries `base`, `quote`, `numerator`, `denominator`, UTC
`timestamp`, and `source`. Frontend cannot choose a rate.

## Quote lifecycle

`OPEN → ACCEPTED → EXECUTED`

Expired quotes become `EXPIRED` and cannot execute. Terms are frozen at
issue time; acceptance changes status only. Execution references the
exact approved quote id.

Client-visible quote (`fxQuoteDisclosure`) includes source/destination
amounts, customer rate, fees, spread when disclosure policy requires it,
expiration, quote id, simulated provider state, and
`requiredApproval: CUSTOMER_CONFIRMATION`.

## Precision and rounding

Money is integer minor units. Conversion uses
`applyFxConversion` / `Money.allocate` with `HALF_EVEN`. No IEEE-754
path is used for authoritative amounts.

USD 1,000.00 (`100000` cents) at the simulation customer rate
`3745/1000` is `374500` SAR halalas. Simulation fee is `1500` USD cents.
Amount debited is `101500` USD cents.

## Pricing

`packages/payments/src/fx-pricing.ts` is the server-controlled policy:

- fixed fee
- percentage fee (rational)
- spread
- tiers
- customer / product overrides (empty in simulation)

Clients cannot submit a rate, spread, or fee.

## Execution and Ledger

`EXECUTE_FX_QUOTE` is Kernel-gated. On ALLOW the signed Execution
Authority posts:

1. reserve source + fee
2. capture principal and fee
3. fee income
4. source-currency FX clearing
5. destination-currency FX clearing
6. credit the customer's destination account

Each journal is single-currency. USD and SAR are never netted together.
Failed / unavailable / rate-moved provider outcomes post nothing.

## Payments integration

`composePaymentFx` / `executePaymentFx` bind:

`PAYMENT REQUEST → FX QUOTE → combined review → approval → payment execution`

FX conversion stays inside the payment workflow. A composition records
`stranded: false` and the next recovery action. Do not run a standalone
conversion and a payment as unrelated steps.

## Provider abstraction

`FxLiquidityProvider`:

- `getReferenceRate`
- `getQuote` / `quote`
- `executeQuote`
- `getTradeStatus`
- `cancel`

`SimulationFxProvider` is marked simulation and supports:

`NORMAL`, `EXPIRED_QUOTE`, `PROVIDER_UNAVAILABLE`, `RATE_MOVED`,
`EXECUTION_PENDING`, `EXECUTION_FAILED`, `EXECUTION_SETTLED`.

Vendor response models stay out of SunRey domains. Phase D adapters
implement this port.

## Valuation

`valuePositions` is presentation/reporting only
(`PRESENTATION_ONLY_NOT_LEDGER`). Home exposes `valuation` with
`rateTimestamp` and stale/unavailable indication. Ledger `wealth` still
refuses a blended total without an explicit conversion.

## API

| Method | Path |
| --- | --- |
| GET | `/api/v1/fx/currencies` |
| GET | `/api/v1/fx/valuation` |
| POST | `/api/v1/fx/quotes` |
| GET | `/api/v1/fx/quotes/:id` |
| POST | `/api/v1/fx/quotes/:id/accept` |
| POST | `/api/v1/fx/quotes/:id/execute` |

Authority path: BFF → validation → `PaymentsService` → Kernel →
Execution Authority → Ledger → Evidence.

## Lovable flow

USD 1,000 → SAR:

1. Quote with `sourceAmountMinorUnits="100000"`
2. Review server amounts / fee / expiry
3. Accept
4. Execute to the SAR account

SDK: `ConsumerFxClient` in `packages/sunrey-sdk`.

## Phase D dependencies

- Live FX / liquidity provider adapters behind `FxLiquidityProvider`
- Production pricing counsel review
- Corridor legal status (`RESEARCH_REQUIRED` remains)
- No `LIVE_*` flag changes in this prompt
