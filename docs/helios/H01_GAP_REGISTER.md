# H01 — HELIOS Phase 1 Gap Register

**Base SHA:** `3c13beb3df000c25b8e81b953058387d9b04774d`  
**Audit date:** 2026-09-15

Gaps are bounded to Phase 1 scope. H01 does not implement fixes.

---

## P0 — Correctness / authority defect

| ID | Finding | Evidence | Owner for fix |
|----|---------|----------|---------------|
| P0-01 | Deployed preview durably persists accounts/ledger but Grow plans, proposals, and execution state are **process-local** — restart loses Grow state while money state survives | `preview.ts` uses `PreviewGrowSurface` + in-memory `ProductGrowthService`; PG adapters `pg-grow-execution-store.ts` exist but are not wired in `product-integration/runtime.ts` | H03 |
| P0-02 | **Composition split:** Full Grow execution path (`GrowBffSurface`) exists only in Phase E test world, not in `preview-main.ts` — public API may advertise execute vocabulary without canonical execution wiring | `tests/phase-e-world.ts` vs `preview.ts` | H03 |
| P0-03 | Exchange default settlement uses `InMemoryCoinPort`/`InMemoryFiatPort` (synthetic `journalId`) — must not be confused with canonical ledger truth in HELIOS orchestration | `packages/sunrey-exchange/src/adapters.ts` | H03 (attribution); document in UI |

**Competing financial authority blockers:** None identified. Dual `GrowthAttributionLedger` is intentional (banking vs PEVE).

---

## P1 — Required for Phase 1 HELIOS

| ID | Finding | Target |
|----|---------|--------|
| P1-01 | No HELIOS namespace or integration seam — intelligence scattered across platform, sunrey-agent, mesh, strategy-lab | H04+ architecture (not H01) |
| P1-02 | PEG durable store exists but preview composition uses in-memory `EconomicGraphService` | Wire or document explicit preview posture |
| P1-03 | Capital Mesh and Strategy Lab not composed into Consumer BFF runtime | H04+ orchestration |
| P1-04 | Agent runtime durable in Hetzner but Grow execution durable adapters not persisted on `persist()` path | `product-integration/runtime.ts` `persist()` omits grow state |
| P1-05 | Holds are ephemeral only — reserved capital does not survive restart | `services/accounts` HoldStore |

---

## P2 — Later HELIOS phase

| ID | Finding |
|----|---------|
| P2-01 | Economic Work Orders not implemented (by design for H01) |
| P2-02 | Grok live connectivity gated off; S3M primary uses simulator |
| P2-03 | Cloud Run preview deployment manifests absent |
| P2-04 | Production Terraform/Helm modules exist but `production_authorized=false` |
| P2-05 | Mesh → Strategy Lab materialization bridge refuses paper orders by design |
| P2-06 | MAINNET_ACTIVE and chain production paths DISABLED |

---

## P3 — Cleanup / debt only

| ID | Finding |
|----|---------|
| P3-01 | `services/api/src/consumer/resources.ts` — unreachable duplicate `return` statements in `GROW` and other cases after early return |
| P3-02 | Parallel route families `/api/v1/agent` vs `/api/v1/agents` |
| P3-03 | Legacy portfolio paths `/api/v1/portfolio` vs `/api/v1/grow/portfolio` |
| P3-04 | ADR-0012 Growth Orchestrator still PROPOSED/PARTIAL |
| P3-05 | Pre-existing typecheck errors in `tests/wave5-moonrey-productive-intelligence-red-team.test.ts` |

---

## H02 input — Quantitative / statistical correctness

| ID | Finding | Location |
|----|---------|----------|
| H02-01 | Grow lifecycle `analysis-engine.ts` uses integer fee/daily calculations — verify rounding and currency boundaries | `packages/platform/src/grow/lifecycle/analysis-engine.ts` |
| H02-02 | Paper broker `produceDeterministicFill` — deterministic fill pricing must be audited against market quote validity gates | `packages/investments/src/broker-port.ts` |
| H02-03 | Strategy Lab backtest explicitly disables `peveGrowthAttributionLedger` — attribution math in backtest vs production paths may diverge | `packages/strategy-lab/src/backtest.ts` |
| H02-04 | PEVE `GrowthAttributionLedger` (platform) vs ledger banking attribution — ensure no double-count across Grow performance read model (`deposits_are_not_performance` constraint in V036) | `db/customer/migrations/V036__grow_execution.sql` |
| H02-05 | Risk Engine budgets marked `engineeringOnly: true` — pre-trade thresholds not production-calibrated | `packages/risk/src/engine.ts` |
| H02-06 | Capital Mesh specialist nodes use `mdl_capital_mesh_specialist` simulation model — allocation compile math not validated against live portfolio constraints | `packages/agentic-capital-mesh/src/nodes.ts` |
| H02-07 | Exchange consumer portfolio/indicative quotes — verify no yield/APR fields leak through BFF projections | `packages/sunrey-exchange/src/consumer/` |
| H02-08 | `performance_read_model` table constraint `deposits_are_not_performance` — verify all write paths honor it | `V036`, `packages/platform/src/grow/` |

---

## H03 input — Agent proposal and execution-state correctness

| ID | Finding | Location |
|----|---------|----------|
| H03-01 | Wire `GrowLifecycleService` + PG grow execution store into durable product integration `persist()` / hydrate | `services/api/src/product-integration/runtime.ts`, `pg-grow-execution-store.ts` |
| H03-02 | Deployed preview uses `PreviewGrowSurface` not `GrowBffSurface` — execute/approve state machine not reachable at public ingress | `preview.ts`, `preview-grow.ts` |
| H03-03 | `ProposalGate` blocks `SIMULATION_ONLY` submit — document expected human path for any future live agent execution | `packages/sunrey-agent/src/gate.ts` |
| H03-04 | Agent sandbox kernel stub returns ALLOW without full six-proof evaluation in `createSandboxAgentRuntime` | `services/api/src/consumer/agent.ts` |
| H03-05 | Grow execution idempotency keys generated from `requestId` when body omits key — verify collision safety under retry | `services/api/src/consumer/grow.ts` |
| H03-06 | `revalidateBeforeExecution` checkpoint fields (`kernelPolicy: 'ALLOW'` hardcoded in BFF execute path) — must not bypass actual kernel re-check at execution time | `grow.ts` executeProposal |
| H03-07 | Non-investment Grow proposals return `REQUIRES_REVIEW` — routing table vs user expectation for CASH_TRANSFER and EXCHANGE_ACTION | `packages/platform/src/grow/routing.ts` |
| H03-08 | Agent conversation durable; grow proposals not — inconsistent restart semantics for Action Center cross-domain flows | persistence map |
| H03-09 | Phase E E2E passes with full execution path but deployed stack does not — CI/deployment parity gap | `tests/phase-e-grow-e2e.test.ts` vs `preview-main.ts` |
| H03-10 | `evaluateGrowComplianceCheckpoint` exists standalone but preview execute path not using full GrowBffSurface pipeline | `packages/platform/src/grow/lifecycle/compliance-checkpoint.ts` |

---

## H04+ — Do not pull into Phase 1

- Economic Work Orders implementation
- Live market-data providers
- Grok/S3M production connectivity
- Strategy Capsules
- Live trading / brokerage
- New wallets or accounts outside canonical owners
- Provider activation or `LIVE_*` flag changes
- HELIOS-specific ledger or Kernel
- Mainnet / production ceremony execution
