# Interoperability Security (Wave 3 Prompt 9)

Owner: `packages/sunrey-chain` (Rust `sunrey-interop` crate and TypeScript
`src/interop/`). Engineering record only. Not a certification, penetration
test, or counsel review.

**Production interoperability remains FAIL-CLOSED.** ADR-0029 and Wave 2
governance require explicit activation, qualification, and counsel review
before any production bridge or live external-chain settlement.

Simulation `ENVIRONMENT` remains `simulation`. Every `LIVE_*` flag remains
`false`.

## Architecture

```text
External Network
       ↓
Watcher (isolated process, observation only)
       ↓
Observation / Proof
       ↓
Validation (light-client + envelope + policy)
       ↓
Relayer (isolated process, submission only)
       ↓
SunRey Interop Boundary
       ↓
Policy + Circuit Breakers
       ↓
Execution / Settlement (Kernel-gated; dev asset only today)
```

Inbound (`external → SunRey`) and outbound (`SunRey → external`) flows are
modeled separately. Outbound failure rolls back outbound counters only and
must not corrupt SunRey settlement state.

## Components

| Component | Location | Role |
| --- | --- | --- |
| `IsolatedWatcher` | `rust/crates/interop/src/watcher.rs` | External observation only |
| `IsolatedRelayer` | `rust/crates/interop/src/relayer.rs` | Untrusted submission |
| `InteropBoundary` | `rust/crates/interop/src/boundary.rs` | Observation → verification → execution |
| `InteropMessageEnvelope` | `rust/crates/interop/src/envelope.rs` | Canonical deterministic envelope |
| `InteropActivationGate` | `rust/crates/interop/src/activation.rs` | Fail-closed production gate |
| `InteropCircuitBreakers` | `rust/crates/interop/src/circuit_breaker.rs` | Pause, limits, anomaly trip |
| `InteropNetworkPolicy` | `rust/crates/interop/src/network.rs` | Allowlist egress |
| `interop rpc_access` | `rust/crates/interop/src/rpc_access.rs` | RPC method classification |
| `ExternalRpcEvaluator` | `rust/crates/interop/src/external_rpc.rs` | RPC failure / finality model |
| `InteropKeyBinding` | `rust/crates/interop/src/keys.rs` | Key separation |
| TypeScript mirror | `src/interop/security.ts` | Tests and BFF alignment |

Binaries:

- `sunrey-watcher` — observation service (`run` / `observe`)
- `sunrey-relayer` — submission service (`run` / `demo`)

## Trust boundaries

| Boundary | Trusted | Untrusted / compromiseable |
| --- | --- | --- |
| A. External RPC endpoint | Nothing by default | Endpoint, response, ordering, finality |
| B. Watcher | Nothing alone | Watcher host, observation bytes |
| C. Relayer | Nothing | Relayer host, submitted envelopes |
| D. Bridge signer | Signature under `INTEROPERABILITY_SIGNING` only | Cannot sign consensus, governance, treasury |
| E. SunRey node | Verified interop state after boundary | Raw relayer payloads |
| F. Validator | Consensus after BFT rules | Not an interop submission path |
| G. Consensus | SunRey economic state | Foreign finality until verified |
| H. Treasury / custody | Kernel-gated ledger journals | Interop cannot move treasury master keys |
| I. Application backend | Orchestration after Kernel | Must not bypass interop boundary |

A compromised relayer **must not** imply arbitrary SunRey state mutation. All
business payloads are verified against light-client membership proofs and
deterministic envelope hashes before execution.

## Allowed connectivity

Policy source: `config/sunrey-chain/interop-network-policy.yaml`

**Watcher** may egress to:

- explicitly approved external RPC endpoints (`fixture://external-dev-rpc` in simulation)

**Relayer** may egress to:

- explicitly approved SunRey ingress (`https://interop-ingress.sunrey.test/v1`)

**Denied for both:**

- databases (`postgres://*`)
- internal admin APIs
- secret stores / vaults
- validator private keys
- unrelated providers

Kubernetes network policies (reference only; apply in deployment):

- `deploy/sunrey-testnet/k8s/interop-network-policy.yaml`

## Key separation

| Purpose | May interop use? | Notes |
| --- | --- | --- |
| `INTEROPERABILITY_SIGNING` | Yes | Bridge boundary only |
| `WATCHER_ATTESTATION` | Yes | Observation attestation only |
| `RELAYER_SUBMISSION` | Yes | Transport metadata only |
| `VALIDATOR_CONSENSUS_SIGNING` | **No** | Separate process and credential |
| `BLOCK_PROPOSAL_SIGNING` | **No** | |
| `GOVERNANCE_SIGNING` | **No** | |
| `WALLET_SIGNING` / treasury | **No** | |
| `EXECUTION_AUTHORITY_SIGNING` | **No** | Kernel HMAC only |

