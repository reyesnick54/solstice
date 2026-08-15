# Chunk 22R — Strategy Lab resume (supersedes historical stop)

**Status:** IMPLEMENTED on this branch (PARTIAL bounded context: no LIVE trading).

**Supersedes:** `docs/architecture/chunk-22-stop.md` (historical Chunk 22 STOP-ONLY).

## Why the original stop is historical

The first Chunk 22 agent stopped because Risk, Model Registry, and Agentic
Capital Mesh were absent. After Chunk 20 / 21R:

- Risk Engine is IMPLEMENTED (`packages/risk`).
- Model Registry is IMPLEMENTED (`packages/model-registry`).
- Agentic Capital Mesh remains a reserved context. Strategy Lab integrates
  via a typed `CapitalProposal` port (`draftFromMeshProposal`) and refuses
  Mesh self-validation. It does not implement Mesh.

This resume implements the reserved Strategy Lab bounded context.

## Canonical owners

- `packages/strategy-lab`
- `services/strategy-lab`

Forbidden competing roots remain: `packages/backtest`, `packages/trading-lab`,
`packages/quant`, `packages/strategy-v2`, `packages/algo-trading`.

## Allowed progression

Capital Thesis → Strategy Draft → Compile → Backtest → Out-of-Sample
→ Stress → Human Review → Shadow → Human Review → Paper.

There is no LIVE stage.
