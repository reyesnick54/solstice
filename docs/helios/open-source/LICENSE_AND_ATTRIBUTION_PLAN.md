# HELIOS open-source license and attribution plan (OS00)

This plan governs how Apache-2.0 and MIT upstream code may enter Solstice if OS01–OS15 ports proceed. OS00 creates policy only; no upstream source is committed.

Lock file: [`upstream-lock.json`](./upstream-lock.json)

---

## License summary (verified at OS00 fetch)

| Upstream | SPDX | Verified file | Pin SHA |
|----------|------|---------------|---------|
| BYTEX | Apache-2.0 | `LICENSE` | `67b3e103043476a0490bb7afa146ec9ac339b116` |
| OpenChart | MIT | `LICENSE` (Copyright 2026 Longsurf, Inc.) | `8109466bfb5d44c32e0e03e9337eaca48b837ab4` |
| TradingAgents | Apache-2.0 | `LICENSE` | `c4544913a14ed3df5f1ed7b9e8483270ce20682a` |
| Seris | Apache-2.0 | `LICENSE`, `NOTICE` | `f73dbbb0cd7e3b52601abf905bb871cdb9098550` |
| Polymarket Prediction Bot | MIT | `LICENSE` | `1f7c9761ddd26863242e3ed4f83c230ee38aebeb` |

Re-verify license text and SHA before each port work package.

---

## Permissibility of direct code reuse

| Upstream | Permitted with compliance | Preferred approach |
|----------|---------------------------|-------------------|
| BYTEX | Yes | Reimplement indicator/backtest math in TypeScript; use C# repo as reference only |
| OpenChart | Yes | Port pure TS indicator/alert logic; do not bundle OpenChart server/desktop |
| TradingAgents | Yes | Reimplement agent flow in TS; avoid embedding Python LangGraph in financial path |
| Seris | Yes | Workflow patterns only; do not copy desktop key storage |
| Polymarket bot | Yes (exclude credential modules) | Paper/demo fixtures only; rewrite auth away |

All reuse must respect SunRey architecture rules in `AGENTS.md` (no second ledger, Kernel, or Exchange).

---

## Apache-2.0 obligations (BYTEX, TradingAgents, Seris)

When copying or adapting **source** (not merely reading for design):

1. Include a copy of the Apache-2.0 license or a pointer to it in `THIRD_PARTY_NOTICES`.
2. Retain copyright, patent, trademark, and attribution notices from source files.
3. Document modifications in `THIRD_PARTY_NOTICES` or file-level comment.
4. If Seris `NOTICE` file attributions apply to ported subcomponents, reproduce them in `THIRD_PARTY_NOTICES`.

Suggested file header template:

```text
// Portions derived from <project> (<url>)
// SPDX-License-Identifier: Apache-2.0
// Upstream: <path>@<sha>
// Modifications: Copyright <year> SunRey / Solstice contributors
```

---

## MIT obligations (OpenChart, Polymarket Prediction Bot)

1. Include the MIT copyright notice and permission notice in `THIRD_PARTY_NOTICES`.
2. Retain the above notice in source distributions of ported files.

Suggested file header template:

```text
// Portions derived from <project> (<url>)
// SPDX-License-Identifier: MIT
// Upstream: <path>@<sha>
```

---

## THIRD_PARTY_NOTICES (OS02)

Solstice does not yet ship a root `THIRD_PARTY_NOTICES` file. OS02 should add one with sections:

1. **SunRey proprietary** — default repository license.
2. **Apache-2.0 components** — BYTEX, TradingAgents, Seris (as ported).
3. **MIT components** — OpenChart, Polymarket Prediction Bot (as ported).
4. **Transitive runtime dependencies** — continue to rely on npm/pnpm license metadata where no source port occurred.

Each ported component entry must list:

- Project name and URL
- Pinned SHA at time of port
- List of Solstice file paths derived from upstream
- License SPDX id

---

## Modules that must not be ported verbatim

| Upstream area | Reason |
|---------------|--------|
| BYTEX `Bytex.Live`, venue adapters with live keys | Execution + credential plane |
| TradingAgents trader agent / direct order emission | Bypasses Kernel and EA |
| Seris local API key vault | Conflicts with `packages/security` envelope model |
| Polymarket `config.py` auth fields, `private_key` | Custody and live trading |
| Polymarket `support/block.py` site auth | Unrelated licensing gate; not HELIOS |

These may inform **tests and fixtures** only after security review.

---

## Evidence and audit trail

For each OS05+ merge that includes ported code:

- Bump `upstream-lock.json` if SHA changes.
- Add Evidence Vault–sealed CI artifact reference in HELIOS release notes (qualification RC).
- Store upstream path ↔ Solstice path mapping in PR description (table format).

---

## Simulation posture

All open-source integration remains in **simulation** until separate production activation work packages explicitly authorize otherwise. Upstream licenses do not override SunRey Kernel gating or `ENVIRONMENT=simulation`.