Enforced in `keys.rs` and `packages/security/src/purposes.ts`.

## Message validation

`InteropMessageEnvelope` fields (deterministic):

- `envelope_version`, `protocol_version`, `direction`
- `source_network`, `source_chain_id`, `source_tx_hash`, `source_event_index`
- `destination_chain_id`, `destination_channel`, `message_type`
- `payload_hash` (not raw relayer payload)
- `message_nonce`, `sequence`, `expiry_height`, `expiry_timestamp`
- `proof_reference`, `attestation_digest`, `domain`

Validation order at boundary:

1. activation gate (development vs production)
2. envelope structure and version
3. supported source chain and capability
4. payload hash vs verified membership proof
5. replay set
6. circuit breakers and limits
7. execution via `InteropEngine.recv_packet`

Malformed or unsupported inputs fail closed.

## Replay protection

Replay keys are deterministic from:

- `sourceChainId`
- `sourceTxHash`
- `sourceEventIndex`
- `messageNonce`
- `direction`

Consumed IDs persist in engine `replay` / boundary `consumed` sets and
packet lifecycle records. Timestamps alone are not replay protection.

## Limits and circuit breakers

| Control | Implementation |
| --- | --- |
| Global pause | `InteropCircuitBreakers.global_paused` |
| Per-network pause | `paused_networks` |
| Per-asset pause | `paused_assets` |
| Rate limits | `rate_limit_per_window` |
| Value limits | `value_limit_minor` |
| Message-count limits | `message_count_limit` |
| Anomaly threshold | `anomaly_threshold` → auto global pause |
| Emergency disable | `emergency_disable()` with audit log |

Pause authority is bounded via `PauseAuthorityRegistry`. No single key bypasses
consensus rules.

## Finality assumptions

| Model | Status | Confirmations |
| --- | --- | --- |
| `SIMULATED_DETERMINISTIC_BFT_EXTERNAL_CHAIN` | Implemented (dev) | 1 |
| `DETERMINISTIC_BFT` | Not implemented | — |
| `PROBABILISTIC_LONGEST_CHAIN` | Not implemented | — |
| `EXTERNAL_CHECKPOINT_FINALITY` | Not implemented | — |

`ExternalRpcEvaluator` rejects timeout, stale block, reorg, conflicting
providers, malformed responses, and rate limits. First RPC response is never
irreversible truth.

## Watcher security model

- Watchers and relayers run in **separate processes** with **separate credentials**.
- A single watcher is **`SINGLE_WATCHER_UNTRUSTED_UNTIL_VERIFIED`**.
- Multiple watchers require an explicit quorum design before any production claim.

## Production activation prerequisites

Production interop stays **DISABLED** unless **all** are true:

1. `InteropActivationState::ProductionActive`
2. `governance_approval_id` present
3. `qualification_complete == true`
4. `counsel_review == CONFIRMED_BY_COUNSEL`
5. Wave 2 / Chunk 70 launch rehearsal gates satisfied
6. No `LIVE_*` flag enabled by interop services

**Does not activate** because:

- a URL exists
- a provider credential exists
- `NODE_ENV=production`
- a development flag leaks
- a relayer or watcher starts

## Threat model

### 1. Malicious relayer

| | |
| --- | --- |
| **Attack** | Submit forged headers, packets, or payloads |
| **Control** | Light-client verification, envelope hash, replay set, relayer forbidden from governance |
| **Residual risk** | DoS volume until rate limits trip |
| **Detection** | `interop_rejected_headers`, `interop_proof_failures`, evidence vault |
| **Response** | Reject submission; per-network or global pause |

### 2. Compromised watcher

| | |
| --- | --- |
| **Attack** | Emit false observations |
| **Control** | Observations are not execution; verification requires membership proofs |
| **Residual risk** | Noise / DoS until circuit opens |
| **Detection** | Conflicting observations, RPC evaluator conflicts |
| **Response** | Freeze client; pause network |

### 3. Compromised external RPC

| | |
| --- | --- |
| **Attack** | Return fake blocks, withhold reorgs |
| **Control** | Finality requirements, multi-observation reconcile, stale detection |
| **Residual risk** | Sophisticated long-range attack on unimplemented models |
| **Detection** | `EXTERNAL_RPC_CONFLICT`, `EXTERNAL_RPC_REORG` |
| **Response** | Halt verification; require alternate observation path |

### 4. External-chain reorg

