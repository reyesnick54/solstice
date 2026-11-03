# HELIOS native assimilation — source quarantine

**Work package:** NATIVE02 (source quarantine and security audit)

Upstream reference trees live here **only for offline static review**. They are **not** npm/pnpm/Cargo dependencies, **not** wired into Solstice CI, and **must not** be executed in this repository.

## Pinned snapshots (audit baseline)

| Directory | Upstream repository | Pin SHA | License |
|-----------|---------------------|---------|---------|
| `bytex/` | https://github.com/BYTEX-TRADE/bytex | `67b3e103043476a0490bb7afa146ec9ac339b116` | Apache-2.0 |
| `openchart/` | https://github.com/longsurf-ai/openchart | `8109466bfb5d44c32e0e03e9337eaca48b837ab4` | MIT |
| `tradingagents/` | https://github.com/TauricResearch/TradingAgents | `c4544913a14ed3df5f1ed7b9e8483270ce20682a` | Apache-2.0 |
| `seris/` | https://github.com/aowang-ai/seris | `f73dbbb0cd7e3b52601abf905bb871cdb9098550` | Apache-2.0 |
| `polymarket-prediction-bot/` | https://github.com/semrincaballero/Polymarket-Prediction-Bot | `1f7c9761ddd26863242e3ed4f83c230ee38aebeb` | MIT |

Refresh a tree (audit only — do not run entrypoints):

```bash
git -C vendor/assimilation/<name> fetch origin <sha>
git -C vendor/assimilation/<name> checkout <sha>
```

Authoritative lock metadata: [`docs/helios/open-source/upstream-lock.json`](../../docs/helios/open-source/upstream-lock.json).

## Git policy

Cloned upstream directories are **gitignored**. Committed artifacts are under [`docs/helios/native-assimilation/`](../docs/helios/native-assimilation/) and root [`THIRD_PARTY_NOTICES`](../THIRD_PARTY_NOTICES).

## Security rule

No quarantined component may hold customer private keys, move money, execute orders, modify ledger balances, alter Compliance Kernel policy, alter Risk Engine limits, enable LIVE trading, or bypass Execution Authority. See [`NATIVE_SOURCE_SECURITY_AUDIT.md`](../docs/helios/native-assimilation/NATIVE_SOURCE_SECURITY_AUDIT.md).
