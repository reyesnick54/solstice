# Phase C Prompt 3 — Beneficiaries, transfers, and payment orchestration

`PRODUCTION_READY=false`
`PRODUCTION_ACTIVE=false`
`LIVE_CONNECTIVITY_ENABLED=false`
`LIVE_PAYMENTS_ENABLED=false`
`ENVIRONMENT=simulation`

This prompt productizes the provider-independent Payments Platform.
It does not start Prompt 4. Real bank, ACH, wire, RTP, SEPA, SWIFT,
Saudi-rail, and remittance adapters are Phase D.

## Payment architecture

Canonical owner: `packages/payments`

Productization layer: `packages/payments/src/platform/`

Authoritative orchestrator: `packages/payments/src/platform/orchestrator.ts`
(`PaymentPlatform`)

The platform **extends** the existing payments spine. It does not create
`packages/payments-v2`, `services/payments`, or a second ledger.

| Concern | Path |
| --- | --- |
| Rail PaymentOrder machine | `packages/payments/src/payment.ts` (`PAYMENT_STATUSES`) |
| Product lifecycle | `packages/payments/src/platform/lifecycle.ts` |
| Payment Intent | `packages/payments/src/platform/payment-intent.ts` |
| Beneficiary / recipient | `packages/payments/src/beneficiary.ts` + `platform/destination.ts` |
| Beneficiary security | `packages/payments/src/platform/beneficiary-security.ts` |
| Quote preview | `packages/payments/src/platform/quote-preview.ts` |
| Limits | `packages/payments/src/platform/limits.ts` |
| Funds hold / capture / release | `packages/payments/src/platform/funds-reservation.ts` |
| External routing contract | `packages/payments/src/platform/routing.ts` (`PaymentRouter`) |
| Simulated provider | `packages/payments/src/platform/simulated-provider.ts` |
| Inbound notices | `packages/payments/src/platform/inbound.ts` |
| Failures / returns | `packages/payments/src/platform/failures.ts` |
| Compliance hooks | `packages/payments/src/platform/compliance.ts` |
| Workflow | `packages/payments/src/platform/workflow.ts` (`payment.outbound`) |
| BFF routes | `services/api/src/consumer/handler.ts` |
| Sandbox world | `services/api/src/consumer/fixtures.ts` |

`PaymentPlatform` refuses to construct when `ENVIRONMENT !== 'simulation'`
or `LIVE_PAYMENTS_ENABLED` is true. Production money movement stays
disabled.

## Beneficiaries

Customer resource: `Recipient` (no bank secrets, no provider config).

Destination types: `SUNREY_USER`, `DOMESTIC_BANK`,
`INTERNATIONAL_BANK`, `WALLET`.

Creation always goes through Kernel-gated
`PaymentsService.createBeneficiary`. Agents have no
`MANAGE_BENEFICIARY` capability path that skips this.

Frontend cannot mark a recipient verified. Client fields such as
`verified: true` are ignored and sealed as
`BENEFICIARY_CLIENT_VERIFICATION_REJECTED`. Screening + Kernel decide
`ACTIVE` / `REVIEW` / `BLOCKED`.

Sensitive coordinates are stored as a hashed `coordinateRef` plus a
display hint (last-4 for bank schemes; full account id for
`SUNREY_ACCOUNT`).

## Security

New or changed beneficiaries evaluate:

1. Authentication (active session)
2. Step-up (`requiredAssuranceFor('MANAGE_BENEFICIARY')` → `STRONG`)
3. Device risk (`HIGH` / `BLOCKED` denied)
4. Cooldown (policy-configurable)
5. Frequency (daily / weekly)
6. Kernel `CREATE_BENEFICIARY`
7. Evidence seal

Cross-user create and read are denied (`CROSS_USER_DENIED`).

## Payment lifecycle

Customer-facing states (validated transitions):

`DRAFT` → `QUOTED` → `AWAITING_STEP_UP_AUTH` /
`AWAITING_APPROVAL` / `AWAITING_COMPLIANCE` → `AUTHORIZED` →
`QUEUED` → `SUBMITTED` → `PROCESSING` → `SETTLED`

Terminal / exception: `FAILED`, `CANCELLED`, `RETURNED`, `REVERSED`.

This machine does **not** replace rail `PAYMENT_STATUSES`.
`lifecycleFromRailStatus` maps settlement states onto the product
journey.

## Internal transfer

First end-to-end money-movement reference:

request → session/ownership → Kernel → verified Execution Authority →
available-funds check → atomic `Ledger.postJournal` (`internal-transfer`
suffix) → evidence → `PaymentSettled` → `SETTLED`