| | |
| --- | --- |
| **Attack** | Roll back observed deposit |
| **Control** | Confirmation depth, reorg detector, client freeze on misbehavior |
| **Residual risk** | Model not implemented for probabilistic chains |
| **Detection** | Height/hash regression in evaluator |
| **Response** | Freeze client; timeout in-flight packets |

### 5. Replayed message

| | |
| --- | --- |
| **Attack** | Re-execute prior inbound transfer |
| **Control** | Deterministic replay keys persisted at boundary |
| **Residual risk** | Implementation bug in replay store |
| **Detection** | `PACKET_REPLAY` metric |
| **Response** | Hard reject; audit replay key |

### 6. Fabricated deposit

| | |
| --- | --- |
| **Attack** | Claim deposit without chain evidence |
| **Control** | Membership proof + payload hash match |
| **Residual risk** | Broken light client for new chain type |
| **Detection** | `MODIFIED_PACKET`, `INVALID_MEMBERSHIP_PROOF` |
| **Response** | Reject; freeze client if repeated |

### 7. Forged withdrawal

| | |
| --- | --- |
| **Attack** | Outbound message without SunRey authorization |
| **Control** | Outbound flow ledger; settlement not committed on failure |
| **Residual risk** | Future outbound signer compromise |
| **Detection** | Outbound authorization audit |
| **Response** | Roll back outbound state; no settlement commit |

### 8. Key compromise

| | |
| --- | --- |
| **Attack** | Reuse validator or treasury key for bridge signing |
| **Control** | `InteropKeyBinding`, forbidden purpose list |
| **Residual risk** | Operational mis-issuance of keys |
| **Detection** | Key purpose matrix audit, CI secret scan |
| **Response** | Rotate interop keys; pause global interop |

### 9. Compromised bridge service host

| | |
| --- | --- |
| **Attack** | Relayer/watcher pod takeover |
| **Control** | NetworkPolicy egress allowlists, no validator keys in pod |
| **Residual risk** | Cluster misconfiguration |
| **Detection** | Egress anomaly, admin RPC attempts |
| **Response** | Kill pod; emergency disable |

### 10. Denial-of-service

| | |
| --- | --- |
| **Attack** | Flood headers, packets, RPC |
| **Control** | Size bounds, rate limits, circuit breakers |
| **Residual risk** | Large-scale network DoS |
| **Detection** | Rate limiter rejected count, anomaly threshold |
| **Response** | Per-network pause; global pause |

### 11. Message parser exploit

| | |
| --- | --- |
| **Attack** | Malformed envelope causes crash or bypass |
| **Control** | Strict schema version, size limits, fuzz smoke tests |
| **Residual risk** | Unknown parser defect |
| **Detection** | `SCHEMA_INVALID`, crash telemetry |
| **Response** | Reject; patch; pause until fixed |

### 12. Insider misuse

| | |
| --- | --- |
| **Attack** | Operator enables production interop without governance |
| **Control** | `InteropActivationGate`, audit log on pause actions |
| **Residual risk** | Compromised governance signer |
| **Detection** | Governance evidence vault, activation state monitors |
| **Response** | Emergency disable; governance review |

## Recovery procedures

1. **Global pause** — `InteropCircuitBreakers.emergency_disable(actor, reason)`
2. **Per-network pause** — isolate suspect external chain
3. **Client freeze** — `freeze_on_misbehavior` with evidence record
4. **Expired client** — governed recovery via `recover_expired_client`
5. **Resume** — requires governance authorization; incident end does not auto-resume

## Remaining deployment / IaC controls

These require operator deployment outside this repository:

- Apply `deploy/sunrey-testnet/k8s/interop-network-policy.yaml` in target clusters
- Enforce secret mount boundaries per `interop-network-policy.yaml`
- HSM-backed `INTEROPERABILITY_SIGNING` in production (`PRODUCTION_HSM_KMS_CONFIGURED` remains `false`)
- Egress firewall rules at cloud edge matching allowlists
- SIEM alerts on `RPC_METHOD_FORBIDDEN` and pause audit events

## Remaining independent security-review requirements

- Counsel review for cross-chain money transmission (`RESEARCH_REQUIRED`)
- Third-party audit of light-client implementations before non-simulated chains
- Penetration test of relayer/watcher network isolation in deployed environment
- Formal verification gap review against `formal/tla/InteropPacketState.tla`
- Production key ceremony for `INTEROPERABILITY_SIGNING` separate from validator genesis

## Related documents

- [ADR-0029](../architecture/adr/ADR-0029-sunrey-blockchain-interoperability.md)
- [Interoperability security model (Chunk 50)](../architecture/interoperability-security-model.md)
- [Relayer operations runbook](../runbooks/relayer-operations.md)
- [Key purpose matrix](./key-purpose-matrix.md)
