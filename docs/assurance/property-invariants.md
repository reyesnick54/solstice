# Property invariants

All quantities are integer minor units. Clocks and RNG used by campaigns
are seeded. Wall-clock time is not an input to consensus or economic
generators.

## Consensus

- An invalid signature never adds voting power.
- A duplicate vote never adds voting power twice.
- Wrong height, round, validator set, or network never counts.
- NIL cannot create block finality.
- Less than strict +2/3 voting power cannot finalize.
- One honest validator cannot sign conflicting values at the same
  height/round/type.
- Two conflicting blocks cannot both receive a valid commit under the
  modeled fault assumptions.
- Committed height never decreases.
- A finalized block is not replaced by fork-choice logic.
- Round changes do not discard safety locks.
- Validator-set transitions occur only at permitted boundaries (covered
  by existing validator-set tests; campaign uses a fixed set).

## Native assets

`issued - burned = circulating + locked` for `SUNREY_COIN` and
`MOONREY_COIN`. No negative quantity, overflow, or cross-asset
arithmetic. Locked quantity is unavailable. Unlock does not create
value. Burn cannot exceed available quantity. Issuance authorizations
cannot replay.

## Fees

`actual_fee <= max_fee`. `reserved = charged + released`. Disposition
reconciles. Failed atomic execution creates no partial application
state. Unsupported fee assets are rejected.

## Wallet / account

Insufficient signatures never authorize. A duplicate signer never
satisfies a threshold twice. A revoked key cannot sign new
transactions. A historical valid signature remains verifiable. A
delegated key cannot exceed its mandate. A watch-only account cannot
sign (existing wallet unit tests).

## Oracle

Aggregation is deterministic independent of insertion order where the
policy is median / weighted median. Insufficient quorum never produces a
`VERIFIED` fact (engine tests). Stale observations cannot support new
facts. Wrong units are rejected. A duplicate provider observation does
not count twice.

## MoonRey issuance

The same contribution cannot issue twice. Reordered oracle/upstream
inputs do not change the contribution fingerprint. Capacity, output, and
delivery remain distinct claim types. Epoch and category caps hold in
the formula (`moonreyQuantity <= maximum`). Supply reconciliation is
exact.

## Machine economy

A machine cannot exceed capability, spending, or resource mandates, and
cannot become a validator or governor. Escrow conservation and partial
delivery remain exact in the existing machine-economy tests. A revoked
machine cannot create a new valid action.

## Exchange

Reserved + available + pending settlement reconciles. An order cannot
fill beyond its original quantity. A trade quantity cannot settle twice.
Atomic DVP applies every leg or none. Cancel releases only the remaining
reservation.

## Interoperability

An invalid proof never mutates state. A packet executes at most once.
Wrong source/destination, replayed acknowledgement, and frozen clients
are rejected. Relayer input never bypasses verification.
