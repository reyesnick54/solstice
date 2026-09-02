# Wave 2 — SunRey Chain Production Runtime

`MAINNET_ACTIVE=false`
`PRODUCTION_READY=false`
`productionEconomicsAuthorized=false`
`ENVIRONMENT=simulation`

Wave 2 turns the SunRey blockchain core into an operable service without
authorizing production economics. It extends Phase G Prompt 3 runtime
productization in `packages/sunrey-chain/src/runtime/` and the Rust node
workspace. It does not enable SunRey issuance, MoonRey production issuance,
real token launch supply, or production allocations.

## Canonical owner

| Concern | Path |
| --- | --- |
| Runtime productization | `packages/sunrey-chain/src/runtime/` |
| Protocol / SRCB | `packages/sunrey-chain/rust/crates/protocol` |
| Consensus | `packages/sunrey-chain/rust/crates/consensus` |
| Node + P2P | `packages/sunrey-chain/node` |
| RPC | `packages/sunrey-chain/rust/crates/rpc` |
| Testnet deploy | `deploy/sunrey-testnet` |
| Production-candidate infra | `infra/sunrey-production` |
| Operations runbook | `docs/runbooks/SUNREY_NODE_OPERATIONS.md` |

Do not create `packages/blockchain`, `packages/sunrey-node`,
`packages/tendermint`, `packages/validator-operator`, or `packages/sunrey-rpc`.

## Supported environments

| Environment | Network ID | Chain ID | Deployable | Economics |
| --- | --- | --- | --- | --- |
| LOCAL | `net_sunrey_local` | `chn_sunrey_local` | yes | simulation only |
| DEVNET | `net_sunrey_development` | `chn_sunrey_development` | yes | simulation only |
| TESTNET | `net_sunrey_testnet_1` | `chn_sunrey_testnet_1` | yes, active | simulation only |
| PREPRODUCTION / STAGING | `net_sunrey_preproduction` | `chn_sunrey_preproduction` | rehearsal only | simulation only |
| MAINNET | `net_sunrey_mainnet` | `chn_sunrey_mainnet` | **no** | **fail-closed** |

Environment isolation is enforced in `environment.ts`. Each environment has
distinct:

- chain ID and network ID
- genesis scope (`sunrey.genesis.{environment}`)
- database namespace (`sunrey_chain_{environment}`)
- credential scope (`sunrey.credentials.{environment}`)
- governance scope (`sunrey.governance.{environment}`)
- replay binding (`sunrey.replay.v1|{networkId}|{chainId}`)

Development transactions signed for LOCAL, DEVNET, or TESTNET must never be
valid on MAINNET. Cross-environment reuse of databases, RPC endpoints,
validator keys, provider credentials, or governance authorizations is refused.

## Node roles

| Role | Votes | Public RPC | Validator keys | Governance keys |
| --- | --- | --- | --- | --- |
| VALIDATOR | yes | no | yes (via signer) | yes |
| FULL_NODE | no | no | no | no |
| READ_ONLY_RPC | no | yes | **no** | no |

Role configuration lives in `node-roles.ts`. Validators bind RPC and operator
interfaces to private networks. Public query nodes never hold validator private
keys. No secrets are committed to Git (`PRODUCTION_PRIVATE_KEYS_COMMITTED=false`).

Chunk 55 operator profiles in `src/ops/config.ts` and testnet profiles in
`src/testnet/profiles.ts` remain the deployment-facing bindings.

## RPC surfaces

### Public RPC plane

| Method | Purpose |
| --- | --- |
| `GET /health`, `GET /ready` | Liveness and readiness probes |
| `GET /v1/health`, `GET /v1/ready` | Versioned probes |
| `GET /v1/chain/status` | Chain status |
| `GET /v1/network/status` | Network status |
| `GET /v1/chain/blocks` | Latest block |
| `GET /v1/chain/blocks/{height}` | Block lookup |
| `GET /v1/chain/blocks/finalized` | Latest finalized block |
| `GET /v1/transactions/{id}` | Transaction lookup |
| `POST /v1/transactions` | Transaction submission |
| `GET /v1/accounts/{id}` | Account state |
| `GET /v1/assets` | Native asset catalog |
| `GET /v1/assets/supply` | Native asset supply |
| `GET /v1/fees/estimate` | Fee estimate |
| `GET /v1/validators` | Validator set projection |
| `GET /v1/metrics` | Operational metrics |

### Validator RPC plane

| Method | Purpose |
| --- | --- |
| `GET /v1/validator/status` | Validator status |
| `GET /v1/validator/peers` | Peer status |

### Forbidden on public plane

- `POST /admin/produce-block`
- `POST /admin/mutate-balance`
- `POST /admin/set-balance`
- `POST /v1/accounts/mutate`
- Any direct administrative balance mutation

Mutation remains transaction-based. State changes require signed
transactions admitted by consensus.

