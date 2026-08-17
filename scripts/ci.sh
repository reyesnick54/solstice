#!/usr/bin/env bash
# Local full pipeline. Stage order must match .github/workflows/ci.yml.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> architectural invariants"
python3 scripts/lint-architectural-invariants.py
python3 scripts/extraction-dryrun.py
npm run lint:architecture

echo "==> deployment posture"
python3 scripts/check-deployment-posture.py

echo "==> kernel gating"
npm run gate

echo "==> lockfile enforcement"
node scripts/check-lockfiles.mjs

echo "==> rust (sunrey local node)"
(
  cd packages/sunrey-chain/rust
  cargo fmt --check
  cargo clippy --all-targets --locked -- -D warnings
  cargo test --workspace --locked
)

echo "==> supply-chain audit / sbom / provenance / two-builder / sign-verify"
node scripts/sunrey-release.mjs audit
node scripts/sunrey-release.mjs sbom
node scripts/sunrey-release.mjs provenance
node scripts/sunrey-release.mjs compare-builds
node scripts/sunrey-release.mjs sign
node scripts/sunrey-release.mjs verify
node scripts/sunrey-audit.mjs generate
node scripts/sunrey-audit.mjs verify dist/sunrey-audit
node scripts/sunrey-audit.mjs reproduce
node scripts/check-generated-drift.mjs
node scripts/static-security-lint.mjs
node scripts/check-container-pins.mjs

echo "==> tests"
npm run test:sunrey-node
npm test
npm run sunrey-ceremony -- rehearse
npm run sunrey-bench -- sanity

echo "==> fuzz smoke"
npm run test:fuzz-smoke

echo "==> formal smoke"
npm run test:formal-smoke

echo "==> end-to-end demo"
npm run demo
npm run demo:cards
npm run demo:peg
npm run demo:wallet
npm run demo:acceptance
npm run demo:growth
npm run demo:peve
npm run demo:treasury
npm run demo:investments
npm run demo:rdt
npm run demo:risk
npm run demo:pdv
npm run demo:strategy-lab
npm run demo:mesh
npm run demo:consent
npm run demo:clean-room
npm run demo:sunrey-coin
npm run demo:information-market
npm run demo:sunrey-chain
npm run demo:sunrey-node
npm run demo:sunrey-governance
npm run demo:moonrey-productive
npm run demo:sunrey-oracle
npm run demo:sunrey-fees
npm run demo:sunrey-machine-economy
npm run demo:sunrey-wallet
npm run demo:sunrey-interop
npm run demo:sunrey-ops
npm run demo:sunrey-testnet
npm run demo:sunrey-mainnet
npm run sunrey-mainnet -- verify
node scripts/sunrey-testnet-validate-manifests.mjs
node scripts/sunrey-testnet-sbom.mjs
npm run demo:sunrey-sdk
npm run demo:sunrey-devnet
npm run demo:sunrey-validator-devnet
npm run demo:sunrey-accountability
npm run demo:sunrey-native-assets
npm run demo:sunrey-exchange
npm run demo:sunrey-exchange-native
npm run demo:sunrey-exchange-settlement
npm run demo:custody
npm run demo:institutional-custody
npm run demo:custody-unknown
npm run demo:custody-cold
npm run demo:market-surveillance
npm run demo:listing-governance
npm run demo:explorer
npm run demo:sunrey-bench
npm run sunrey-range -- campaign --smoke
npm run demo:sunrey-range
SUNREY_FIXTURE_ENV="${SUNREY_FIXTURE_ENV:-local}" node scripts/sunrey-release.mjs rc qualify --profile smoke
SUNREY_FIXTURE_ENV="${SUNREY_FIXTURE_ENV:-local}" node scripts/sunrey-release.mjs rc verify
SUNREY_FIXTURE_ENV="${SUNREY_FIXTURE_ENV:-local}" npm run demo:sunrey-rc
npm run demo:universal-exchange
npm run demo:sunrey-audit

echo "==> typecheck"
npm run typecheck

echo "==> secret scan"
python3 scripts/secret-scan.py
python3 scripts/secret-scan.py --self-test

echo "CI pipeline: ok"
