# Reviewer quickstart

This is an engineering evidence package. It is not an audit opinion.

## Workflow

1. **Verify bundle** — `npm run sunrey-audit -- verify dist/sunrey-audit`
2. **Inspect architecture** — `docs/architecture/manifest.json`, ADR index, constitution
3. **Run critical test suite** — `npm run sunrey-audit -- reproduce`
4. **Run formal smoke** — property/safety tests. Machine-checked proofs are `NOT_APPLICABLE`
5. **Run fuzz smoke** — `npm run test:fuzz-smoke`
6. **Run adversarial smoke** — `npm run sunrey-range -- campaign --smoke`
7. **Launch seven-validator development network** — `SUNREY_FIXTURE_ENV=local npm run sunrey-testnet -- bootstrap`
8. **Perform native transfer** — use the local fixture faucet / wallet demo (`npm run demo:sunrey-wallet`)
9. **Inspect Explorer** — `npm run sunrey-explorer -- verify`
10. **Verify release artifact** — `npm run sunrey-release -- verify`

Any modified file in the bundle must invalidate `sunrey-audit verify`.

## What this package is not

- Not a passed external audit
- Not production cryptographic approval
- Not a quantum-proof claim
- Not a certified HSM integration
- Not a production consensus deployment
