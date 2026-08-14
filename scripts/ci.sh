#!/usr/bin/env bash
# Local full pipeline. Stage order must match .github/workflows/ci.yml.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> architectural invariants"
python3 scripts/lint-architectural-invariants.py
python3 scripts/extraction-dryrun.py

echo "==> deployment posture"
python3 scripts/check-deployment-posture.py

echo "==> kernel gating"
node scripts/check-kernel-gating.mjs

echo "==> tests"
npm test

echo "==> end-to-end demo"
npm run demo

echo "==> secret scan"
python3 scripts/secret-scan.py

echo "CI pipeline: ok"
