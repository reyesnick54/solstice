# HELIOS Native Capability Parity Matrix (NATIVE15)

Maps each assimilated **upstream function** to a **native HELIOS owner**, **parity test**, and **qualification status**.

Runtime rule: HELIOS must not import or execute code from `vendor/assimilation/` or foreign application runtimes listed in OS00.

| ID | Upstream | Upstream function | Native HELIOS owner | Parity test | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `bytex.backtest.event_engine` | bytex | Bytex.Backtest event-driven historical simulation | `packages/platform/src/helios/execution-twin` | `tests/helios-os02-execution-twin.test.ts` | **QUALIFIED** |  |
| `bytex.execution.paper_matching` | bytex | Bytex.Core sandbox/paper order-book matching | `packages/platform/src/helios/execution-twin/simulation` | `tests/helios-os03-execution-simulation.test.ts` | **QUALIFIED** |  |
| `bytex.venue.conformance` | bytex | Bytex.Adapters venue adapter certification patterns | `packages/platform/src/helios/execution-routing/venue-conformance` | `tests/helios-os04-venue-adapter-conformance.test.ts` | **QUALIFIED** |  |
| `bytex.strategy.genome` | bytex | Strategy parameter genome / promotion scaffolding | `packages/strategy-lab/src/os05` | `tests/helios-os05-strategy-genome.test.ts` | **QUALIFIED** |  |
| `bytex.symbology.map` | bytex | Venue symbology and integration map (reference-only) | `docs/helios/open-source/BYTEX_HELIOS_INTEGRATION_MAP.md` | `tests/helios-os15-open-source-integration-qualification.test.ts` | **QUALIFIED** | Design map; no BYTEX .NET runtime import |
| `openchart.indicators.feature_fabric` | openchart | server/indicators study catalog and builtins | `packages/platform/src/helios/feature-fabric` | `tests/helios-os10-point-in-time-fundamentals.test.ts` | **QUALIFIED** |  |
| `openchart.monitor.dsl` | openchart | Conditional research monitor / alert DSL | `packages/platform/src/helios/research-monitor` | `tests/helios-os07-research-monitor-dsl.test.ts` | **QUALIFIED** |  |
| `openchart.symbology.map` | openchart | Monitor symbology architecture map (reference-only) | `docs/helios/open-source/OPENCHART_HELIOS_MONITOR_MAP.md` | `tests/helios-os15-open-source-integration-qualification.test.ts` | **QUALIFIED** | No OpenChart Bun server or desktop runtime |
| `tradingagents.triggered_research` | tradingagents | Event-triggered multi-agent research routing | `packages/platform/src/helios/open-source-integration/os08` | `tests/helios-os08-triggered-agentic-research.test.ts` | **QUALIFIED** |  |
| `tradingagents.institutional_mesh` | tradingagents | tradingagents/graph role-specialized research mesh | `packages/agentic-capital-mesh/src/institutional-research-mesh` | `tests/helios-os09-institutional-research-mesh.test.ts` | **QUALIFIED** |  |
| `tradingagents.adversarial_debate` | tradingagents | Bull/bear adversarial synthesis and consensus | `packages/platform/src/helios/open-source/os11-adversarial-research` | `tests/helios-os11-adversarial-research.test.ts` | **QUALIFIED** |  |
| `tradingagents.agent_gateway` | tradingagents | LLM tool permission and model-agnostic research controls | `packages/platform/src/helios/os12-agent-permission-gateway` | `tests/helios-os12-agent-permission-gateway.test.ts` | **QUALIFIED** |  |
| `seris.strategy_sandbox` | seris | apps/core strategy proposal sandbox (non-executing) | `packages/platform/src/helios/open-source-integration/os13-ai-strategy-sandbox` | `packages/platform/src/helios/open-source-integration/os13-ai-strategy-sandbox/os13.test.ts` | **QUALIFIED** |  |
| `seris.backtest_workflow` | seris | User-local backtest workflow → Strategy Lab promotion path | `packages/strategy-lab` | `tests/helios-os05-strategy-genome.test.ts` | **QUALIFIED** | No Seris Tauri desktop runtime |
| `polymarket.clob_research` | polymarket-prediction-bot | polymarket_bot/core CLOB observation and microstructure | `packages/platform/src/helios/open-source/os14-prediction-market` | `tests/helios-os14-prediction-market-research.test.ts` | **QUALIFIED** |  |
| `polymarket.probability_features` | polymarket-prediction-bot | Implied probability and order-book feature extraction | `packages/platform/src/helios/open-source/os14-prediction-market/probability.ts` | `tests/helios-os14-prediction-market-research.test.ts` | **QUALIFIED** | No Python Polymarket TUI or live wallet path |

**Matrix:** all rows **QUALIFIED** — native parity evidence present in-tree.

