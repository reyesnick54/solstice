# BYTEX assimilation reference

Assimilation workspace for HELIOS clean-room ports from [BYTEX-TRADE/bytex](https://github.com/BYTEX-TRADE/bytex). **No runtime import of upstream C# assemblies.**

| Field | Value |
| --- | --- |
| Upstream | https://github.com/BYTEX-TRADE/bytex |
| Pinned SHA | `67b3e103043476a0490bb7afa146ec9ac339b116` |
| License | Apache-2.0 |

## NATIVE04 — matching engine / execution simulation

Canonical TypeScript owner: `packages/platform/src/helios/execution-twin/simulation/`.

- `native04-matching.manifest.json` — capability list and qualification marker
- `parity-vectors.json` — HELIOS-authored golden vectors for deterministic parity tests

## NATIVE06 — strategy documents + indicators → Strategy Genome

- `ASSIMILATION_MANIFEST.json` — BYTEX node type → HELIOS catalog refs
- `INDICATOR_PORT_INDEX.json` — indicator class → native module map
- `documents/` — small strategy document fixtures for translation golden tests

Full upstream trees stay in the OS00 reference workspace (`/tmp/_helios_upstream_reference/bytex` or `../_helios_upstream_reference/bytex`), not in this repository.
