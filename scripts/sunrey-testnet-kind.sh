#!/usr/bin/env bash
# Local Kubernetes test. Uses kind when available; otherwise the
# in-process multi-process testnet simulation.
set -euo pipefail
cd "$(dirname "$0")/.."

node scripts/sunrey-testnet-validate-manifests.mjs

if command -v kind >/dev/null 2>&1; then
  kind get clusters | grep -qx sunrey-testnet-1 || kind create cluster --config deploy/sunrey-testnet/kind/cluster.yaml
  kubectl apply -f deploy/sunrey-testnet/k8s
  echo "kind cluster sunrey-testnet-1 applied"
  exit 0
fi

echo "kind not available; running in-process local cluster simulation"
SUNREY_FIXTURE_ENV="${SUNREY_FIXTURE_ENV:-local}" node --experimental-strip-types --disable-warning=ExperimentalWarning packages/sunrey-chain/src/testnet/demo.ts
