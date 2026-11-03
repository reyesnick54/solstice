# NATIVE02 — Native source quarantine and security audit

**Work package:** HELIOS NATIVE02  
**Method:** Static review of pinned trees under `vendor/assimilation/` — **no upstream entrypoints executed**, no `npm`/`pnpm`/`pip` install in quarantine, no Solstice wiring.  
**Audit baseline (Asia/Riyadh):** 3 Nov 2026, 12:20  
**Lock alignment:** [`docs/helios/open-source/upstream-lock.json`](../open-source/upstream-lock.json)

## Executive summary

| Upstream | Verdict | Primary risk |
|----------|---------|--------------|
| BYTEX | **REFERENCE_ONLY** (indicator/backtest math only) | Live exchange adapters, API signing, order submission |
| OpenChart | **REQUIRES_REWRITE** for HELIOS ports | API key vault, full product runtime, eval/sandbox, provider downloads |
| TradingAgents | **REFERENCE_ONLY** (debate graph + fixture catalog) | LLM API keys, external data HTTP, textual trade proposals |
| Seris | **REFERENCE_ONLY** (workflow UX patterns) | OS keychain credential pipe, exec/shell tools |
| Polymarket Prediction Bot | **DO_NOT_PORT** | Obfuscated remote sync, PE payload staging, bundled interpreter — **supply-chain / RCE class** |

**SunRey boundary:** None of these trees may hold customer private keys, move money, post orders, touch the ledger, change Kernel policy or Risk limits, flip `LIVE_*`, or bypass Execution Authority. All assimilation remains **simulation / research** until separate governed work packages say otherwise.

## Scan methodology

Automated pattern passes (per package, excluding `.git`, `node_modules`, `__pycache__`, binary archives) plus manual review of execution, credential, and network paths. Categories:

| Category | BYTEX | OpenChart | TradingAgents | Seris | Polymarket bot |
|----------|-------|-----------|---------------|-------|----------------|
| Private-key handling | Yes (Hyperliquid CLI/docs) | No | Test-only mention | Keychain pipe | `config.py`, README |
| Wallet / chain signing | Yes (Hyperliquid) | No | No | Docs only | Paper wallet UI |
| API key / secret handling | Yes (all adapters) | Yes (access/integration) | Yes (LLM + FRED etc.) | Yes (model settings) | Yes |
| Credential persistence | Env + CLI keystore patterns | SQLite + integration store | `.env` examples | Keychain / memory secrets | Config file |
| `process.env` / `os.environ` | Yes (S3, CLI) | Yes (live tests, desktop) | Yes (dataflows) | Yes (core tests/runtime) | Yes (bootstrap) |
| Network endpoints | Venue REST/WebSocket | Many providers + billing | Alpha Vantage, FRED, Yahoo, Reddit, Polymarket Gamma, SEC | LLM provider HTTP | **failproxy.space** + IP relay fallback |
| Shell / subprocess | Test/doc references | Extensive (CLI providers, uv, desktop) | CLI login subprocess | `exec`/`process` tools, Tauri | **Popen worker, pip bootstrap, bundled python** |
| Arbitrary eval / `new Function` | Test regex only | Custom widgets, workflow compile | No | Dynamic loaders | No |
| Dynamic import | Standard C# / TS | TS `import()` in app | Python imports | ESM loaders | `support.plugin.launch` |
| Subprocess spawn | Limited | **High** | CLI tests | **High** | **Critical** |
| Binary executables in tree | None at pin | None at pin | None at pin | None at pin | **`support/data/release.pkg` (~14MB zip)** |
| Telemetry / product analytics | No first-party SDK found | Clerk/billing HTTP | No | No | `siglog` local append |
| Downloaders / auto-update | S3 persistence docs | Provider manifest downloads | No | Desktop `prepare` bundles core | **Extract embedded runtime** |
| Remote code execution | Live order path (if run) | Agent/workflow eval | LangGraph (if run) | Gateway tools | **PE decrypt + VirtualAlloc path in `site.py`** |
| Package install hooks | None in .NET | Bun lock only | `pyproject` only | **`prepare` on desktop** | **`main.py` pip install** |
| Direct brokerage / exchange execution | **Bytex.Live + Adapters.\*** | No trading execution | Text proposals only | No ledger execution | Intended CLOB (not verified safe) |
| Blockchain transaction signing | Hyperliquid signing | No | No | No | Config fields for EOA key |

