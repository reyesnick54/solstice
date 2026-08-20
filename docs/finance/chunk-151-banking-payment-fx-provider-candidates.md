# Chunk 151 — Banking, payment-rail, and FX provider candidates

This chunk adds a **production-candidate** adapter architecture under
`packages/payments/src/production-candidate`. It is sandbox conformance
only.

It does **not** connect ACH, FedNow, RTP, SWIFT, SEPA, Faster Payments,
Saudi payment rails, UAE payment rails, a real BaaS provider, a real
bank, or a real FX provider. It does not imply network membership or
regulatory authorization.

## Canonical owners

| Concern | Owner |
| --- | --- |
| Payments, rails, FX | `packages/payments` |
| Bank / account state | `services/accounts`, `packages/ledger` |
| Compliance | `packages/kernel` |
| Treasury advice | `packages/treasury` via the existing payments treasury port |
| Generic provider acceptance | `packages/sunrey-chain/src/providers` |

Do not create `packages/banking-v2`, `packages/baas`,
`packages/payment-provider`, `packages/swift`, `packages/ach`,
`packages/fx-v2`, or `packages/cross-border-core`.

## Flow

```text
Provider-neutral external payment/banking profiles
        ↓
Credential refs (SecretReference / Chunk 149 descriptor ids)
        ↓
Injected sandbox transport
        ↓
Provider DTO adapter
        ↓
Existing RailAdapter
        ↓
Existing PaymentsService
        ↓
Kernel authorization
        ↓
Existing accounting plans
        ↓
Ledger
```

The provider is never the ledger.

## Provider acceptance domains

`BANKING_REFERENCE` remains the banking / BaaS relationship domain.

Chunk 151 adds `PAYMENT_RAIL` and `FX_LIQUIDITY` to the existing
provider-acceptance taxonomy. There is no second registry.

## Profiles

- `BankingProviderCandidateProfile` — fixture banking / BaaS relationship
- `PaymentRailProviderCandidateProfile` — engineering rail class, not
  named-network membership
- `FxLiquidityProviderCandidateProfile` — exact rational quotes only

Every profile has `productionAuthorized: false`.

Engineering rail classes (`US_BATCH`, `US_INSTANT`, `EU_SEPA`,
`EU_SEPA_INSTANT`, `UK_FASTER_PAYMENT`, `INTERNATIONAL_CORRESPONDENT`,
`SA_DOMESTIC`, `AE_DOMESTIC`) are **not** proof of FedNow, RTP, SWIFT,
SEPA, or any other named network.

## Hard rules preserved

- Adapters receive `AuthorizedRailCommand` and cannot issue Execution
  Authority or post journals.
- Every consequential submit carries a provider idempotency key.
- `SUBMISSION_UNKNOWN` → query → reconcile. Never timeout then resubmit.
- Provider statuses stop at the adapter. The domain sees only canonical
  rail statuses.
- A webhook is not accounting authority. `SETTLED` updates rail state.
- Inbound notices do not credit a customer from an unauthenticated
  payload.
- Returns preserve original settlement history. Corrections are new
  compensating entries.
- Settlement reports and provider balances are not the customer ledger.
- FX is exact rational. Floats, stale quotes, and outages do not invent
  a rate.
- Routing scores only after hard eligibility filters. Regulatory
  compatibility is a filter, not a score.
- Unknown corridors remain `RESEARCH_REQUIRED` / `DISABLED`.
- Treasury may advise liquidity. It cannot override Kernel, corridor
  eligibility, provider acceptance, or payment authorization.
- Failover A → B cannot change beneficiary, currency, purpose, bypass
  compliance, or reuse the wrong credential.

## Fixtures

`fixture-bank-us`, `fixture-bank-gcc`, `fixture-rail-international`,
`fixture-fx-usd-sar`.

Demo: `demo:sunrey-banking-payment-provider-candidate`.

Capability: `sunrey-banking-payment-provider-candidates`.
