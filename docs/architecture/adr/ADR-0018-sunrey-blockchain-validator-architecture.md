# ADR-0018 — SunRey Blockchain validator architecture

- Status: ACCEPTED_FOR_ENGINEERING
- Legal / regulatory confidence: RESEARCH_REQUIRED
- Date: 2026-08-16
- Affected subsystem: SUNREY_CHAIN
- Depends on: ADR-0016, ADR-0017, ADR-0024
- Implementation status: NOT_IMPLEMENTED

## Context

Deterministic BFT requires an identifiable validator set. SunRey also
requires that AI agents cannot become silent governors of money or
chain activation. Validator keys are high-value secrets, distinct from
application `KeyProvider` purposes already implemented in
`packages/security`.

## Decision

1. Validators are bonded, named protocol principals with:
   - a consensus voting key
   - a distinct network/P2P key
   - an optional fee/reward address that is **not** a fiat ledger account
2. Voting power is explicit integer units. No floating-point.
3. Validator-set changes occur at epoch boundaries through the
   state machine, included in the next block's header commitment.
4. Equivocation and double-signing produce evidence objects. A later
   slashing module may burn or lock *native protocol bonds only*.
   Slashing must never debit canonical fiat journals.
5. AI agents, robots, and devices may be **described** as economic
   actors on-chain. They must not hold validator voting keys and must
   not vote.
6. Sovereign / regional participation is an admission and jurisdiction
   question for humans and legal entities, not an algorithm that
   auto-includes a geography.
7. No production validator set is created in this chunk. Genesis
   validator lists for any later test-network placeholder remain
   `PRODUCTION_DISABLED`.

### Key separation

| Key | Role | Must not |
| --- | --- | --- |
| Consensus voting key | prevote / precommit | Sign RPC, sign Execution Authority, sit in app config |
| P2P node key | authenticated gossip | Vote, spend assets |
| Chain operation key | existing `CHAIN_OPERATION_SIGNING` simulation purpose | Become a validator key |
| Execution Authority HMAC | Kernel only | Live on a validator host as the consensus key |

## Alternatives considered

- **Permissionless anonymous validators from day one.**
- **AI-operated validators under a mandate.**
- **Reuse Execution Authority or `CHAIN_OPERATION_SIGNING` keys as
  consensus keys.**
- **Unbonded proof-of-authority names only.**

## Why rejected

- Anonymous day-one permissionlessness conflicts with sovereign
  accountability and Travel Rule / VASP research still
  `RESEARCH_REQUIRED`.
- AI-operated validators would let agents change blockchain
  governance. That is forbidden.
- Key reuse collapses the TCB and the Kernel signing plane.
- Unbonded names lack slashable accountability for double-sign.

## Security implications

Stolen validator keys can halt liveness or, at sufficient voting
power, violate safety. Compromise procedures must rotate keys at an
epoch boundary and record evidence. Validator hosts are a distinct
trust zone from RPC, exchange matching, and accounts services.

## Compliance implications

Operating a validator, accepting bonds, or distributing rewards may
be regulated. No public staking product is authorized. No counsel
confirmation exists.

## Operability implications

Runbooks must cover double-sign prevention (one signing process per
key), clock discipline, and evidence submission. Geographic
distribution is an operational choice constrained by BFT latency, not
a decentralization claim.

## Migration implications

Simulation adapter identities (`cad_simulation`) are not validators.
A later genesis file must not import simulation chain IDs as
production voting power.

## Unresolved questions

- Bond asset: native protocol units versus a non-transferable
  admission credential.
- Minimum validator count and regional diversity rules.
- Hardware-enforced signing (Chunk 33).

## Status

`ACCEPTED_FOR_ENGINEERING` for bonded identifiable validators and key
separation. Production validators: **not implemented**. Legal
confidence: `RESEARCH_REQUIRED`.
