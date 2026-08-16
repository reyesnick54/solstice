# ADR-0019 — SunRey Blockchain state machine architecture

- Status: ACCEPTED_FOR_ENGINEERING
- Legal / regulatory confidence: RESEARCH_REQUIRED
- Date: 2026-08-16
- Affected subsystem: SUNREY_CHAIN
- Depends on: ADR-0016, ADR-0017, ADR-0020, ADR-0021, ADR-0031
- Implementation status: PARTIAL (Chunk 32R typed objects and apply
  port plus Chunk 34R local development state machine; production
  not implemented)

## Context

SunRey must represent rich economic state: humans, enterprises, AI
agents, robots, devices, productive assets, identity references,
attestations, rights, consent, purpose, provenance, jurisdiction,
policy versions, economic objects, native assets, oracle facts,
productive capacity, authorized-execution references, settlement, and
evidence anchors.

A generic account/balance EVM model cannot express those objects
without collapsing them into opaque contract storage. Opaque storage
hides safety boundaries from the protocol.

The canonical financial Ledger already exists. The chain state
machine must not become a second banking ledger.

## Decision

1. The state machine is a **deterministic function**:
   `apply(pre_state, block) -> (post_state, events, app_hash)`.
2. State is a typed object store with versioned schemas, not an
   untyped key/value bag as the application model. Storage may use
   bytes; codecs and types are mandatory at the module boundary.
3. First-class protocol objects include at least:

   | Object | On-chain content | Off-chain authority |
   | --- | --- | --- |
   | Actor reference | scoped commitment, kind | Identity service |
   | Attestation | hash, issuer, schema, revocation | Issuer / PDV |
   | Consent receipt | hash, purpose, revocation | Consent Ledger |
   | Policy version ref | pack hash, decision commitment | Kernel / RDT |
   | Evidence anchor | vault record hash | Evidence Vault |
   | Settlement anchor | journal id commitment | Canonical Ledger |
   | Native asset unit | later, explicit ADR | see ADR-0026 |
   | Oracle fact | signed observation | Oracle module |
   | Productive capacity | commitment + schema | derived / attested |

4. Raw personal data, PAN/CVV, private keys, and bank coordinates
   remain `OFF_CHAIN_ONLY` (already enforced in the simulation layer).
5. Replay of the same genesis + block sequence must produce the same
   `app_hash`.
6. Fiat balances, payment instructions, and securities positions are
   **not** chain-authoritative (ADR-0031).

## Alternatives considered

- **EVM account model as the state machine.**
- **UTXO-only model.**
- **Store the entire Solstice ledger on-chain.**
- **Unversioned JSON documents as state.**

## Why rejected

- EVM accounts erase typed economic objects and inherit reentrancy
  and opaque-storage hazards SunRey does not want as defaults.
- UTXO-only is a poor fit for attestations, consent, and policy
  version references.
- Copying the ledger on-chain creates a second fiat source of truth.
- Unversioned JSON is not a deterministic, upgradeable codec.

## Security implications

Nondeterminism (time, RNG, map iteration, floating-point, network
calls) is a consensus-split bug. Execution must be sandboxed from
clocks except the block time supplied by consensus. State corruption
is detected by `app_hash` mismatch on replay.

## Compliance implications

Putting identity or consent *facts* on-chain does not satisfy KYC,
GDPR, or PDPL. Commitments are not legal records by themselves.
`RESEARCH_REQUIRED`.

## Operability implications

State sync authenticates `app_hash`. Migrations are explicit
protocol upgrades (ADR-0028), not silent schema drift.

## Migration implications

Existing in-memory `SunReyChainStore` snapshots are not production
state. They must not be exported as genesis app state.

## Unresolved questions

- Exact Merkle / Jellyfish / other authenticated structure (ADR-0022).
- Which native SunRey Coin units, if any, migrate on-chain, and when.

## Status

`ACCEPTED_FOR_ENGINEERING` for a typed deterministic state machine.
Production state machine: **not implemented**. Legal confidence:
`RESEARCH_REQUIRED`.
