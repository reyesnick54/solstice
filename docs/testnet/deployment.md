# Deployment

Provider-neutral manifests live under `deploy/sunrey-testnet/`.

## Images

| Image | Dockerfile |
| --- | --- |
| sunrey-node | `deploy/sunrey-testnet/docker/sunrey-node.Dockerfile` |
| sunrey-rpc | `deploy/sunrey-testnet/docker/sunrey-rpc.Dockerfile` |
| sunrey-explorer | `deploy/sunrey-testnet/docker/sunrey-explorer.Dockerfile` |
| sunrey-faucet | `deploy/sunrey-testnet/docker/sunrey-faucet.Dockerfile` |
| sunrey-relayer | `deploy/sunrey-testnet/docker/sunrey-relayer.Dockerfile` |

Images use a minimal base, a non-root process, healthchecks, and
version / source-commit / protocol-version labels.

## Orchestration

- Kubernetes manifests: `deploy/sunrey-testnet/k8s/`
- Helm chart: `deploy/sunrey-testnet/helm/sunrey-testnet/`
- kind cluster: `deploy/sunrey-testnet/kind/cluster.yaml`

```bash
node scripts/sunrey-testnet-validate-manifests.mjs
bash scripts/sunrey-testnet-kind.sh
node scripts/sunrey-testnet-sbom.mjs
```

Release artifacts include lock hashes, protocol schema hash, genesis-tool
version, CycloneDX SBOM, and Ed25519 signatures via the local/test
signing port (Cosign-compatible provider interface).
