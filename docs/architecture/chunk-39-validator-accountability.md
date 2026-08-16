# Chunk 39 — SunRey validator evidence and accountability

Implemented on latest `main` after Chunks 32R–35R. Chunk 36 was a
stop record when this work started; the development validator
control plane required by evidence verification is included here
and recorded as Chunk 36R. There was no merged Chunk 37/38 BFT
engine. This chunk adds the accountability layer on signed
Tendermint-family proposal / prevote / precommit bytes and the
existing development producer. It is **not** production consensus
and **not** a public slashing market.

Canonical owner: `packages/sunrey-chain` (`packages/sunrey-chain/node`).
Do not create `packages/validators`, `packages/staking`,
`packages/slashing`, or `packages/consensus-engine`.

## Evidence types

Automatic deterministic penalties require a cryptographic proof:

| Type | Message | Development default |
| --- | --- | --- |
| `DOUBLE_PROPOSAL` | two valid proposals, same validator / height / round, different block ids | `TOMBSTONE` + 50% remaining simulation bond |
| `DOUBLE_PREVOTE` | two valid prevotes, same coordinates, different block ids | `JAIL` + 25% remaining simulation bond |
| `DOUBLE_PRECOMMIT` | two valid precommits, same coordinates, different block ids | `TOMBSTONE` + 50% remaining simulation bond |

Reserved, not automatically penalized:

- `INVALID_STATE_PROPOSAL`
- `CONSENSUS_LIVENESS_VIOLATION`

Missed votes are not Byzantine fraud.

## Evidence verification

Independent verification requires all of:

- same validator, chain, network
- membership in the **historical** validator set at the offense height
- same height, round, and message type
- conflicting canonical content (`block_id`)
- both signatures valid
- both signatures from the same consensus or proposal key
- that key matches the historical set (not the current key after rotation)
- evidence within `MAX_EVIDENCE_AGE_HEIGHTS` (16)
- evidence id not previously processed

False or malformed evidence is rejected. Relay does not make
evidence valid.

## EvidenceId

`EvidenceId = SHA-256(type || ordered(left, right))`.

The two signed messages are ordered by canonical encoding so
submission order cannot change identity.

## Evidence pool and gossip

Bounded pool (`MAX_POOL_SIZE = 64`):

- verify before admit
- dedup, age, size limits
- priority: precommit > proposal > prevote
- persistence under the node data dir
- states: `PENDING`, `GOSSIPED`, `INCLUDED`, `PROCESSED`

Gossip uses the authenticated P2P `CONSENSUS_RESERVED` channel
(`EvidenceAnnounce` / `Request` / `Response`). Peers may relay.
Invalid evidence increases the sender misbehavior score.

## Block inclusion and finality

A proposer may include up to eight verified evidence objects.
The block header commits to `evidence_root` and the **active**
`validator_set_hash`. Evidence becomes authoritative only when
the block is applied.

## Epoch integration (safe behavior)

If evidence finalizes during epoch N:

1. The policy decision and `AccountabilityReceipt` are recorded
   immediately.
2. Jail / tombstone / bond changes are written to the **pending**
   next set only.
3. The committed active validator-set hash changes only at the
   epoch boundary (`height % epoch_length == 0`).

This avoids mutating a committed set hash mid-height. A jailed or
tombstoned validator remains historically identifiable and cannot
silently restore itself.

## Simulation bond penalty

Penalties apply only to `SIMULATION_BOND` integer units:

- `bond_units`
- `locked_units`
- `penalized_units`
- `remaining_units`

Exact integer arithmetic. Append-only receipts. No balance rewrite.

Never debit:

- customer fiat journals
- bank accounts
- investment accounts
- customer SunRey Coin balances
- MoonRey balances

There is no yield or staking-reward product.

## Observability and operator API

Metrics / events: `evidence_received`, `evidence_valid`,
`evidence_invalid`, `evidence_duplicate`, `evidence_included`,
`validator_jailed`, `validator_tombstoned`,
`simulation_bond_penalized`, `evidence_processing_latency`,
`evidence_pool_size`.

```
sunrey-node evidence list
sunrey-node evidence show <id>
sunrey-node evidence verify <file/id>
sunrey-node validator offenses <validator>
sunrey-node validator accountability <validator>
```

Reads expose hashes and signatures only. No private keys.

## Policy version

`ValidatorAccountabilityPolicy` version `1`. The policy hash is
the SHA-256 of the versioned outcome table. This is development
policy, not a legal or regulatory conclusion.

## Legal / regulatory status

`RESEARCH_REQUIRED`. Nothing here is a licensed slashing regime,
securities offering, or counsel-confirmed rule. No rule is
`CONFIRMED_BY_COUNSEL`.

## Demo

`npm run demo:sunrey-accountability` runs the four-validator
devnet, constructs a controlled double-prevote, gossips evidence,
finalizes it, jails the offender, records the simulation penalty,
rejects replay, and continues with remaining voting power.