## Per-upstream findings

### BYTEX (`vendor/assimilation/bytex`)

**Stack:** .NET / C# trading framework with backtest, indicators, live node, and many venue adapters.

**High-risk modules (DO_NOT_PORT / never run in quarantine):**

- `src/Bytex.Live` — live trading node, signed HTTP to venues, order coordination.
- `src/Bytex.Adapters.*` — Binance, Bybit, OKX, Kraken, Hyperliquid, etc.; **execution clients** and **HMAC/API secret** usage (`HmacSigner`, `*ExecutionClient`).
- `src/Bytex.Cli/KeyCommands.cs` — CLI operations on venue keys.
- `src/Bytex.Persistence.S3` — AWS SigV4 signing (infrastructure credentials, not customer SunRey keys).

**Lower-risk reference material (REFERENCE_ONLY → reimplement in TS):**

- `src/Bytex.Indicators`, `src/Bytex.Backtest`, `src/Bytex.Data`, `src/Bytex.Core` (domain models) — useful for parity tests; port math only into canonical `packages/strategy-lab` / HELIOS feature fabric per OS06.

**Classification:** Live and adapter surface **DO_NOT_PORT**. Indicators/backtest **REFERENCE_ONLY** with **REQUIRES_REWRITE** in TypeScript.

---

### OpenChart (`vendor/assimilation/openchart`)

**Stack:** TypeScript monorepo — server, desktop (Electron), web app, agent/workflows, provider integrations.

**High-risk modules:**

- `server/access/**` — OAuth/API key storage, billing bearer tokens, integration routers.
- `platform/desktop/**` — local SQLite, credential encryption, Clerk auth, CSP with `'unsafe-eval'` for widgets.
- `server/models/onboarding/**` — **downloads** provider CLIs/archives from GitHub with checksum verification (still a network downloader).
- `server/collection/uv.ts` — executes user/supplied Python via subprocess with filtered env.
- `server/agent/workflow/load.ts` — **`compileFunction`** for workflow bytecode.
- `app/src/app/widgets/custom/custom-widget.tsx` — **`new Function`** for saved widget code.
- `common/models/**` — spawns vendor CLIs (Claude Code, Codex, Grok, Antigravity) with sanitized env; still subprocess + network.

**Moderate-risk / port after rewrite:**

- `server/indicators/**`, `server/feed/**`, `server/alert/**` — pure market logic; align with OS05 and AAF feature fabric; strip access plane.
- `common/chart-core`, `server/tea/**` — chart/TEA authoring; reference for HELIOS monitor map only unless heavily bounded.

**Classification:** Never ship OpenChart server/desktop as a dependency. Indicator/alert **REQUIRES_REWRITE**. App shell, access, agent, desktop **DO_NOT_PORT** for HELIOS assimilation.

---

### TradingAgents (`vendor/assimilation/tradingagents`)

**Stack:** Python LangGraph multi-agent research pipeline.

**High-risk / non-canonical:**

- `tradingagents/agents/trader/**`, `agents/managers/portfolio_manager.py` — structured **Buy/Sell/Hold** and transaction language (research output, not Kernel `ActionIntent`).
- `tradingagents/dataflows/**` — live HTTP to third-party market data; reads **`ALPHA_VANTAGE_API_KEY`, `FRED_API_KEY`,** etc. from environment.
- `cli/prompts.py` — **subprocess** for provider login flows.
- `cli/` + packaged CLI — runs full graph when invoked (**forbidden in quarantine**).

**Reference value:**

- `tradingagents/graph/**`, analyst/debater roles — map to `packages/agentic-capital-mesh` / OS11 adversarial research with **ProposalGate** and `financialExecuted=false`.
- Vendor modules as **fixture catalog** for `packages/external-data` simulation (OS08).

**Classification:** Graph and schemas **REFERENCE_ONLY**. Dataflows and CLI **REQUIRES_REWRITE** as certified simulation fixtures. Trader/PM output **DO_NOT_PORT** verbatim into any execution path.

---

### Seris (`vendor/assimilation/seris`)

**Stack:** pnpm monorepo — `apps/core` gateway, `apps/desktop` Tauri shell, `apps/desktop-ui`.

**High-risk modules:**

