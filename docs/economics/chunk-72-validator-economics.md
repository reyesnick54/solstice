# Chunk 72 — Validator economic-security layer

SunRey validators remain governed, accountable principals. Admission
stays under the existing governance architecture. This layer does not
convert SunRey into anonymous permissionless proof-of-stake.

## Bond architecture

`ValidatorBondPosition` tracks validator ID, bond asset, bonded
quantity, active locked quantity, pending unbond, rewards, penalties,
policy version, activation epoch, and state.

Bond states `UNBONDED`, `BONDING`, `BONDED`, `UNBONDING`, `JAILED`,
`TOMBSTONED`, and `EXITED` map onto the existing validator lifecycle
(`CANDIDATE` → `BONDED` → `ACTIVE` → `PENDING_EXIT` → `EXITED`, plus
jail/tombstone). They are not an independent membership machine.

Bonding uses exclusive native-lock semantics (`VALIDATOR_BOND`). A
bonded unit cannot simultaneously be spent, withdrawn, Exchange
reserved, machine escrowed, interop escrowed, or bonded to another
validator.

Bond eligibility, validator admission, and voting power stay distinct.
This chunk does not implement 1 coin = 1 vote.

## Production bond asset status

`UNCONFIGURED`. Development uses `DEVELOPMENT_SUNREY_COIN` (fixture).
Rehearsal uses `REHEARSAL_SUNREY_COIN` (fixture).

## Reward architecture

`ValidatorRewardPolicy` is versioned. Approved sources are transaction
fee allocation, an explicit validator reward pool, and other
monetary-policy-approved sources. There is no hidden inflation.

Entitlement uses deterministic integer weights from participation
evidence (expected/valid/missed votes, proposal duty, voting power,
epoch membership). Allocated rewards equal paid amounts plus an
explicit remainder destination.

Fee disposition `VALIDATOR_REWARD_POOL` enters this accounting.

## Penalty architecture

`ValidatorPenaltyPolicy` records violation class, required evidence,
bond impact, reward impact, jail/tombstone behavior, and version.
Protocol penalties require valid equivocation evidence. Monitoring
suspicion cannot slash. One evidence ID cannot execute the same
penalty twice. Customer wallets, custody, Exchange balances, fiat
ledger balances, and unrelated machine escrow cannot be debited.

## Unbond behavior

Unbond request creates a pending quantity. Release is allowed only
after the governed delay and accountability window. Immediate
withdrawal is rejected.

## Formal and adversarial results

The bounded `VALIDATOR_ECONOMICS` model checks bond conservation, no
duplicate reward/penalty, unbond delay, customer isolation, invalid
evidence refusal, and deterministic policy version within stated
bounds.

Chunk 57 range scenarios cover equivocation penalty, forged/replayed
evidence, duplicate reward/penalty, customer-asset penalty attempts,
immediate unbond, wrong policy version, and reward overflow.

## Concentration analysis

Engineering metrics report total bonded quantity, bond concentration,
reward distribution, penalty exposure, bond-at-risk, voting-power
concentration, operator concentration, and an attack-cost proxy under
explicit assumptions. They do not claim guaranteed economic security.
