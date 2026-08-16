# Architecture

- [Constitution](./constitution.md) — canonical owners, boundaries, and dependency direction
- [Manifest](./manifest.json) — machine-readable enforcement input
- [ADR index](./adr/README.md) — decision records (not renumbered)
- [Chunk dependencies](./chunk-dependencies.md) — stop if a protected requirement is not IMPLEMENTED
- [Chunk 12 stop (historical)](./chunk-12-stop.md) — original stop while Cards was PLANNED
- [Chunk 12 resume](./chunk-12-resume.md) — wallet / Tap-to-Pay implemented after Cards merged
- [Chunk 13 stop (historical)](./chunk-13-stop.md) — original process-gate stop before treasury existed
- [Chunk 13 resume](./chunk-13-resume.md) — treasury / liquidity / routing intelligence implemented
- [Chunk 15 stop (historical)](./chunk-15-stop.md) — original stop while Treasury was still PLANNED; agent later landed as proposal-only
- [Historical PR guidance](./historical-implementation.md) — older PRs are not automatically canonical
- [PostgreSQL persistence fabric](./persistence.md) — durable adapter behind existing ports
- [Durable event fabric](./events.md) — envelope, outbox, inbox, replay, delivery semantics
- Policy engine — `packages/kernel/src/policy/` (ADR-0006 Option C, simulation only)
- [Compliance screening fabric](./compliance.md) — AML, sanctions, PEP, TM, fraud, cases (ADR-0010)
- [Security and cryptography](./security.md) — KeyProvider, secrets, envelopes, key lifecycle
- Identity lives in `packages/identity` (Chunk 5). ADR-0007 remains PROPOSED.
- [Personal Economic Graph](./economic-graph.md) — first SFF 2.0 intelligence layer. Does not execute.
- Growth Orchestrator and mandates live in `packages/platform` (Chunk 16). The Personal Economy Agent lives in `packages/agent`. Neither executes. ADR-0012 remains PROPOSED.
- Regulatory Digital Twin lives in `packages/regulatory-twin` (Chunk 18). Simulation/counterfactual only. Not a second Kernel or policy engine.
- Personal Economic Value Engine lives in `packages/platform/src/value` (Chunk 17). Measurement only. ADR-0013 remains PROPOSED.

- [Privacy Clean Room](./clean-room.md) — consent-gated computation at
  `packages/clean-room`. Historical stop:
  [`chunk-25-stop.md`](./chunk-25-stop.md). Resume:
  [`chunk-25-resume.md`](./chunk-25-resume.md).
- [SunRey Coin](./sunrey-coin.md) — simulation economic ledger at
  `packages/sunrey-coin`. Historical stop:
  [`chunk-26-stop.md`](./chunk-26-stop.md). Resume:
  [`chunk-26-resume.md`](./chunk-26-resume.md). Public ticker is
  UNDECIDED.
- [SunRey Chain](./sunrey-chain.md) — simulation trust layer at
  `packages/sunrey-chain`. Not the financial source of truth.
  ADR-0015 remains PROPOSED.
- [Chunk 31 production architecture freeze](./chunk-31-sunrey-blockchain-production-architecture.md)
  — protocol ADR pack, authority matrix, and machine-readable spec.
  Production blockchain is not implemented.
- [SunRey chain authority matrix](./sunrey-chain-authority-matrix.md)
- [SunRey Blockchain protocol spec](./sunrey-blockchain-protocol.json)
- [Chunk 30 stop (historical)](./chunk-30-stop.md) — original stop while
  custody and market-surveillance were PLANNED
- [Chunk 30 resume](./chunk-30-resume.md) — custody, Travel Rule,
  listing governance, surveillance, and kill switches after Exchange
  core merged

Implementation inventory: [`docs/build-status.md`](../build-status.md).
