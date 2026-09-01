# SunRey Blockchain cryptography

Owner: `packages/sunrey-chain/rust/crates/crypto`. Control plane alignment:
`packages/security`. This document is an engineering record. It is **not** a
certification, quantum-proof claim, or counsel review.

## Scope

This policy covers the Rust SunRey Blockchain cryptographic boundary:
transaction authorization, validator/consensus signing, node and peer identity,
hashing, Merkle/state commitments, interop verification, and wallet address
derivation. Application-layer HMAC (Execution Authority, webhooks) remains in
`packages/security` and is not validator consensus signing.

## Currently supported algorithms

| Wire ID | Algorithm ID | Suite ID | Purpose | Crate | Lifecycle |
| --- | --- | --- | --- | --- | --- |
| 1 | `Ed25519` | `sunrey-ed25519-v1` | Protocol transactions, validators, consensus | `ed25519-dalek` 2.1.1 | `APPROVED_FOR_SIMULATION` |
| 2 | `ED25519` | `SUNREY_DEV_ED25519_SHA256` | Local dev node, interop control plane | `ed25519-dalek` 2.1.1 | `APPROVED_FOR_SIMULATION` |
| — | `SHA-256` | (hasher port) | Domain-separated hashes, Merkle roots, tx IDs | `sha2` 0.10.8 | Active |

Hash domains (`sunrey.txid.v1`, `sunrey.sig.v1`, `sunrey.blockid.v1`, etc.) are
defined in `sunrey-protocol` and must not change without a protocol upgrade.

## Registered but disabled (Rust)

These algorithm IDs are registered for alignment with the TypeScript CryptoSuite
catalog. The Rust node **fail-closes** rather than silently mapping them to
Ed25519.

| Wire ID | Algorithm ID | Suite ID | Status |
| --- | --- | --- | --- |
| 3 | `ML_DSA_65_V1` | `sunrey-mldsa-65-v1` | Registered, verification disabled |
| 4 | `SLH_DSA_SHA2_128S_V1` | `sunrey-slhdsa-sha2-128s-v1` | Registered, not wired in Rust |
| 5 | `HYBRID_ED25519_MLDSA_V1` | `sunrey-hybrid-ed25519-mldsa-v1` | Registered, verification disabled |
| 6 | `ML_KEM_768_V1` | `sunrey-mlkem-768-v1` | KEM only; not used in Rust blockchain |

Enable the `experimental-pqc` feature on `sunrey-crypto` to expose PQ suite
registration for development. This does **not** enable production PQ
verification.

## Deprecated algorithms

None retired in this prompt. `ED25519` (dev suite) and `Ed25519` (protocol
suite) remain the active classical algorithms.

## Planned post-quantum algorithms

Aligned with `packages/security` and Chunk 60:

- **ML-DSA-65** (`ML_DSA_65_V1`) — default PQ signature candidate
- **ML-KEM-768** (`ML_KEM_768_V1`) — envelope encryption migration (off-chain)
- **SLH-DSA-SHA2-128S** (`SLH_DSA_SHA2_128S_V1`) — diversification option

TypeScript testnet provider: `@noble/post-quantum@0.5.4`. Rust provider:
**not selected** (see assessment below).

## Algorithm agility architecture

The `sunrey-crypto` crate exposes:

- `AlgorithmWireId` — explicit `u16` wire IDs (not enum ordinals)
- `SignatureVersion` — explicit `u8` envelope layout version
- `KeyId` — non-empty key identifier
- `PublicKeyEnvelope` / `SignatureEnvelope` / `HybridSignatureEnvelope` —
  deterministic versioned serialization
- `CryptoSuite` trait — `sign`, `verify`, `algorithm_id`, `algorithm_wire_id`
- `resolve_suite` — algorithm dispatch with fail-closed unknown suites
- `sign` / `verify_envelope` / `dispatch_verify` — versioned verification path
- `reject_algorithm_downgrade` — blocks classical-only when hybrid required

Envelopes use tagged SRCB-style encoding (`PublicKeyEnvelopeV1`,
`SignatureEnvelopeV1`, `HybridSignatureEnvelopeV1`) with big-endian length
prefixes. Round-trip tests prove deterministic representation.

## Migration states

```
CLASSICAL_ONLY
    → HYBRID_AVAILABLE
    → HYBRID_REQUIRED_SELECTED_ROLES
    → PQ_PRIMARY
    → LEGACY_VERIFY_ONLY
    → LEGACY_RETIRED
```

Transitions are governed by finalized height (`migration_state_at_height`) and
protocol-upgrade machinery. AI cannot flip migration state.

## Hybrid migration model by operation

| Category | Model | Notes |
| --- | --- | --- |
| A. Transaction authorization | Version-dependent | `SignatureDescriptor` carries suite + algorithm; classical remains valid until protocol upgrade |
| B. Wallet/account signing | Version-dependent | Address algorithm byte (`Ed25519V1`, `HybridV1`, `MlDsa65V1`) preserved |
| C. Validator signing | Activation-height-dependent | Hybrid required for selected roles at `HYBRID_REQUIRED_SELECTED_ROLES` |
| D. Consensus message signing | Activation-height-dependent | `CLASSICAL_AND_PQ` with `REQUIRE_ALL` for security-critical paths |
| E. Node identity | Classical OR PQC | Independent of consensus tx format |
| F. Peer/session security | Classical OR PQC | Future P2P layer |
| G. Block signing | Activation-height-dependent | Bound to validator suite policy |
| H. Hashing | Version-dependent | SHA-256 domain separation unchanged |
| I. Merkle/state commitments | Version-dependent | Leaf encoding unchanged |
| J. Encryption | Classical OR PQC | Off-chain envelopes in `packages/security` |
| K. Interop signing | Version-dependent | Foreign verifier separate from SunRey suite |
| L. Test-only | Classical OR PQC | Dev fixtures only |

