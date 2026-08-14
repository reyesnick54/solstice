#!/usr/bin/env bash
# Local full pipeline. Stage order must match .github/workflows/ci.yml.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> deployment posture"
python3 scripts/check-deployment-posture.py

echo "==> kernel + phase9 gating"
npm run gate

echo "==> tests"
npm test

echo "==> end-to-end demo"
npm run demo

echo "==> typecheck"
npm run typecheck

echo "==> secret scan"
python3 scripts/secret-scan.py

echo "CI pipeline: ok"
