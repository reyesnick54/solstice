# BYTEX assimilation reference (NATIVE06)

Assimilation workspace for HELIOS Strategy Genome ports. **No runtime import of upstream C# assemblies.**

| Field | Value |
| --- | --- |
| Upstream | https://github.com/BYTEX-TRADE/bytex |
| Pinned SHA | `67b3e103043476a0490bb7afa146ec9ac339b116` |
| License | Apache-2.0 |
| Work package | HELIOS NATIVE06 — strategy documents + indicators → Strategy Genome |

## Contents

- `documents/` — small strategy document fixtures used for translation golden tests (derived from upstream examples, not executable authority).
- `ASSIMILATION_MANIFEST.json` — machine-readable map from BYTEX node types to HELIOS catalog refs.
- `INDICATOR_PORT_INDEX.json` — BYTEX indicator class → native TypeScript module map.

Full upstream trees stay in the OS00 reference workspace (`/tmp/_helios_upstream_reference/bytex` or `../_helios_upstream_reference/bytex`), not in this repository.
