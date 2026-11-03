# HELIOS native assimilation — quarantined provenance stubs

**Work packages:** NATIVE01 (source import manifest), NATIVE02 (static security audit), NATIVE15 (foreign runtime independence)

These directories hold **legal attribution**, **HELIOS assimilation notes**, and **JSON parity fixtures** only. Full upstream application source is **not** committed to this repository after native ports qualify (NATIVE15).

## Provenance

Authoritative import metadata: [`SOURCE_IMPORT_MANIFEST.json`](./SOURCE_IMPORT_MANIFEST.json).

Security audit and capability mapping: [`docs/helios/native-assimilation/`](../docs/helios/native-assimilation/).

| Directory | Upstream | Import / audit SHA | License |
|-----------|----------|-------------------|---------|
| `bytex/` | [BYTEX-TRADE/bytex](https://github.com/BYTEX-TRADE/bytex) | `67b3e103043476a0490bb7afa146ec9ac339b116` | Apache-2.0 |
| `openchart/` | [longsurf-ai/openchart](https://github.com/longsurf-ai/openchart) | `8109466bfb5d44c32e0e03e9337eaca48b837ab4` | MIT |
| `tradingagents/` | [TauricResearch/TradingAgents](https://github.com/TauricResearch/TradingAgents) | `c4544913a14ed3df5f1ed7b9e8483270ce20682a` | Apache-2.0 |
| `seris/` | [aowang-ai/seris](https://github.com/aowang-ai/seris) | `f73dbbb0cd7e3b52601abf905bb871cdb9098550` | Apache-2.0 |
| `polymarket-prediction-bot/` | [semrincaballero/Polymarket-Prediction-Bot](https://github.com/semrincaballero/Polymarket-Prediction-Bot) | `1f7c9761ddd26863242e3ed4f83c230ee38aebeb` | MIT |

`polymarket-prediction-bot` is pinned to the NATIVE02 audit SHA (not upstream `main`); see `pinNote` in [`docs/helios/open-source/upstream-lock.json`](../docs/helios/open-source/upstream-lock.json).

Native TypeScript ports live under canonical HELIOS owners — see [`docs/helios/open-source/NATIVE03_BYTEX_DETERMINISTIC_RUNTIME.md`](../docs/helios/open-source/NATIVE03_BYTEX_DETERMINISTIC_RUNTIME.md).

## Git policy

Vendor paths remain **tracked** so manifests and parity JSON fixtures are available offline. They are excluded from TypeScript compile, workspace install, repository tests, container images, and HELIOS runtime load (see `QUARANTINE.json` and `scripts/check-assimilation-quarantine.mjs`).

Attribution: root [`THIRD_PARTY_NOTICES`](../THIRD_PARTY_NOTICES) and [`docs/helios/native-assimilation/NATIVE_LICENSE_REGISTER.md`](../docs/helios/native-assimilation/NATIVE_LICENSE_REGISTER.md).

## Security rule

No quarantined component may hold customer private keys, move money, execute orders, modify ledger balances, alter Compliance Kernel policy, alter Risk Engine limits, enable LIVE trading, or bypass Execution Authority. See [`NATIVE_SOURCE_SECURITY_AUDIT.md`](../docs/helios/native-assimilation/NATIVE_SOURCE_SECURITY_AUDIT.md).
