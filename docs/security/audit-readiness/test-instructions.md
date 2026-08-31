# Security test instructions

## Canonical command

```bash
npm run security:test
```

Runs (in order):

1. Secret scan (`scripts/secret-scan.py`)
2. Static security lint (`scripts/static-security-lint.mjs`)
3. npm audit (moderate+)
4. SBOM generation (`testnet:sbom`)
5. Security regression test suite
6. cargo-audit (if installed)

## Focused suites

```bash
# Wave 6 Prompt 17 regression
npm test -- tests/wave-6-prompt-17-security-assurance.test.ts

# Identity / auth
npm test -- packages/identity/src/authentication-service.test.ts
npm test -- packages/identity/src/authorization.test.ts

# API surface
npm test -- services/api/src/server.test.ts
npm test -- services/api/src/logging.test.ts

# Agent / AI
npm test -- packages/sunrey-agent/src/productization-security.test.ts

# Phase security
npm test -- tests/phase-b-security.test.ts tests/phase-c-security.test.ts

# Wallet / chain
npm test -- tests/chunk-96-wallet-security.test.ts
cd packages/sunrey-chain/rust && cargo test -p sunrey_interop --test security

# Adversarial range (extended — not in security:test)
npm run demo:sunrey-production-adversarial-campaign
```

## Static analysis

| Tool | Command |
| --- | --- |
| Architecture linter | `npm run lint:architecture` |
| TypeScript | `npm run typecheck` |
| Rust clippy | `npm run test:sunrey-node` (includes clippy -D warnings) |
| Secret scan | `npm run scan:secrets` |
| Deployment posture | `npm run check:posture` |

## Long-running (external / nightly)

- Extended adversarial campaign: `sunrey-range -- campaign --production-safety-extended`
- Recommended fuzz campaigns: see `threat-model-stride.md`
- DAST against staging: external pentest scope

## Important

Internal test passage does **not** constitute independent certification.
