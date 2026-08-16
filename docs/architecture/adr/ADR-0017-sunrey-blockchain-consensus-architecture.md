# ADR-0017 — SunRey Blockchain consensus architecture

- Status: ACCEPTED_FOR_ENGINEERING
- Legal / regulatory confidence: RESEARCH_REQUIRED
- Date: 2026-08-16
- Affected subsystem: SUNREY_CHAIN
- Depends on: ADR-0016, ADR-0018
- Implementation status: IMPLEMENTED (development Tendermint-class engine at packages/sunrey-chain/rust/crates/consensus; production consensus not implemented)

## Context

A sovereign economic chain needs **deterministic finality**. Nakamoto
longest-chain finality is a probability, not a settlement fact.
SunRey already treats financial journals as authoritative only after
Kernel-gated posting. A chain that can reorg "final" native asset
state would create a second, weaker ledger.

Chunk 31 must choose an engineering direction without implementing
production consensus.

## Decision

1. **Family:** Byzantine-fault-tolerant consensus over a bonded
   validator set (BFT-style proof-of-stake / proof-of-authority-bond).
2. **Engineering direction:** Tendermint-family BFT (CometBFT-class:
   propose / prevote / precommit / commit, `f < n/3`, deterministic
   finality on commit).
3. **Interface freeze:** later chunks implement a `ConsensusEngine`
   module boundary, not a vendor import in application code.
4. **Development engine (Chunk 37):** a constrained Rust
   Tendermint-class `ConsensusEngine` at
   `packages/sunrey-chain/rust/crates/consensus`. Algorithm rules
   follow Buchman/Kwon/Milosevic 2018 and the Tendermint Core /
   CometBFT lock specification. See
   `packages/sunrey-chain/rust/crates/consensus/ALGORITHM.md`.
5. **Not implemented:** no production consensus, no public validator
   network, no slashing runtime, no mainnet.
6. **Remaining experiment:** whether a later DAG mempool
   (Narwhal-class) sits *behind* the same interface; production
   timeouts and block-size limits.

### Frozen consensus interface

```text
ConsensusEngine
  propose(height, round, value) -> Proposal
  prevote(height, round, id)
  precommit(height, round, id)
  commit(height, block) -> FinalizedBlock
  applyValidatorSet(next) -> ValidatorSet
  submitEvidence(equivocation | double-sign)
  recoverFromWal() -> Height
```

Application code sees only `FinalizedBlock`. Execution is a pure
function of `(pre_state, block.transactions)`.

### Comparison

| Criterion | Tendermint-family BFT | HotStuff-family | Classic PBFT | Nakamoto PoW / longest-chain PoS | DAG + BFT (Narwhal/Bullshark-class) |
| --- | --- | --- | --- | --- | --- |
| Safety | Yes if `f < n/3` | Yes if `f < n/3` | Yes if `f < n/3` | Probabilistic | Yes if BFT layer holds |
| Liveness | Partial synchrony; may stall in partition | Pipelined; still needs synchrony assumptions | View-change heavy | Progress if majority hash/stake honest | High throughput if network healthy |
| Deterministic finality | Yes on commit | Yes on commit | Yes | No | Yes on BFT commit |
| Validator accountability | Evidence + bonding | Evidence + bonding | Weaker historically | Weak (nothing-at-stake without extra rules) | Evidence possible |
| Byzantine tolerance | `f < n/3` | `f < n/3` | `f < n/3` | 51% resource | `f < n/3` on BFT |
| Validator-set changes | Epoch / EndBlock, mature in Cosmos | Supported; implementation-specific | Awkward | Implicit via power | Implementation-specific |
| Network partitions | Safety preserved; liveness may halt | Safety preserved; liveness may halt | Safety preserved | Can fork | Safety depends on BFT layer |
| Double-signing | Detectable, slashable | Detectable | Detectable | Possible on forks | Detectable on BFT votes |
| Equivocation | Vote evidence | Vote evidence | Vote evidence | Fork choice | Vote evidence |
| Recovery | WAL + state sync | WAL + state sync | View change | Reorg | Complex catch-up |
| Slashing / accountability | First-class in PoS designs | First-class if bonded | Usually not | Optional | Optional |
| Upgradeability | Coordinated halt or in-protocol | Same | Poor | Soft/hard forks | Same as BFT |
| Operational complexity | Moderate-high; well documented | Higher if custom | High | Mining/staking markets | High |
| Geographic distribution | Supported; latency sets block time | Pipelining helps latency | Sensitive | Global by design | Sensitive to dissemination |
| Sovereign / regional validators | Permissioned or bonded set | Same | Consortium | Permissionless only | Same as BFT |
| Performance | Hundreds–low thousands TPS class for complex state | Often better pipelined latency | Lower | Throughput vs finality tradeoff | High mempool throughput |
| Implementation risk | Lowest mature open family | Higher unless adopting a full existing stack | High (legacy) | Wrong finality model | High (extra moving parts) |

## Alternatives considered

- **HotStuff-family as the first implementation.** Strong theory and
  pipelining (Diem / Aptos / Sui lineages). Rejected as the *first*
  frozen algorithm because a sovereign financial chain should start
  from the most operationally documented deterministic-finality
  family. The interface allows a later swap if experiments justify it.
- **Nakamoto proof-of-work or longest-chain PoS.** Rejected: no
  deterministic finality; reorgs conflict with settlement anchors and
  the existing "chain reorg does not rewrite the ledger" rule.
- **Classic PBFT without a modern validator-set story.** Rejected:
  view-change complexity and weak validator-set change practice.
- **Pure proof-of-authority without bonds.** Rejected as the sole
  model: insufficient accountability for double-sign. A permissioned
  *admission* of validators is allowed; accountability still requires
  identifiable keys and equivocation evidence.
- **Invent a novel consensus.** Rejected: sovereignty is control of
  the economic state model, not a new BFT paper.

## Why rejected

See the table. Financial settlement cannot wait for probabilistic
finality. A novel protocol would add implementation risk without
sovereignty benefit.

## Security implications

BFT safety fails if more than one-third of voting power is Byzantine
or if validator keys are stolen at that scale. Double-sign evidence
must be gossiped and applied. A partitioned honest majority must not
finalize conflicting blocks. Consensus votes are not Execution
Authority and must not post canonical ledger journals.

## Compliance implications

Validator participation, staking, and slashing may be regulated
activities in some jurisdictions. Those questions are
`RESEARCH_REQUIRED`. This ADR does not authorize a public staking
product, a security offering, or a live validator market.

## Operability implications

Operators need explicit height, round, voting-power, evidence, and
halt metrics. A liveness halt is preferable to an unsafe commit.
State sync must authenticate against the last app-hash.

## Migration implications

Simulation finality (`ENGINEERING_FIXTURE` in
`packages/sunrey-chain`) is not production finality. Existing
`confirmations` counters do not become Tendermint rounds.

## Unresolved questions

- Exact production `n`, timeouts, and block gas/compute limits.
- Whether a later Narwhal-class mempool is adopted behind the same
  `ConsensusEngine` interface.
- Legal characterization of bonds and slashing.
- Network-wide adversarial behavior (Chunk 38).

## Status

`ACCEPTED_FOR_ENGINEERING` for Tendermint-family direction.
Development `ConsensusEngine`: **implemented** (Chunk 37,
simulation / local harness only). Production consensus: **not
implemented**. Legal confidence: `RESEARCH_REQUIRED`.
