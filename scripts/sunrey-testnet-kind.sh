#!/usr/bin/env bash
# Real local Kubernetes Testnet-1 qualification. The fallback simulation is
# retained only for developer convenience; Prompt 3 CI sets SUNREY_REQUIRE_KIND=1.
set -euo pipefail
cd "$(dirname "$0")/.."

node scripts/sunrey-testnet-validate-manifests.mjs
node scripts/check-production-safety.mjs

if ! command -v kind >/dev/null 2>&1 || ! command -v kubectl >/dev/null 2>&1 || ! command -v docker >/dev/null 2>&1; then
  if [[ "${SUNREY_REQUIRE_KIND:-0}" == "1" ]]; then
    echo "Prompt 3 requires docker, kind, and kubectl; refusing simulation fallback" >&2
    exit 1
  fi
  echo "kind/docker/kubectl unavailable; running non-qualifying in-process simulation"
  SUNREY_FIXTURE_ENV="${SUNREY_FIXTURE_ENV:-local}" node --experimental-strip-types --disable-warning=ExperimentalWarning packages/sunrey-chain/src/testnet/demo.ts
  exit 0
fi

CLUSTER_NAME="sunrey-testnet-1"
IMAGE="sunrey-node:testnet-1"

if ! kind get clusters | grep -qx "$CLUSTER_NAME"; then
  kind create cluster --config deploy/sunrey-testnet/kind/cluster.yaml
fi

echo "Building the actual SunRey validator node image..."
docker build \
  --file deploy/sunrey-testnet/docker/sunrey-node.Dockerfile \
  --tag "$IMAGE" \
  --build-arg SOURCE_COMMIT="${GITHUB_SHA:-local}" \
  .
kind load docker-image "$IMAGE" --name "$CLUSTER_NAME"

# Apply only the canonical validator plane for the real consensus proof here.
# Legacy faucet/RPC/sentry manifests remain separately validated until their
# images are independently deployed and qualified.
kubectl apply -f deploy/sunrey-testnet/k8s/namespace.yaml
kubectl apply -f deploy/sunrey-testnet/k8s/configmap.yaml
kubectl apply -f deploy/sunrey-testnet/k8s/validators.yaml

bash scripts/sunrey-testnet-live-verify.sh

echo "real SunRey Testnet-1 kind qualification passed"
