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

echo "==> tests"
npm test

echo "==> end-to-end demo"
npm run demo
npm run demo:cards
npm run demo:peg
npm run demo:wallet
npm run demo:acceptance

echo "==> typecheck"
npm run typecheck

echo "==> secret scan"
python3 scripts/secret-scan.py
python3 scripts/secret-scan.py --self-test

echo "CI pipeline: ok"
