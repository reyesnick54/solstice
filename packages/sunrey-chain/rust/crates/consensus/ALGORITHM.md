# SunRey BFT lock-rule implementation note

This crate implements a **development** Tendermint-class BFT engine.
It is not a production consensus deployment and does not authorize a
public network.

## Specification adopted

Safety-critical lock / valid-value / NIL / round-change rules follow
**Tendermint consensus Algorithm 1** as published in:

- Ethan Buchman, Jae Kwon, Zarko Milosevic, *The latest gossip on BFT
  consensus*, arXiv:1807.04938, 2018.
- The same rules as documented for Tendermint Core / CometBFT in
  `github.com/tendermint/spec` (`consensus/consensus.md`) and the
  CometBFT specification (`docs.cometbft.com`, consensus section).

The engineering family is ADR-0017: bonded identifiable validators,
weighted voting power, `f < 1/3` Byzantine power, deterministic
finality after strictly more than two-thirds PRECOMMIT, round changes
under partial synchrony.

This is a constrained Rust engine, not a CometBFT library import.

## Rules adopted (not simplified)

1. **Steps.** `NEW_HEIGHT → PROPOSE → PREVOTE → PRECOMMIT → COMMIT →
   FINALIZED`. `NEW_HEIGHT` and `FINALIZED` are SunRey step names
   around the Tendermint propose/prevote/precommit/commit cycle.

2. **Lock.** On the first `+2/3 PREVOTE` for a valid value `v` at
   `(h, r)` while `step = PREVOTE`:
   - `locked_value ← v`
   - `locked_round ← r`
   - broadcast `PRECOMMIT(h, r, id(v))`
   - `step ← PRECOMMIT`

3. **Valid value.** On `+2/3 PREVOTE` for valid `v` at `(h, r)` while
   `step ≥ PREVOTE` (first time for that round):
   - `valid_value ← v`
   - `valid_round ← r`
   A later proposer at the same height re-proposes `valid_value`
   instead of calling the application.

4. **Prevote decision (combined paper lines 22–34).** Upon a proposal
   `(v, vr)` from the expected proposer while `step = PROPOSE`:
   - prevote `id(v)` if `v` is valid and any of:
     - `locked_round = −1` (unlocked), or
     - `locked_value = v`, or
     - `vr ≥ 0` and `vr ≥ locked_round` and there is a `+2/3 PREVOTE`
       quorum for `id(v)` at round `vr` (proof-of-lock / unlock)
   - otherwise prevote `NIL`

5. **NIL.** `PREVOTE(NIL)` and `PRECOMMIT(NIL)` are first-class. NIL
   cannot form a `CommitCertificate`. `+2/3 PREVOTE(NIL)` in
   `PREVOTE` produces `PRECOMMIT(NIL)`.

6. **Round change.** `+2/3 PRECOMMIT(*)` (any values, including NIL)
   schedules `timeoutPrecommit`. On that timeout, or when the
   configured prevote/propose timeouts fire without a lock, the
   engine starts `round + 1` without clearing `locked_*` or
   `valid_*`. Locks clear only when the height finalizes.

7. **Commit / finality.** Strictly more than two-thirds of **active**
   voting power `PRECOMMIT` the same non-NIL block ID at the same
   `(height, round)`. The engine then:
   - builds an independently verifiable `CommitCertificate`
   - applies the block to the application **once**
   - persists the certificate
   - advances height
   There is no longest-chain reorganization.

8. **Proposer selection.** Weighted round-robin with persisted
   `proposer_priority`, matching Tendermint/CometBFT
   `IncrementProposerPriority`: each active validator adds its
   integer voting power; the maximum priority (tie-break:
   validator ID) is selected and then subtracts total active power.
   `select_proposer(set, height, round)` is the path-independent
   function used by vectors: it starts from zero priorities and
   applies `(height − 1) + round + 1` increments.

9. **Signer safety.** Tendermint FilePV / privval last-sign-state:
   persist `(height, round, step, block_id)` **before** signing.
   Refuse a conflicting proposal, prevote, or precommit for the
   same `(height, round)`. Same value may be re-signed after
   crash recovery.

10. **Quorum arithmetic.** Checked integer only.
    `exceeds_two_thirds(power, total) ⇔ power > ⌊2·total / 3⌋`.
    `exceeds_one_third(power, total) ⇔ power > ⌊total / 3⌋`.
    Equality is not a strict majority. `f_max = ⌊(n−1)/3⌋` in
    validator-count form; power form uses the same strict
    inequalities.

## What this note does not claim

- Production readiness, mainnet, public staking, or slashing
  runtime.
- Network-wide adversarial scenarios (Chunk 38).
- A full validator registry / bonding product (Chunk 36R).
- Library CometBFT compatibility at the wire format.
