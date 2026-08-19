# Chunk 122 — MoonRey Attribution Accounting, Replay Protection, and Reconciliation

Canonical owner: `packages/sunrey-chain/src/productive/policy-governance`.

This chunk is the non-monetary attribution book for verified productive
events. "Attribution accounting" means a record of which portion of an
event has already been assigned to which contribution. It is not:

- `AssetSupplyBook`
- the customer ledger
- a wallet balance
- MoonRey supply
- an Exchange balance

Event identity (Chunk 120) and attribution policy (Chunk 121) are
consumed as inputs. This layer does not own a second monetary ledger
and does not calculate the Productive Value Function.

## Share invariant

For one canonical event:

```
sum(finalized and reserved attribution shares) <= policy maximum aggregate share
```

Arithmetic is bigint only. The default scale is `1_000_000` (100%).
A single manufacturing hour cannot also receive 100% goods and 100%
automated-machine credit.

## Reservation

A contribution moving toward future Productive Value Function
evaluation must reserve its share first. Concurrent claims cannot both
assume that 100% remains available. The implementation is an in-memory
simulation book.

The same event / claim / contribution / policy / decision tuple is
idempotent. Retries do not consume attribution twice.

## Replay protection

Replay detection uses canonical event identity rather than superficial
object IDs:

- same contribution
- same claim
- same event under a new object ID
- same event under a new category
- same batch resubmission
- same oracle evidence rewrapped in a new claim
- controller switching
- minor time-window perturbation (60-second quantization)
- unit alias changes (`units_produced` / `UNIT`)

## Time windows and batches

Windows are half-open `[from, until)`. Adjacent production cycles
(`12:00–13:00` then `13:00–14:00`) are distinct. Nested or overlapping
slices of one evidenced hour cannot each take a full share.

Explicit lineage supports legitimate batch split, merge, and lot
aggregation. A split must not increase total attributable production.
A merge must not fabricate new goods production.

## Corrections

History is never deleted. Corrections supersede or release an entry
and append a correction record. If issuance status is already
`SETTLED`, the book flags `MONETARY_ADJUSTMENT_REVIEW_REQUIRED` and
does not modify customer balances or claw back MoonRey.

The book may record `NOT_VALUED`, `VALUED`, `AUTHORIZED`, or
`SETTLED`. It does not perform those transitions.

## Eligibility

Attribution-sensitive categories (`MANUFACTURING`, `GOODS`,
`AUTOMATED_MACHINE_OUTPUT`, `COMPUTE`, `AI_COMPUTE`) require a valid
`ProductiveAttributionDecision` and available share before proceeding.
Independently evidenced logistics and storage receive their own event
bucket.

## Reconciliation

`ProductiveAttributionReconciliationReport` counts events, claims,
contributions, fully/partially/unattributed events, over-allocation,
replays, overlaps, splits, and settled corrections requiring review.
The expected normal invariant is `overAllocatedEvents = 0`.

## Demo

```
npm run demo:moonrey-attribution-reconciliation
```

Prints:

```
EVENT_OVERALLOCATIONS=0
REPLAY_INCREASED_ATTRIBUTION=false
CATEGORY_RELABEL_INCREASED_ATTRIBUTION=false
ATTRIBUTION_BOOK_IS_MONETARY_LEDGER=false
PRODUCTION_ACTIVE=false
```
