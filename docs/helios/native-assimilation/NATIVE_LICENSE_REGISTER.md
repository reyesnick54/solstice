# NATIVE02 — Native license register

Register of upstream licenses verified at quarantine pin time. **Attribution is legal notice only** — it does not authorize running live trading, committing vendor trees, or adding operational dependencies.

**Audit date (Asia/Riyadh):** 3 Nov 2026, 12:20  
**Authority:** [`upstream-lock.json`](../open-source/upstream-lock.json), [`LICENSE_AND_ATTRIBUTION_PLAN.md`](../open-source/LICENSE_AND_ATTRIBUTION_PLAN.md)

---

## Summary table

| ID | Project | SPDX | License file | NOTICE | Pin SHA | Permissive reuse | SunRey port status |
|----|---------|------|--------------|--------|---------|------------------|-------------------|
| bytex | [BYTEX-TRADE/bytex](https://github.com/BYTEX-TRADE/bytex) | Apache-2.0 | `LICENSE` | `NOTICE` | `67b3e103043476a0490bb7afa146ec9ac339b116` | Yes, with Apache conditions | Reference / selective TS port only |
| openchart | [longsurf-ai/openchart](https://github.com/longsurf-ai/openchart) | MIT | `LICENSE` (Copyright 2026 Longsurf, Inc.) | — | `8109466bfb5d44c32e0e03e9337eaca48b837ab4` | Yes, with MIT notice | Selective TS port only |
| tradingagents | [TauricResearch/TradingAgents](https://github.com/TauricResearch/TradingAgents) | Apache-2.0 | `LICENSE` | — | `c4544913a14ed3df5f1ed7b9e8483270ce20682a` | Yes, with Apache conditions | Reference / TS reimplementation |
| seris | [aowang-ai/seris](https://github.com/aowang-ai/seris) | Apache-2.0 | `LICENSE` | `NOTICE` | `f73dbbb0cd7e3b52601abf905bb871cdb9098550` | Yes, with Apache + NOTICE | Workflow reference only |
| polymarket-prediction-bot | [semrincaballero/Polymarket-Prediction-Bot](https://github.com/semrincaballero/Polymarket-Prediction-Bot) | MIT | `LICENSE` (Copyright 2026 Polymarket Prediction Bot contributors) | — | `1f7c9761ddd26863242e3ed4f83c230ee38aebeb` | **License does not mitigate supply-chain findings** | **DO_NOT_PORT** |

`polymarket-prediction-bot` pin is behind upstream `main` per upstream-lock `pinNote`; re-verify license **and** security delta before any future reconsideration.

---

## Apache-2.0 obligations (BYTEX, TradingAgents, Seris)

When SunRey copies or adapts **source** (not mere reading):

1. Include Apache-2.0 text or pointer in [`THIRD_PARTY_NOTICES`](../../../THIRD_PARTY_NOTICES).
2. Retain copyright, patent, trademark, and attribution notices from source files.
3. Document modifications in `THIRD_PARTY_NOTICES` or file-level header.
4. For Seris, reproduce applicable `NOTICE` attributions when porting Seris-derived subcomponents.

Suggested ported-file header:

```text
// Portions derived from <project> (<url>)
// SPDX-License-Identifier: Apache-2.0
// Upstream: <path>@<sha>
// Modifications: Copyright <year> SunRey / Solstice contributors
```

---

## MIT obligations (OpenChart, Polymarket Prediction Bot)

1. Include MIT copyright and permission notice in `THIRD_PARTY_NOTICES`.
2. Retain notice in source distributions of ported files.

**Polymarket bot:** MIT license applies to published source; NATIVE02 **security audit rejects porting** regardless of license permissibility.

Suggested ported-file header (OpenChart only):

```text
// Portions derived from OpenChart (https://github.com/longsurf-ai/openchart)
// SPDX-License-Identifier: MIT
// Upstream: <path>@8109466bfb5d44c32e0e03e9337eaca48b837ab4
```

---

## Solstice proprietary default

SunRey application code remains proprietary unless explicitly marked otherwise. Upstream OSS does not override `AGENTS.md`, Kernel gating, or simulation posture.

---

## THIRD_PARTY_NOTICES maintenance

Root [`THIRD_PARTY_NOTICES`](../../../THIRD_PARTY_NOTICES) is the legal attribution bundle. Update it when:

- A port lands in `packages/**` (list Solstice paths derived from upstream).
- Pin SHA changes for any registered upstream.
- New NOTICE files appear in Seris/BYTEX pins.

Transitive npm/pnpm dependencies continue to use package manager license metadata unless their **source** is ported.

---

## Modules excluded from porting (license irrelevant)

| Upstream area | Reason |
|---------------|--------|
| BYTEX `Bytex.Live`, `Bytex.Adapters.*`, `Bytex.Cli` keys | Execution + secrets |
| OpenChart server/desktop/access/agent | Product runtime + credentials |
| TradingAgents trader/PM + live dataflows | Non-gated trade narrative + live HTTP |
| Seris desktop + credential pipe + exec tools | OS secrets + shell |
| Polymarket `support/**`, entrypoints, `release.pkg` | Supply-chain / RCE class |

Aligned with [`LICENSE_AND_ATTRIBUTION_PLAN.md`](../open-source/LICENSE_AND_ATTRIBUTION_PLAN.md).
