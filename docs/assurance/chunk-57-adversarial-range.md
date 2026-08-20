# Chunk 57 — Adversarial cyber-economic range

This range is a **defensive verification** harness for SunRey. It
replays Byzantine, financial, oracle, exchange, custody, machine,
privacy, governance, and interoperability abuse scenarios against
local/testnet fixtures created by this repository.

## What it is

- Isolated 7-validator development range with sentries, RPC, Explorer,
  faucet, Exchange, custody simulation, oracle providers, machine
  actors, relayers, and observability.
- Versioned `AttackScenario` records with seed, timeline, expected
  invariants, detections, and recovery.
- Machine-readable invariant catalog and an engineering test scorecard
  (`TESTED` / `PARTIAL` / `NOT_TESTED` / `OUT_OF_SCOPE`).
- Evidence artifacts that link scenario, source commit, testnet
  genesis, results, invariants, alerts, and recovery — without secrets.

## What it is not

- Not a marketing security rating.
- Not a legal-guilt engine. Surveillance alerts stay
  `legalConclusion: false`.
- Not internet scanning, pentest-as-a-service, or a live-bank connector.
- Not a second ledger, Kernel, or account system.
- Not permission to turn on `LIVE_*` or leave `ENVIRONMENT=simulation`.

## Campaign

- Full catalog: `sunrey-range campaign` (≥50 scenarios).
- Bounded CI smoke: `sunrey-range campaign --smoke`.
- Chunk 157 production-safety smoke: `sunrey-range campaign --production-safety-smoke`.
- Chunk 157 production-safety extended: `sunrey-range campaign --production-safety-extended`.
- Replay: `sunrey-range replay <id>`.

See [`attack-matrix.md`](./attack-matrix.md) and
[`range-operations.md`](./range-operations.md).
