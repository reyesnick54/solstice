# Formal model assumptions

These assumptions are part of the model, not hidden exclusions.

## Consensus

- Voting power is a positive integer. Quorum is strictly greater than
  two-thirds: `power > ⌊2 · total / 3⌋`.
- Safety is claimed only while Byzantine voting power is below one-third.
- Smoke uses 3 honest validators. Extended uses 4 validators.
- Timeouts and networking are abstracted. The model checks safety, not
  liveness under asynchrony.
- Bounded heights and rounds. Bounded checking does not prove
  unlimited-state correctness.

## Signer

- One signing authority per validator identity.
- Same value may be retried. A different value at the same
  `(height, round, step)` is refused.
- Restore must not roll the watermark backwards.

## Validator set

- The active set changes only at an epoch boundary.
- Jail/tombstone zeroes voting power.
- Set hash is the SHA-256 of the sorted canonical encoding.

## Governance

- No governance token. AI cannot authorize or activate.
- Installing a binary does not change active protocol rules.
- Activation occurs only at the plan's activation height.

## Assets, fees, DVP, MoonRey, interop

- Integer minor units only. No floating point.
- Cross-asset arithmetic cannot create quantity.
- Interop uses `DEV_INTEROP_TEST_ASSET` only. No production SunRey Coin,
  MoonRey Coin, or fiat bridge.
- Trace conformance is evidence of alignment; it is not a mathematical
  proof that implementation and model are equivalent.
