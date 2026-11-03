# HELIOS Native Assimilation — Third-Party Notices

Historical attribution for open-source projects referenced during HELIOS native assimilation (OS00–OS14). **SunRey reimplemented required behavior in canonical TypeScript owners; this file does not pin or fetch upstream at runtime.**

Machine-readable provenance (metadata only): [`NATIVE_ASSIMILATION_PROVENANCE_MANIFEST.json`](./NATIVE_ASSIMILATION_PROVENANCE_MANIFEST.json)

Design-time lock (not a runtime dependency): [`../open-source/upstream-lock.json`](../open-source/upstream-lock.json)

---

## Apache-2.0 referenced projects

### BYTEX (`BYTEX-TRADE/bytex`)

- Historical reference SHA: `67b3e103043476a0490bb7afa146ec9ac339b116`
- Native owners: `packages/platform/src/helios/execution-twin`, `execution-routing/venue-conformance`, `packages/strategy-lab`
- No .NET BYTEX runtime is shipped or invoked by HELIOS.

### TradingAgents (`TauricResearch/TradingAgents`)

- Historical reference SHA: `c4544913a14ed3df5f1ed7b9e8483270ce20682a`
- Native owners: `packages/agentic-capital-mesh`, `packages/platform/src/helios/open-source*`, `os12-agent-permission-gateway`
- No Python LangGraph runtime is shipped or invoked by HELIOS.

### Seris (`aowang-ai/seris`)

- Historical reference SHA: `f73dbbb0cd7e3b52601abf905bb871cdb9098550`
- Native owners: `packages/strategy-lab`, `packages/sunrey-agent`, OS13 strategy sandbox
- No Seris Tauri desktop application runtime is shipped or invoked by HELIOS.

---

## MIT referenced projects

### OpenChart (`longsurf-ai/openchart`)

- Historical reference SHA: `8109466bfb5d44c32e0e03e9337eaca48b837ab4`
- Copyright (c) Longsurf, Inc. 2026 (per upstream LICENSE)
- Native owners: `packages/platform/src/helios/feature-fabric`, `research-monitor`
- No OpenChart Bun/Node application server is shipped or invoked by HELIOS.

### Polymarket Prediction Bot (`semrincaballero/Polymarket-Prediction-Bot`)

- Historical reference SHA: `1f7c9761ddd26863242e3ed4f83c230ee38aebeb`
- Native owner: `packages/platform/src/helios/open-source/os14-prediction-market`
- No Python Polymarket TUI or live wallet runtime is shipped or invoked by HELIOS.

---

## SunRey proprietary

All other HELIOS runtime code in this repository is governed by the repository’s primary license unless a file header states otherwise. Native assimilation does not relabel third-party authored source as original SunRey authorship.
