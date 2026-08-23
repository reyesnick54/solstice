# SunRey security auditor handoff

Package for an external security assessor. Range campaigns and
in-process red-team suites are **not** a live pentest report.

`EXTERNAL_SECURITY_REVIEW_READY=true`
`PRODUCTION_READY=false`

## Architecture and trust boundaries

- Freeze: `docs/productization/SUNREY_PRODUCTION_ARCHITECTURE_FREEZE.md`
- Authority map: `docs/productization/sunrey-authority-map.json`
- Constitution: `docs/architecture/constitution.md`
- Chain authority: `docs/architecture/sunrey-chain-authority-matrix.md`
- Native-asset boundary: `docs/architecture/native-asset-authority-boundary.md`

Non-negotiable: Ledger posts only through Kernel + Execution Authority.
The Agent cannot become Execution Authority. Frontends never keep books.
Providers adapt; they are not the system of record.

## Threat models

- `docs/architecture/security.md`
- `docs/security/sunrey-blockchain-threat-model.md`
- `docs/productization/SUNREY_AGENT_THREAT_MODEL.md`
- `docs/assurance/attack-matrix.md`
- `docs/assurance/security-invariants.md`
- `docs/security/chunk-157-production-adversarial-resilience.md`

## API / Chain / Agent / Vault / HIN scope

| Plane | Public contract | Notes |
| --- | --- | --- |
| Consumer / BFF | `api/sunrey-consumer-platform-v1.openapi.yaml`, `api/sunrey-consumer-bff-v1.openapi.yaml` | Lovable-safe |
| Exchange | `api/sunrey-exchange-v1.openapi.yaml` | Matching is not Ledger |
| Chain | `api/sunrey-chain-v1.openapi.yaml` | Mainnet blocked |
| Agent | Consumer BFF `/api/v1/agent*` | ProposalGate only |
| Vault / HIN | `/api/v1/data/vault*`, `/api/v1/hin*` | Subject-bound; no get-all |

## Test evidence (internal)

- `tests/phase-b-security.test.ts`, `tests/phase-c-security.test.ts`, `tests/phase-g-red-team.test.ts`
- `packages/sunrey-range` smoke and production-safety campaigns
- `npm run scan:secrets`, `npm run supply-chain:audit`
- Kernel gating: `npm run gate`

Expected unauthorized financial mutations in those suites: **zero**.
Expected unauthorized sensitive disclosures in those suites: **zero**.
These are engineering results, not an external attestation.

## Build artifacts

- TypeScript workspace + Rust `--locked` crates
- SBOM / provenance / sign-verify via `scripts/sunrey-release.mjs`
- RC identifier `sunrey-backend-v1.0.0-rc.1`

## Known risks for the assessor

- Simulation HSM is not a production HSM.
- No live provider webhook secret material is present (correct for this RC).
- Docker image digests were not produced in the Phase I Prompt 6 VM.
- Mainnet, live Exchange, live Agent execution, and live data marketplace stay disabled.

## Suggested pentest scope (external, not run here)

In-scope once a hosted preproduction exists: consumer/BFF authz, IDOR,
session theft, forged approval, webhook forgery, Agent prompt injection
and self-approval, Exchange manipulation, wallet key extraction
attempts, native-asset mint attempts, Vault exfiltration, production
activation attempts.

Out of scope for this repository: live banks, mainnet, customer
production data, real HSM clusters.
