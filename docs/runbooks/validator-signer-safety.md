# Validator signer safety

The consensus signer persists state **before** releasing a
signature. Conflicting requests for the same chain, height, round,
and message type are rejected.

Protected cases:

- two different proposals at the same height/round
- two different non-NIL prevotes at the same height/round
- two different non-NIL precommits at the same height/round

Identical replay of the same canonical bytes is allowed (restart
idempotence).

State stored (no private keys):

- `validator_id`, `chain_id`
- `last_signed_height`, `last_signed_round`, `last_signed_step`
- `canonical_sign_bytes_hash`, `signature_reference`, `updated_at`

Writes are temp-file + `fsync` + rename. After a crash, reopen the
same path; a conflicting follow-up must still be refused.

One signing process per consensus key. Do not run two nodes with
the same voting key.
