# Shadow Lab Evidence Integrity Report

## Sealed decision chain

Decisions are hash-chained in `simulation/evidence-chain.ts`:

- Genesis hash: `GENESIS`
- Each record links `previousHash` → `contentHash`
- `verifyEvidenceChain` validates the full chain
- `duplicateDecisionIds` must be empty after restart

## Checkpoints

Checkpoints capture `decisionCount`, `lastContentHash`, and `runtimeGeneration` for process/database restart recovery.

## No rewrite invariant

`InMemoryShadowLabStore.historyNeverRewritten()` must remain true for production campaign evidence. Chaos injects `attemptHistoryRewrite()` only in isolated fault cells; the canonical long-run chain is verified independently.

## AlphaRealityGate boundary

Synthetic harness qualification may emit **`AUTONOMOUS_SHADOW_LAB_ARCHITECTURE_QUALIFIED`** only. **`FORWARD_ALPHA_SUPPORTED`** remains gated on genuine prospective observations (`GENUINE_FORWARD_CAMPAIGN`) per `docs/helios/alpha/FORWARD_ALPHA_REALITY_GATE.md`.
