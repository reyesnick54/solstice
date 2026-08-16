# Runbook — validator equivocation response

Simulation / development only. This is not a legal conclusion and
not a licensed slashing procedure.

## When to use

A node reports `evidence_valid` / `EvidenceIncluded` for
`DOUBLE_PROPOSAL`, `DOUBLE_PREVOTE`, or `DOUBLE_PRECOMMIT`.

## Immediate checks

1. `sunrey-node evidence show <id>` — confirm both public keys,
   signatures, height, round, and conflicting block ids.
2. `sunrey-node evidence verify <id>` — local verification must
   succeed. If it fails, treat the payload as false evidence.
3. `sunrey-node validator accountability <validator>` — inspect
   pending versus active status. Jail / tombstone is pending until
   the next epoch boundary.
4. Confirm `ENVIRONMENT=simulation` and that no `LIVE_*` flag is on.

## Expected deterministic outcomes (policy v1)

- Double prevote → jail + 25% remaining simulation bond.
- Double proposal or double precommit → tombstone + 50% remaining
  simulation bond.
- Receipt is append-only. The same `EvidenceId` cannot penalize
  twice.

## What not to do

- Do not debit customer fiat, SunRey Coin, or MoonRey.
- Do not ask an AI system to jail, tombstone, or penalize.
- Do not rewrite the committed validator-set hash mid-height.
- Do not restore a tombstoned identity/key without a later
  explicit governance rule.
- Do not treat missed votes as fraud.

## After the epoch boundary

Confirm the active set hash changed and the offender has zero
voting power. If remaining eligible power still meets
`2/3 + 1`, the development network may continue.