## Health and readiness

Liveness (`/health`) confirms the process is running. Readiness (`/ready`)
requires blockchain readiness factors evaluated in `readiness.ts`:

- storage available (no disk pressure)
- genesis loaded with valid hash
- consensus initialized
- state consistent (no canonical-state corruption)
- sync lag within configured bounds
- validator key available when role is VALIDATOR
- supported protocol version
- snapshot healthy

A process being alive does not mean it is blockchain-ready.

## Observability

Structured logs and metrics are defined in `observability.ts` and exported
through `GET /v1/metrics` on the RPC plane. Metric catalog includes:

- `block_height`, `finalized_height`
- `peer_count`, `mempool_size`
- `consensus_round`, `finality_delay_ms`
- `transaction_accepted`, `transaction_rejected`
- `block_execution_duration_ms`, `state_commit_duration_ms`
- `state_sync_status`, `validator_participation`
- `supply_reconciliation_status`, `snapshot_status`, `storage_errors`

Never log private keys, seed phrases, raw sensitive HIN data, raw protected
personal information, or secret credentials. `assertSafeLogPayload` rejects
forbidden patterns.

## Security hardening

Defaults in `security.ts`:

| Control | Default |
| --- | --- |
| Rate limit | 32 req/s per peer |
| Max request size | 65 KB |
| Max path length | 512 bytes |
| Bind address (non-public) | `127.0.0.1` |
| CORS wildcard | forbidden |
| Stack traces in responses | disabled |
| Debug endpoints on public plane | disabled |
| Admin authentication | required on ADMIN/VALIDATOR planes |
| Key file permissions | max `0600` |

RPC plane separation is enforced in `rpc.ts` (TypeScript contract) and
`rust/crates/rpc/src/security.rs` (runtime).

## Deployment and runtime model

| Environment | Startup path |
| --- | --- |
| LOCAL 3-node devnet | `npm run demo:sunrey-devnet` or `scripts/sunrey-devnet.sh` |
| LOCAL 4-validator devnet | `npm run demo:sunrey-validator-devnet` or `scripts/sunrey-validator-devnet.sh` |
| TESTNET | `deploy/sunrey-testnet/k8s/` and Helm chart |
| PREPRODUCTION | `deploy/sunrey-preproduction/` (platform rehearsal) |
| MAINNET | **no deployment profiles** — fail-closed |

Container images for testnet live under `deploy/sunrey-testnet/docker/`.
Production-candidate Terraform modules live under `infra/sunrey-production/`
(plan-only; no live cloud apply from this repository).

## Protocol versioning

Supported protocol versions: `1` (see `protocol-version.ts`).

- Nodes reject incompatible consensus-critical versions
- No uncontrolled automatic upgrades (`automaticUpgrade: false`)
- Future upgrades require governance proposal, accountable threshold,
  scheduled activation height, binary compatibility check, and rollback plan

Upgrade rehearsal types exist in `src/testnet/upgrade.ts`.

## Mainnet fail-closed gate

Centralized gate: `evaluateMainnetRuntimeGate()` in `mainnet-gate.ts`.

Current blockers (all must be intentionally satisfied before any future
mainnet activation):

| Blocker | Status |
| --- | --- |
| Production migration not performed | MISSING |
| Mainnet economics not authorized | EXTERNAL_REQUIRED |
| Production genesis not approved | MISSING |
| Governance not configured | MISSING |
| Validator set not approved | MISSING |
| Required key configuration absent | MISSING |
| MoonRey production activation false | MISSING |
| Live economic source requirements not met | EXTERNAL_REQUIRED |
| Production HSM/KMS absent | MISSING |
| Mainnet genesis fail-closed | RECORDED_INTERNAL |
| ENVIRONMENT simulation only | RECORDED_INTERNAL |

`refuseMainnetRuntimeAction()` refuses all mainnet runtime actions until the
gate passes. The gate cannot pass in this repository's simulation posture.

Related gates:

- `evaluateMainnetReadinessGate()` in `packages/sunrey-exchange/src/productization/gates.ts`
- `ProductionEconomicActivationFirewall` in `src/economics/production-activation/firewall.ts`
- Chunk 164 launch freeze and Chunk 165 ceremony (rehearsal only)

## Validation

```bash
npm test -- tests/wave-2-chain-production-runtime.test.ts
npm test -- tests/phase-g-03-chain-runtime.test.ts
npm run test:sunrey-node
npm run demo:sunrey-devnet
```

## Relationship to Phase G

Phase G Prompt 3 (`docs/productization/PHASE_G_03_SUNREY_CHAIN_RUNTIME.md`)
established the network release candidate. Wave 2 hardens operability:
environment isolation, role boundaries, readiness semantics, observability,
security defaults, deployment profiles, protocol versioning, and the centralized
mainnet runtime gate — without authorizing production economics.