Hybrid combiner: **`CLASSICAL_AND_PQ`**. Verification policy **`REQUIRE_ALL`**
is AND, not OR. See [hybrid-signature-protocol.md](./hybrid-signature-protocol.md).

## Consensus-critical cryptography (do not modify casually)

Changing bytes in these structures affects chain compatibility:

| Structure | Algorithm | Impact |
| --- | --- | --- |
| `UnsignedTransaction::encode()` | None (encoding) | Transaction hash, signature payload |
| `transaction_id` / `DOMAIN_TX_ID` | SHA-256 | Tx ID, Merkle leaves |
| `unsigned_signature_payload` / `DOMAIN_SIG` | SHA-256 | Signature message |
| `BlockHeader::encode()` | None | Block hash, chain verification |
| `genesis_hash` / `DOMAIN_GENESIS` | SHA-256 | Genesis identity |
| `state_root` / `DOMAIN_STATE_ROOT` | SHA-256 | App hash, persisted state |
| `transaction_root` | SHA-256 | Block tx root |
| `SignatureDescriptor` (5 fields) | Ed25519 today | Tx authorization, persisted txs |
| `Proposal` / `Vote` signatures | Ed25519 today | Consensus votes, finality |
| `ValidatorSet` hash (`DOMAIN_VALSET`) | SHA-256 | Validator identity in consensus |
| Wallet address payload | SHA-256 + algorithm byte | Address derivation |
| `crypto_policy_hash` in block header | SHA-256 | Policy binding |

## Backwards compatibility

- Existing Ed25519 signatures remain verifiable via `suite_by_id` compatibility
  wrapper.
- Protocol vectors (`66a121af…` tx ID) unchanged.
- PQ/hybrid suite IDs return `UnknownSuite` (or `PqNotEnabled` with
  `experimental-pqc`) — never downgrade to Ed25519.
- Address derivation for `Ed25519V1` unchanged.

## PQC Rust library assessment

| Library | ML-DSA | ML-KEM | SLH-DSA | Rust 1.83 | License | Maintenance | Decision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `pqcrypto` / `pqcrypto-mldsa` | Yes | Yes | Yes | Yes | MIT/Apache-2.0 | PQClean wrappers, active | **Candidate** for Prompt 8 wiring |
| `aws-lc-rs` FIPS modules | Partial | Partial | No | Yes | Apache-2.0 | AWS maintained | Evaluate for production HSM path |
| `oqs` (liboqs bindings) | Yes | Yes | Yes | Build complexity | MIT | Open Quantum Safe | Deferred — CI portability concerns |

**Decision for this prompt:** Implement abstraction only. No Rust PQC dependency
added. TypeScript continues to use `@noble/post-quantum@0.5.4` for testnet.
Rust PQ verification remains disabled until an approved provider is wired with
official test vectors.

## Production activation requirements

1. Counsel-reviewed protocol upgrade specifying activation heights
2. Rust PQC provider selected and pinned with known-answer tests
3. Cross-language vector agreement (TypeScript ↔ Rust)
4. Validator key ceremony with hybrid keys for required roles
5. `experimental-pqc` must not be enabled in production builds
6. No change to `ENVIRONMENT` or `LIVE_*` flags from this work

## Key rotation expectations

- Validator consensus keys: epoch-boundary rotation per Chunk 36 lifecycle
- Transaction keys: wallet-controlled; new keys may use new algorithm envelopes
- Historical verification: `historical_verify_allowed` retains classical suites

## Prohibited practices

- Silently mapping unknown suites to Ed25519
- Custom implementations of ML-KEM, ML-DSA, or SLH-DSA
- Changing hash domains without protocol upgrade
- Using floating-point in cryptographic code paths
- Storing balances or breaking ledger invariants
- Claiming post-quantum security because abstraction exists

## Feature control

```toml
# crates/crypto/Cargo.toml
[features]
default = []
experimental-pqc = []  # registration only; does not enable PQ verify
```

## Related documents

- [cryptographic-inventory.md](./cryptographic-inventory.md)
- [hybrid-signature-protocol.md](./hybrid-signature-protocol.md)
- [pqc-library-selection.md](./pqc-library-selection.md)
- [chunk-60-post-quantum-integration.md](./chunk-60-post-quantum-integration.md)
- [pqc-testnet-migration.md](./pqc-testnet-migration.md)

## Handoff to Prompt 8

- Wire `pqcrypto` or approved provider behind `SignatureVersion::PqNativeV1`
- Implement hybrid verify with cross-language test vectors
- Height-gated consensus verification using `migration` module
- Wallet address generation for `HybridV1` / `MlDsa65V1`
- Benchmark suite and production readiness gate
