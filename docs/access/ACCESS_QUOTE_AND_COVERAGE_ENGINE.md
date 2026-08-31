# Access Quote and Coverage Engine (ACCESS Wave 3 / Prompt 34)

Deterministic checkout and coverage calculation for the SunRey Access economy.
This engine answers provider pricing, Access eligibility, entitlement availability,
funding availability, user co-pay, and reservation planning **without moving money,
tokens, entitlements, or funding**.

Prompt 35 (settlement) consumes the authoritative `AccessCheckoutQuote` produced here.

## Components

| Component | Location | Role |
|-----------|----------|------|
| `AccessCoverageEngine` | `packages/access-economy/src/checkout/coverage-engine.ts` | Orchestrates checkout quote calculation |
| `AccessCheckoutQuote` | `packages/access-economy/src/checkout/types.ts` | Authoritative checkout calculation output |
| `AccessCheckoutCoveragePolicy` | `packages/access-economy/src/checkout/coverage-policy.ts` | Versioned cost eligibility and coverage caps |
| `AccessCostClassification` | `packages/access-economy/src/checkout/types.ts` | Per-line cost classification |
| `AccessProviderFirmQuote` | `packages/access-economy/src/checkout/types.ts` | Decomposed provider firm quote input |
| `AccessCheckoutQuoteStore` | `packages/access-economy/src/checkout/quote-store.ts` | Idempotent quote persistence |

## Cost classification

Every monetary component of a provider quote is classified before coverage is computed.

Supported classifications:

- `ACCESS_ELIGIBLE` — may be subsidized by Access funding
- `USER_RESPONSIBILITY` — user must pay directly
- `MANDATORY_FEE` — mandatory fee excluded unless policy permits
- `OPTIONAL_FEE` — optional upgrade; user responsibility by default
- `SECURITY_DEPOSIT` — refundable hold; never Access-funded by default
- `CONTINGENT_LIABILITY` — damage/incident exposure; never Access-funded by default
- `TAX` — tax line when policy excludes taxes from coverage
- `INELIGIBLE` — cannot be covered

Default policy (`MOBILITY_CHECKOUT_STANDARD` v1):

| Cost type | Default treatment |
|-----------|-------------------|
| Base service | Access-eligible |
| Mandatory taxes | Access-eligible (configurable) |
| Mandatory booking/service fees | Access-eligible (configurable) |
| Optional upgrades | User responsibility |
| Security deposits | User responsibility |
| Contingent liability / damage deposits | User responsibility |
| Tips, incidentals, late fees, fuel penalties | User responsibility via `OTHER` / ineligible |

Policies are registered in `AccessCheckoutCoveragePolicyRegistry` and selected by
category + `effectiveFrom`. Business rules are **not** hard-coded in the engine.

## Eligible coverage formula

```
EligibleCost = sum(components classified ACCESS_ELIGIBLE)

PolicyCappedEligible = applyCoverageCaps(EligibleCost, policy, request caps)

AccessCoverage = min(
  PolicyCappedEligible,
  RemainingProgramCoverage,
  AvailableFunding
)

UserContribution = TotalProviderAmount - AccessCoverage - OtherAuthorizedProgramCoverage
```

At launch:

```
TokenConversionContribution = 0
```

No SR or MR liquidation occurs in this engine.

## Security deposits

Security deposits are classified as `SECURITY_DEPOSIT` and excluded from
`accessEligibleAmount` and `fundingToReserve` by default.

Example (vehicle rental):

| Line | Amount |
|------|--------|
| Base rental | $340 |
| Taxes | $60 |
| Security deposit | $500 |
| Immediate provider charge | $400 |
| Access-funded settlement | $300 |
| User provider-service co-pay | $100 |
| Deposit (user-secured separately) | $500 |

The reservation plan records `securityDepositUserSecured` separately from
`userPaymentRequired`.

## User contribution

```
UserContribution = TotalProviderAmount - AccessCoverage - OtherAuthorizedProgramCoverage
```

`TotalProviderAmount` is the immediate provider service charge (base + taxes +
mandatory fees + optional fees selected for checkout). Deposits and contingent
liabilities are excluded from Access coverage but remain user obligations where
applicable.

Partial subsidy is valid: Access may cover $150 of a $400 provider charge while
the user pays $250.

## Funding constraints

The engine queries `AccessSolvencyService.getAvailableFunding()` read-only.

- No funding ledger mutation
- No funding reservation
- Category pools with `STRICT_CATEGORY` cannot fund other categories
- Provider restrictions on funding sources are enforced
- When eligible cost > 0 but available funding = 0 → `ACCESS_FUNDING_UNAVAILABLE`

## Entitlement constraints

Before producing a settleable quote:

```
remainingUnits >= requestedUnits
```

Entitlement units are **not consumed** in Prompt 34. The reservation plan records
`unitsToReserve` for Prompt 35/37 lifecycle.

## Quote expiry

```
expiresAt = min(providerQuote.expiresAt, SunReyCheckoutExpiry)
```

Default SunRey checkout expiry: 15 minutes from calculation time.

Only `FIRM` quotes are accepted for settlement-bound checkout. `REFERENCE`,
`INDICATIVE`, and expired quotes are rejected.

## Policy versioning

Every `AccessCheckoutQuote` records:

- `policyId`
- `policyVersion`

Policies include `effectiveFrom`, `enabled`, cost-type rules, and configurable
coverage caps (per transaction, category, allocation period, user, program, provider).

## Multi-currency

Provider quote currency may differ from funding-pool currency.

- No silent execution FX at quote time
- Optional `ProviderFxQuotePort` supplies **reference FX estimates** only
- Quotes mark `fxQuoteKind: REFERENCE_FX` vs future `EXECUTION_FX`
- Missing reference FX when currencies differ → `CURRENCY_MISMATCH_NO_FX`

## Fiat / token boundaries

This engine does **not**:

- authorize or capture payments
- issue virtual cards
- debit users or send payouts
- book providers
- consume entitlements
- reserve or capture funding
- transfer, burn, or convert SR/MR

`tokenConversionContribution` is always `0`.

## Price change handling

When a provider returns a changed firm quote, call
`recalculateForProviderQuoteChange()`. The prior checkout quote is marked
`SUPERSEDED` and a new quote links `replacementProviderQuoteId`.

## Reservation plan

Each quote includes a `CheckoutReservationPlan`:

| Field | Meaning |
|-------|---------|
| `entitlementUnitsToReserve` | Units Prompt 35 should hold |
| `fundingToReserve` | Fiat Access pool amount to reserve |
| `userPaymentRequired` | User co-pay for provider service |
| `providerAmountRequired` | Total immediate provider charge |
| `securityDepositUserSecured` | Deposit held separately from Access funding |

## Explanation output

Structured `explanation` lines are derived from canonical fields for BFF/UI use:

- Provider Price
- Access covers
- You pay
- Refundable deposit (when applicable)
- Access units used

## Prompt 35 recommendation

Prompt 35 should:

1. Verify `AccessCheckoutQuote.status === SETTLEABLE'` and `expiresAt > now`
2. Reserve entitlement units per `reservationPlan.entitlementUnitsToReserve`
3. Reserve funding per `reservationPlan.fundingToReserve` via `AccessSolvencyService`
4. Collect `reservationPlan.userPaymentRequired` through the payments rail
5. Secure `securityDepositUserSecured` through a separate user-held mechanism
6. Issue provider settlement only after holds succeed
7. Seal evidence referencing `checkoutQuoteId` and `policyId`/`policyVersion`
