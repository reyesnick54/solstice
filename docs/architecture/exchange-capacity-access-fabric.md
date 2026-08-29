# ACCESS-09 — SunRey Exchange capacity markets and dual-economy clearing

Capability: `sunrey-exchange-capacity-access`
Owner: `packages/sunrey-exchange` (`src/access-fabric`)
Posture: simulation only. Production activation remains off.

ACCESS-09 extends the canonical SunRey Exchange. It is not a second
exchange, not a second matching engine, and not a second balance ledger.
Batch clearing delegates to the canonical `clearAuction` in
`packages/sunrey-exchange/src/auction.ts`. Eligibility and jurisdiction
policy come from `packages/sunrey-exchange/src/eligibility.ts`.

## What the Exchange gained

| Concern | Where |
| --- | --- |
| Productive capacity discovery | `src/access-fabric/discovery.ts` |
| Fixed-price access offers | `src/access-fabric/offers.ts` |
| Request for quote | `src/access-fabric/rfq.ts` |
| Batch auction adapter | `src/access-fabric/auction.ts` |
| Queue / allocation markets | `src/access-fabric/queue.ts` |
| Capacity reservations | `src/access-fabric/reservations.ts` |
| Dual-economy clearing | `src/access-fabric/clearing.ts` |
| Refund and cancellation intents | `src/access-fabric/refunds.ts` |
| Policy and authority gate | `src/access-fabric/policy.ts` |
| Orchestration | `src/access-fabric/engine.ts` |

## Capacity term sheet

`CapacityAccessTerms` is what an Exchange capacity order or offer carries.
Every attribute is required; `evaluateTermsCompleteness` refuses a
partially specified term sheet before any market operation runs.

- target productive object — `ProductiveEconomicObject.objectId`
- backing productive claim — `ProductiveClaim.claimId` and `claimType`
- quantity and canonical unit — unit ids come from
  `packages/sunrey-chain/src/units`; the term sheet refuses a unit that is
  not the canonical productive unit of the referenced object
- availability window — canonical `DeliveryWindow`
- geography and delivery location
- quality / service class
- rights terms — access, never title (`tokenizesTitle: false`)
- policy requirements — capabilities, verification, jurisdictions, oracle policy
- jurisdiction
- provenance — provider, attestations, oracle fact ids, economic asset id
- delivery requirements — semantics, accepted evidence qualities, partial policy
- permitted consideration

The Exchange references the canonical productive models by identifier. It
does not import `packages/sunrey-chain` and does not redefine
`ProductiveEconomicObject`, `ProductiveClaim`, or
`CanonicalProductiveMeasurement`.

## Dual-Economy Clearing

Each consideration leg routes to its canonical owner and nowhere else.

| Consideration | Rail | Requirement |
| --- | --- | --- |
| `FIAT` | canonical Ledger | `Ledger.postJournal` with a signed Execution Authority scoped to the debited account |
| `SUNREY_COIN` | canonical custody or native chain rail | custody reserve/debit with finality, or chain hold/transfer with BFT finality |
| `MOONREY_COIN` | canonical custody or native chain rail | same as above |
| `ACCESS_ENTITLEMENT` | entitlement owner port | consumption reference only |
| `REWARD_CREDIT` | reward credit owner port | consumption reference only |

Fiat journals use the `DEMAND_DEPOSIT_TO_PENDING_SETTLEMENT` class bridge:
reserving debits the buyer's demand deposit and credits a
pending-settlement reservation account; capturing debits the reservation
account and credits the provider; refunding debits the reservation account
and credits the buyer. Every phase is a separate journal under a known
Ledger idempotency suffix (`reserve`, `capture-principal`, `refund`).

### What clearing must never do

- No fixed SunRey/MoonRey ratio. Each coin is its own leg type with a
  singular discriminant. There is no shared amount field, no numeraire, and
  no field on which a cross-coin rate could be written.
  `ConsiderationTerms` pins `impliedCoinConversion: false` and
  `commonNumeraire: null`.
- No coin issuance. `ACCESS_FABRIC_POSTURE` pins `mintsSunReyCoin` and
  `mintsMoonReyCoin` to `false`; every receipt carries `mintsCoin: false`.
- No third currency. A native leg whose declared asset id is not the
  canonical asset id for its kind is refused.
- Entitlement capacity is not transferable money. The entitlement port has
  no transfer operation, and every entitlement or reward leg pins
  `transferable: false` and `redeemableForMoney: false`.
- No competing balance ledger. Reservations and receipts record commitments
  and rail references. Fiat position is read from the Ledger projection,
  native position from custody or chain, and entitlement position from the
  entitlement owner.

## Settlement semantics

`DELIVERY_VERSUS_PAYMENT` commits consideration only against attested
delivery. `RESERVATION_VERSUS_CONSIDERATION` commits consideration against
a confirmed reservation of future capacity, with delivery attested later.

Legs commit together. If a later leg fails after an earlier one committed,
the receipt reports `REQUIRES_COMPENSATION` and carries compensating
refund intents. A posted journal, custody transfer, chain transfer, or
entitlement consumption is never edited or deleted.

Partial delivery captures the exact prorated share using integer
arithmetic and returns the remainder by compensating intent, so captured
plus returned is exactly the reserved amount per denomination.

## Regulated execution stays gated

`evaluateCapacityAccess` runs before any settlement and returns its
refusal unchanged. A refused reservation reserves no consideration, posts
no journal, moves no asset, and consumes no entitlement. Regulatory
compatibility is a filter, not a score: in RFQ, `filterPermittedQuotes`
runs before ranking, so a non-permitted quote cannot win under any
weighting.

Fiat and native-coin consideration require a signed Execution Authority.
Entitlement-only and reward-only reservations consume a prior grant at the
owning port and move no money, so they do not need one.

## Demo

```
npm run demo:sunrey-exchange-capacity-access
```