Same-owner cash uses `INTERNAL_TRANSFER` / `CUSTOMER_TRANSFER`.
SunRey-to-SunRey uses `INITIATE_PAYMENT` on the ledger path with
currency preserved. Idempotent retries replay a settled journal.
Overspend is refused (`INSUFFICIENT_FUNDS`). Concurrent remaining-balance
checks use the ledger, not a stored Account balance.

## External routing abstraction

`PaymentRouter` is the provider-independent contract:

- inquire availability (countries, currencies, rails, limits)
- `routePayment` (submit)
- status inquiry
- cancel where supported

Domain code never sees vendor URLs or credentials. Phase D binds real
`RailAdapter` implementations behind this port.

## Simulated payment adapter

`SimulationOnlyPaymentProvider` is labeled
`SIMULATION_ONLY_NOT_PRODUCTION_MONEY_MOVEMENT`. Scenarios: `SUCCESS`,
`PENDING`, `FAILED`, `RETURNED`, `TIMEOUT`. `assertSimulationOnly()`
throws if environment is not simulation or if `LIVE_PAYMENTS_ENABLED`.

## Ledger integration

- Internal transfer: `internalTransferPlan` posted through
  `postPaymentJournal` only.
- External outbound: `LedgerFundsReservation` reserve → capture or
  release. Duplicate capture is a no-op.
- Inbound: unverified HTTP notices never credit. Verified notices still
  do not credit until a later Kernel-gated inbound path exists.
- Returns / reversals record a reconcilable disposition
  (`RELEASE_HOLD` / `RETURN_JOURNALS` / `REVERSE_JOURNALS`). Compensating
  journals remain Kernel-gated; they are not invented here.

Balances are read from the ledger. No yield / APY / growth-rate field.

## Compliance hooks

`evaluatePaymentComplianceHooks` uses the existing
`SimulationScreeningAdapter`. Hooks reserved for Phase D providers:
sanctions, AML, beneficiary screening, transaction monitoring,
purpose-of-payment, jurisdiction restrictions.

No fake live AML/sanctions results. Simulation states:
`CLEAR_SIMULATION`, `REVIEW_REQUIRED`, `BLOCKED`.

Limits live in `DEFAULT_PAYMENT_LIMITS` (per-tx, daily, weekly, monthly,
currency, rail, jurisdiction, risk class). Not in Lovable.

## Workflow / events

Workflow type `payment.outbound` on Phase B `WorkflowRuntime`.
Steps: prepare, await human, await compliance, await provider,
compensate. A workflow cannot post a journal or issue Execution
Authority. Snapshots restore after process restart.

Consumer event aliases (mapped onto canonical PascalCase domain events):

- `payment.created` → `PaymentInitiated`
- `payment.authorized` → `PaymentInitiated`
- `payment.submitted` → `PaymentSubmitted`
- `payment.settled` → `PaymentSettled`
- `payment.failed` → `PaymentFailed`
- `payment.returned` → `PaymentReturned`
- `payment.reversed` → `ReversalPosted`

## API

Consumer BFF (`/api/v1`, not chain `/v1`):

| Method | Path |
| --- | --- |
| GET, POST | `/api/v1/recipients` |
| GET | `/api/v1/recipients/{id}` |
| POST | `/api/v1/payments/quote` |
| GET, POST | `/api/v1/payments` |
| GET | `/api/v1/payments/{id}` |
| POST | `/api/v1/payments/{id}/approve` |

OpenAPI: `api/sunrey-consumer-bff-v1.openapi.yaml`

SDK: `@solstice/sunrey-sdk` export `./bff`
(`Recipient`, `PaymentQuote`, `Payment`, `PaymentStatus`,
`PaymentApproval`, `SunReyConsumerBffClient`).

## Lovable integration

Journey: select recipient → amount → quote (fees, no settlement-time
promise) → review → step-up if required → approve if required →
processing → complete / fail / return.

Backend owns status. Sandbox personas (`basic_verified`, `restricted`,
…) remain non-production fixtures. `productionMoneyMovement` is always
`false`.

See `docs/productization/SUNREY_LOVABLE_BFF_MAPPING.md`.

## Phase D provider requirements

Phase D must not fork this owner. Required later work:

1. Bind real `RailAdapter` implementations behind `PaymentRouter`.
2. Provider credential plane stays in `packages/security` — never on
   customer Payment / Recipient resources.
3. Verified inbound provider events → reconciliation → Kernel → Ledger
   credit.
4. Rail-defined settlement SLAs may then populate delivery estimates.
   Quotes must keep `settlementTimePromise: null` until then.
5. Do not flip `LIVE_PAYMENTS_ENABLED` or `ENVIRONMENT`.
6. Do not mark corridors `CONFIRMED_BY_COUNSEL` without counsel.
7. Compensating return/reversal journals stay Kernel-gated.

`SAFE_TO_PROCEED_TO_PHASE_C_PROMPT_4` is recorded in the Prompt 3
completion response after validation.
