# ADR-0031 — Canonical ledger versus SunRey Blockchain authority boundary

- Status: ACCEPTED_FOR_ENGINEERING
- Legal / regulatory confidence: RESEARCH_REQUIRED
- Date: 2026-08-16
- Affected subsystem: BANKING / SUNREY_CHAIN / SUNREY_COIN
- Depends on: ADR-0015, ADR-0026
- Implementation status: IMPLEMENTED as documentation and tests;
  production chain authority: NOT_IMPLEMENTED

## Context

ADR-0015 already states the chain is not a second financial ledger.
Chunk 31 must make the boundary machine-testable so later node work
cannot silently post fiat or treat chain balances as customer
position.

The canonical Ledger (`packages/ledger`, `Ledger.postJournal`) is
the only money-movement path for regulated fiat/accounting state
unless a later explicitly approved architecture migrates a specific
domain.

## Decision

1. **Canonical Ledger is authoritative for:** fiat deposits,
   payments, investment/brokerage cash, securities *accounting*
   positions, current SunRey Coin simulation journals, exchange
   settlement journals, fees, holds, and reversals.
2. **SunRey Blockchain may become authoritative for:** native
   blockchain objects (attestations, consent receipts, policy
   version refs, evidence anchors, settlement *anchors*, oracle
   facts, productive-capacity commitments) and, only after a later
   ADR, native chain asset units.
3. **The chain must not:**
   - implement `Ledger.postJournal`
   - store a customer fiat balance
   - treat a reorg as a ledger rewrite
   - serve as `projectCustomerPosition`
4. **If chain and ledger disagree about fiat or current Coin
   journals, the ledger wins.**
5. **If chain and PEG/PEVE/graph disagree, the ledger wins for
   money; the chain wins only for objects it owns.**
6. The authoritative table is
   `docs/architecture/sunrey-chain-authority-matrix.md`.
7. AI cannot migrate a domain from ledger to chain.

## Alternatives considered

- **Chain as the only ledger going forward.**
- **Dual-write fiat to chain and ledger.**
- **Chain balances as a read model that applications treat as
  truth.**

## Why rejected

- Replacing the ledger would reimplement a protected capability and
  break Kernel-gated journals.
- Dual-write creates split-brain money.
- Read-model-as-truth is how silent second ledgers appear.

## Security implications

A second fiat ledger is an embezzlement and double-count primitive.
Reorgs must never un-post journals; they only mark anchors
`REORG_OBSERVED`.

## Compliance implications

Regulated books and records are a legal question. This ADR is
engineering. `RESEARCH_REQUIRED`. Not counsel-confirmed.

## Operability implications

Reconciliation jobs compare anchors to journals and record
mismatches without auto-fix (already the simulation rule).

## Migration implications

Any future native-asset migration is a new ADR, a new Kernel
action type if money moves, and a new matrix row. Chunk 31 does
not migrate Coin.

## Unresolved questions

- Exact future owner of MoonRey accounting if a regulated wrapper
  is ever required.
- Whether any Coin units ever leave the Ledger.

## Status

`ACCEPTED_FOR_ENGINEERING` for the ledger-versus-chain split.
Production chain authority: **not implemented**. Legal confidence:
`RESEARCH_REQUIRED`.
