# HELIOS native assimilation — legal-only quarantine stubs

**Work packages:** NATIVE01 (import metadata), NATIVE02 (static security audit), NATIVE15 (foreign runtime independence)

This directory holds **legal and provenance stubs only** (README, LICENSE, JSON manifests, golden vectors). Full upstream source trees are **not** committed; refresh offline via `git archive` using pins in [`SOURCE_IMPORT_MANIFEST.json`](./SOURCE_IMPORT_MANIFEST.json).

Trees are **not** npm/pnpm/Cargo workspace packages, **not** runtime dependencies, and **must not** be executed in Solstice CI or production paths.

## Provenance

Authoritative import metadata: [`SOURCE_IMPORT_MANIFEST.json`](./SOURCE_IMPORT_MANIFEST.json).

Security audit and capability mapping: [`docs/helios/native-assimilation/`](../../docs/helios/native-assimilation/).

Attribution: root [`THIRD_PARTY_NOTICES`](../../THIRD_PARTY_NOTICES) and [`docs/helios/native-assimilation/NATIVE_LICENSE_REGISTER.md`](../../docs/helios/native-assimilation/NATIVE_LICENSE_REGISTER.md).

## Security rule

No quarantined component may hold customer private keys, move money, execute orders, modify ledger balances, alter Compliance Kernel policy, alter Risk Engine limits, enable LIVE trading, or bypass Execution Authority. See [`NATIVE_SOURCE_SECURITY_AUDIT.md`](../../docs/helios/native-assimilation/NATIVE_SOURCE_SECURITY_AUDIT.md).
