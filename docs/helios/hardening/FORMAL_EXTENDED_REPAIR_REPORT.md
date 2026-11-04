# FORMAL_EXTENDED campaign repair (HELIOS HARDENING — HEALTH04)

**Qualification:** `SUNREY_FORMAL_EXTENDED_QUALIFIED`

**Date:** 2026-11-04 (Asia/Riyadh)

## Summary

The scheduled `Formal extended` GitHub Actions workflow failed with a **property counterexample** on `CONSENSUS_SAFETY` / `LOCK_RULE_PRESERVES_SAFETY`. The executable twin allowed consensus steps **after** the current height was already finalized when `MaxHeight` prevented height advance. That path does not match the Rust engine (finality ends the height). The model was tightened; bounds and invariants were **not** reduced.

## Reproduction (matches CI)

```bash
npm ci --ignore-scripts
FORMAL_PROFILE=FORMAL_EXTENDED npm run test:formal-extended
```

Same as `.github/workflows/formal-extended.yml` (`node` 22, `FORMAL_PROFILE=FORMAL_EXTENDED`, then `cargo test -p sunrey-formal --locked`).

### Pre-fix failure (GitHub run `41829956762`, 2026-11-04 ~15:31 Riyadh)

| Field | Value |
| --- | --- |
| **Failure type** | `PROPERTY_COUNTEREXAMPLE` (not timeout, not tool error) |
| **Model** | `CONSENSUS_SAFETY` |
| **Property** | `LOCK_RULE_PRESERVES_SAFETY` |
| **Profile / bounds** | `FORMAL_EXTENDED`: 4 validators, `maxHeight=2`, `maxRound=2`, values `{A,B,NIL}` |
| **States explored before abort** | 5,419,008 |
| **Runtime** | ~28 minutes (exploration completed; invariant failed) |

### Counterexample state (first failing state, local replay)

At height 2 with `finalized[2] = A` and `lockedValue = B` (lock applied after height 2 was already committed at `A`, while height could not advance past `MaxHeight=2`).

```json
{
  "height": 2,
  "round": 0,
  "lockedValue": "B",
  "validValue": "B",
  "finalized": { "1": "A", "2": "A" },
  "finalizedHeight": 2
}
```

## Root cause

The bounded `Next` relation did not treat a **finalized current height** as terminal. After `Commit(A)` at `height = MaxHeight`, the model kept height at 2 but cleared votes and allowed new prevotes, a `Lock(B)`, while `finalized[2]` remained `A`. Real engine behavior: once a height finalizes, no further lock/prevote/precommit cycle runs at that height (`ALGORITHM.md` commit step advances or completes the height).

The TLA+ stub `LockPreservesSafety` only checked `lockedValue` typing; the executable twin correctly encoded the stronger lock-vs-finality rule but the transition system was too permissive post-commit at the height cap.

## Fix

1. **`packages/sunrey-chain/src/formal/models/consensus.ts`** — if `state.finalized[state.height]` is set, return no transitions (height finished).
2. **`packages/sunrey-chain/formal/tla/ConsensusSafety.tla`** — align `LockPreservesSafety` with the executable invariant (lock must agree with finalized value at current height).

No invariants removed, no bounds lowered, no properties skipped, no timeouts increased.

## Validated properties (extended campaign, post-fix)

| Property / area | Result |
| --- | --- |
| `CONSENSUS_SAFETY` (all listed invariants + action props) | `VERIFIED_WITHIN_MODEL_BOUNDS` |
| `LOCK_RULE_PRESERVES_SAFETY` | Verified |
| `NIL_DOES_NOT_CREATE_BLOCK_COMMIT` | Verified |
| Validator-set / wrong-set vote rejects | Verified (`WRONG_VALIDATOR_SET_VOTE_INVALID`) |
| Round / height vote rejects | Verified (`WRONG_ROUND_VOTE_INVALID`, `WRONG_HEIGHT_VOTE_INVALID`) |
| `VALIDATOR_SET_TRANSITION` | Verified |
| `cargo test -p sunrey-formal --locked` | 3/3 passed |

## Post-fix metrics (`FORMAL_EXTENDED`)

| Field | Value |
| --- | --- |
| **Model** | `CONSENSUS_SAFETY` |
| **Bound** | 4 validators, height 2, round 2 |
| **State-space size (explored)** | 2,322,444 |
| **Final result** | `VERIFIED_WITHIN_MODEL_BOUNDS` |
| **Full campaign** | Node extended CLI + Rust formal tests green locally |

Report artifact: `packages/sunrey-chain/formal/reports/formal_extended.json`.

## Merge gate

Re-run the exact GitHub extended workflow (`npm run test:formal-extended` with `FORMAL_PROFILE=FORMAL_EXTENDED`) on the merge branch before treating production hardening as closed.
