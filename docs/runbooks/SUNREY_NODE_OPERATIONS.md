# SunRey Node Operations Runbook

Simulation and testnet operations only. MAINNET remains fail-closed.

## Environment matrix

| Environment | Purpose | Deploy | Chain ID |
| --- | --- | --- | --- |
| LOCAL | Developer workstation | yes | `chn_sunrey_local` |
| DEVNET | Multi-validator development | yes | `chn_sunrey_development` |
| TESTNET | Public test network | yes | `chn_sunrey_testnet_1` |
| PREPRODUCTION | Staging rehearsal | rehearsal | `chn_sunrey_preproduction` |
| MAINNET | Production | **no** | `chn_sunrey_mainnet` |

Never reuse chain IDs, genesis files, validator keys, databases, RPC
endpoints, provider credentials, or governance authorizations across
environments.

## Node roles

### Validator

- Participates in BFT consensus
- Holds consensus and governance keys via external signer (not in Git)
- Binds P2P to private network; operator RPC on `127.0.0.1` or private net
- Must not expose public RPC or host faucet/explorer services
- Requires at least two sentry peers

### Full node (non-validator)

- Syncs chain state via P2P
- Does not vote or sign blocks
- No validator private keys
- Operator interface on private bind only

### Read-only RPC / query node

- Serves public `/v1/*` read API and transaction submission
- No validator private keys
- No admin endpoints on public bind
- Rate limited (32 req/s default)

## Startup

### Local 3-node development network

```bash
npm run demo:sunrey-devnet
```

Or as separate processes:

```bash
bash scripts/sunrey-devnet.sh
```

Nodes A/B/C use isolated data directories under `/tmp/sunrey-devnet-abc`.
Readiness is `GET /ready` on operator ports 42001–42003.

### Local 4-validator development network

```bash
npm run demo:sunrey-validator-devnet
```

Or:

```bash
bash scripts/sunrey-validator-devnet.sh
```

Validators A/B/C/D use ports 26670–26683 (P2P) and 26680–26683 (operator).
Readiness is `GET /ready` on each operator port.

### Testnet (Kubernetes)

1. Build images from `deploy/sunrey-testnet/docker/`
2. Apply manifests from `deploy/sunrey-testnet/k8s/`
3. Or use Helm: `deploy/sunrey-testnet/helm/sunrey-testnet/`
4. Verify probes on RPC service port 26657: `/health` and `/ready`

ConfigMap sets `environment: simulation` and `mainnetActive: "false"`.

### MAINNET

Do not start. `evaluateMainnetRuntimeGate()` fails closed. See
`docs/architecture/WAVE2_PRODUCTION_RUNTIME.md`.

## Shutdown

### Local devnet scripts

Press Ctrl-C. Scripts trap SIGINT/SIGTERM and kill child node processes.

### Kubernetes

```bash
kubectl delete -f deploy/sunrey-testnet/k8s/validators.yaml
```

Use graceful termination (default 30s). Validators should complete WAL
flush before exit.

### Validator maintenance

Set `maintenanceMode: true` in operator config before planned shutdown.
Drain mempool submissions on RPC nodes before removing from load balancer.

## Health and readiness checks

| Probe | Path | Meaning |
| --- | --- | --- |
| Liveness | `GET /health` | Process alive |
| Readiness | `GET /ready` | Blockchain-ready |

Readiness requires (see `readiness.ts`):

- storage available
- genesis loaded
- consensus initialized
- state consistent
- sync within bounds
- validator key available (validators only)
- protocol version compatible
- no canonical-state corruption

Kubernetes example (from `deploy/sunrey-testnet/k8s/seed-rpc.yaml`):

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 26657
readinessProbe:
  httpGet:
    path: /ready
    port: 26657
```

## Basic transaction lifecycle

1. Client constructs SRCB v1 signed transaction for correct `network_id` / `chain_id`
2. Submit via `POST /v1/transactions` on a READ_ONLY_RPC node
3. RPC validates signature, network, chain, nonce before mempool admission
4. Consensus includes transaction in block
5. Query status via `GET /v1/transactions/{id}`
6. `INCLUDED` is local observation; `FINALIZED` requires commit certificate

Cross-network transactions return `WRONG_NETWORK` or `WRONG_CHAIN`.

## Network isolation verification

1. Confirm node reports expected `network_id` and `chain_id` in `GET /v1/chain/status`
2. Attempt to replay a DEVNET-signed transaction against TESTNET identity — must fail
3. Confirm database connection uses environment-specific namespace
4. Confirm provider credentials reference environment scope from `ENVIRONMENT_MATRIX`
5. Confirm MAINNET gate reports `passed: false`

Run automated checks:

```bash
npm test -- tests/wave-2-chain-production-runtime.test.ts
npm test -- tests/phase-g-03-chain-runtime.test.ts
```

## Recovery

### Node restart

1. Stop node gracefully
2. Verify data directory integrity
3. Restart with same `network_id`, `chain_id`, and genesis
4. Wait for `GET /ready` before serving traffic
5. Verify sync lag within bounds via operator readiness report

### State sync

Use `stateSync` configuration in operator config (`src/ops/config.ts`).
Trusted height and state root must match network consensus.

### Snapshot restore

Snapshots live under `{dataDirectory}/snapshots`. Retain policy default: 3.
Verify snapshot trust per `recovery.ts` before restore.

### Wrong genesis

Nodes with mismatched genesis hash must not join the network. The devnet
scenario test (`devnet_scenario.rs`) verifies wrong-genesis rejection.

### Incident / mainnet abort

For rehearsal flows see Chunk 167 (`src/governance-ops/launch-abort/`).
Application rollback is not chain-history rollback.

## Observability

- Metrics: `GET /v1/metrics` on RPC nodes
- Structured logs: JSON with `event` field; never log secrets
- Control room ingestion: `src/ops/control-room/` (simulation)

Key metrics to monitor:

- `block_height` vs `finalized_height` lag
- `peer_count` (validators: sentry paths)
- `mempool_size`
- `consensus_round`
- `storage_errors`
- `supply_reconciliation_status`

## Security checklist

- [ ] Validator keys in HSM/KMS or UDS signer, not in container image
- [ ] Public RPC behind TLS edge (testnet: configure ingress)
- [ ] No wildcard CORS
- [ ] Rate limiting enabled
- [ ] Admin plane not on `0.0.0.0`
- [ ] Key files mode `0600` or stricter
- [ ] No debug endpoints on public plane
- [ ] `ENVIRONMENT=simulation`, all `LIVE_*=false`

## Infrastructure requirements

| Component | Requirement |
| --- | --- |
| Compute | 2+ vCPU per validator, 4+ GB RAM |
| Storage | SSD, 50+ GB per validator with growth headroom |
| Network | Private P2P between validators/sentries; public RPC behind edge |
| Secrets | External secret manager; no secrets in Git |
| TLS | Terminate at ingress for public RPC |
| Monitoring | Scrape `/v1/metrics`; alert on finality lag and disk pressure |
| Backup | WAL, signer safety store, validator config (see `ops/types.ts`) |

Production-candidate modules: `infra/sunrey-production/modules/`. Plan-only;
human authorization required before any cloud apply.

## Related documentation

- `docs/architecture/WAVE2_PRODUCTION_RUNTIME.md`
- `docs/productization/PHASE_G_03_SUNREY_CHAIN_RUNTIME.md`
- `docs/productization/SUNREY_VALIDATOR_OPERATOR_GUIDE.md`
- `docs/runbooks/local-sunrey-devnet.md`
- `docs/runbooks/four-validator-devnet.md`
