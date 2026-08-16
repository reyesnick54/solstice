# ADR-0027 — SunRey Blockchain oracle architecture

- Status: ACCEPTED_FOR_ENGINEERING
- Legal / regulatory confidence: RESEARCH_REQUIRED
- Date: 2026-08-16
- Affected subsystem: SUNREY_CHAIN
- Depends on: ADR-0019, ADR-0020, ADR-0031
- Implementation status: NOT_IMPLEMENTED

## Context

The protocol must represent oracle facts without treating a price
feed as financial truth. SunRey already forbids official valuation
on the exchange (`SIMULATION_MARKET_PRICE`) and forbids yield fields.
A malicious oracle must not mint money or rewrite the ledger.

## Decision

1. An **oracle fact** is a signed, schema-versioned observation:
   subject, predicate, integer or enumerated value, unit, observed-at
   (UTC), provider id, and signature algorithm id.
2. Oracle facts are **not** balances, not Execution Authority, and
   not Kernel ALLOW.
3. Consumers of oracle facts are native modules that treat them as
   inputs with explicit freshness and quorum rules. Missing or stale
   facts fail closed.
4. Price, FX, and "official NAV" oracles cannot authorize fiat
   journals. FX execution remains `packages/payments` simulation
   quotes.
5. Provider sets are governance-upgraded (ADR-0028). AI agents may
   *propose* observations; they may not become sole oracle signers
   for safety-critical facts.
6. No live external market-data network is connected.

## Alternatives considered

- **Push last-trade prices on-chain as truth.**
- **Let any contract define an oracle.**
- **Reuse Personal Oracle (information market) as consensus truth.**

## Why rejected

- Last-trade as truth creates a manipulable official price.
- Arbitrary contract oracles bypass admission.
- The information-market Personal Oracle is an application module,
  not a consensus oracle.

## Security implications

Malicious or compromised providers can lie. Quorum, diversity, and
evidence of disagreement are required at implementation. Oracle
lies must not slash *users*; they may halt dependent modules.

## Compliance implications

Market-data licensing, benchmark regulation, and manipulation law
are `RESEARCH_REQUIRED`. No official benchmark is created.

## Operability implications

Operators monitor freshness, quorum, and disagreement. Fail-closed
is an availability tradeoff that is preferred to silent wrong
settlement.

## Migration implications

None. No production oracle network exists.

## Unresolved questions

- Quorum size and dispute window.
- Relationship to Regulatory Digital Twin snapshots (read-only).

## Status

`ACCEPTED_FOR_ENGINEERING` for signed, fail-closed oracle facts.
Production oracles: **not implemented**. Legal confidence:
`RESEARCH_REQUIRED`.
