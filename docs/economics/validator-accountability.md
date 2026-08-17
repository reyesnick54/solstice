# Validator accountability economics

Penalties use the canonical evidence taxonomy:

- `DOUBLE_PROPOSAL`
- `DOUBLE_PREVOTE`
- `DOUBLE_PRECOMMIT`

Reserved or unverified types do not create automatic protocol
penalties. Forged, replayed, or suspicion-only inputs are refused.

## Policy

Each rule records violation class, required evidence, bond impact in
basis points, reward forfeit, jail behavior, tombstone behavior, and
policy version.

Development defaults follow Chunk 39: prevote jails with a 25% bond
impact; proposal and precommit tombstone with a 50% bond impact.

## Isolation

Only the validator bond/reward domain may be affected. Customer
wallets, custody customer assets, Exchange customer balances, fiat
Ledger balances, and unrelated machine escrow cannot be debited.

## No double penalty

One canonical evidence ID executes a given penalty at most once.

Jailed validators follow existing consensus eligibility (not eligible
to vote) plus the economic effects of the active penalty policy.
Tombstoned identities require explicit governance for any future
readmission path.