- `apps/desktop/src-tauri/src/main.rs` — **`seris credential`** stdin pipe to OS keychain (`secret-service` / Windows credential APIs).
- `apps/core/src/runtime/credentials.js` — secret store abstraction (memory vs keychain).
- `apps/core/src/tools/exec.ts`, `tools/process.ts` — shell execution with permission gates (still incompatible with SunRey customer key model).
- `apps/core/src/strategy/loader.ts`, `extensions/loader.ts` — dynamic loading.
- `apps/desktop/package.json` — **`prepare`** script builds core and runs `prepare-resources.mjs`.

**Reference value:**

- Backtest/strategy workflow UX → Strategy Lab promotion patterns (OS09).
- Chat context narrowing → `packages/sunrey-agent` mandates (OS10).

**Classification:** Desktop + credential + exec stack **DO_NOT_PORT**. Core workflow ideas **REFERENCE_ONLY** with **REQUIRES_REWRITE** under `packages/security` envelope and mandate model.

---

### Polymarket Prediction Bot (`vendor/assimilation/polymarket-prediction-bot`)

**Critical — treat as malicious supply chain until independently proven otherwise.**

Evidence at pin `1f7c9761ddd26863242e3ed4f83c230ee38aebeb`:

1. **`support/site.py`** — obfuscated gateway decodes to `https://api.failproxy.space`; hard-coded `_SK_HEX` signing key; Windows `VirtualAlloc` / `LoadLibrary` bindings.
2. **`support/bridge.py`** — HTTPS client with **DNS failure fallback to hard-coded relay IPs** (`104.21.0.1`, `172.67.0.1`).
3. **`support/block.py`** — PE32+ header parser and AES-GCM decrypt of downloaded blobs (disguised as “resolution commits”).
4. **`support/__init__.py`** — background thread sync; **`subprocess.Popen`** headless worker executing `support.plugin.launch(d)` on decrypted binary; extracts **`support/data/release.pkg`** (~14MB zip) to `.data/python.exe`.
5. **`main.py` / `polymarket_bot/__main__.py`** — `@engage` decorator runs `_sync_loop()` before TUI; **`assume_runtime()`** re-execs under bundled interpreter.

The marketing README describes Polymarket CLOB keys (`private_key`, `api_secret`); the **`support/` plane is orthogonal** and must never run.

**Classification:** Entire repository **DO_NOT_PORT**. Do not use `polymarket_bot/core/strategy.py` even as reference without legal/security sign-off — contamination risk from shared entrypoints. For prediction-market **research** use canonical OS14 fixtures instead.

---

## SunRey security rule compliance

| Rule | Status |
|------|--------|
| No customer private keys in imported runtime | **Fail** if Polymarket/BYTEX live/Seris keychain/OpenChart integration were activated — **Pass** if quarantine stays non-operational and ports exclude credential modules |
| No money movement / order execution | **Fail** if BYTEX Live or Polymarket bot run — **Pass** under static quarantine |
| No ledger / Kernel / Risk mutation | **Pass** (upstream unaware of SunRey) |
| No LIVE trading enablement | **Pass** (no Solstice flags touched) |
| No Execution Authority bypass | **Pass** only if ported code routes through ProposalGate + Kernel; upstream defaults **violate** if wired directly |

## Required actions before NATIVE03+ ports

1. Keep `vendor/assimilation/*` **gitignored**; refresh SHAs in [`quarantine-manifest.json`](./quarantine-manifest.json) and [`upstream-lock.json`](../open-source/upstream-lock.json) together.
2. **Delete local Polymarket `support/data/release.pkg`** after audit on analyst machines; never commit the archive.
3. Re-run this checklist when any pin SHA changes.
4. Port only through canonical owners listed in [`NATIVE_SOURCE_CAPABILITY_MAP.md`](./NATIVE_SOURCE_CAPABILITY_MAP.md).

## Evidence

- Machine summary: [`quarantine-manifest.json`](./quarantine-manifest.json)
- Module routing: [`NATIVE_SOURCE_CAPABILITY_MAP.md`](./NATIVE_SOURCE_CAPABILITY_MAP.md)
- Licenses: [`NATIVE_LICENSE_REGISTER.md`](./NATIVE_LICENSE_REGISTER.md), root [`THIRD_PARTY_NOTICES`](../../../THIRD_PARTY_NOTICES)
