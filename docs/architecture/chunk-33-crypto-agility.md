# Chunk 33R — SunRey crypto-agility and post-quantum foundation

Implemented after Chunk 31 froze production architecture on `main`
and the prior Chunk 33 documentation-only gate was recorded.

The historical stop is [`chunk-33-stop.md`](./chunk-33-stop.md).
This file is the implementation record. It is not a second
documentation-only gate.

Owners:

- `packages/security` — canonical cryptographic control plane
- `packages/sunrey-chain` — validator key-separation contract and
  suite-aware chain signing helpers

Do not create `packages/quantum-security`, `packages/crypto-v2`,
`packages/pqc-core`, `packages/crypto-agility`,
`packages/blockchain-crypto`, or `packages/security-v2`.

This is **not** a quantum-proof, quantum-secure, or
production-certified claim. `ENVIRONMENT` remains `simulation`.
Every `LIVE_*` flag remains `false`.

## What is implemented

- Versioned `CryptoSuiteRegistry` with suite ID, algorithms, purposes,
  lifecycle, environments, protocol version, optional
  activation/deprecation epoch and height, verification grace, and
  provider ID.
- Lifecycle states: `DRAFT`, `TEST_ONLY`,
  `APPROVED_FOR_SIMULATION`, `ACTIVATION_SCHEDULED`, `ACTIVE`,
  `DEPRECATED`, `VERIFY_ONLY`, `RETIRED`, `BLOCKED`.
  The registry is immutable. AI cannot alter lifecycle.
- Explicit algorithm IDs on keys, signatures, hashes, and KEM
  objects. Unknown IDs fail closed. No silent provider fallback.
- Classical signatures: **Ed25519** (RFC 8032) via `node:crypto`.
  Canonical ID `Ed25519`. Not secp256k1. Not HMAC.
- HMAC-SHA256 remains Execution Authority / application
  infrastructure and cannot sign validator public-key purposes.
- PQ provider ports for ML-KEM, ML-DSA, and SLH-DSA families.
  Production provider: **not selected**. Simulation/test provider
  is labeled as not those algorithms.
- Hybrid envelope `CLASSICAL_AND_PQ` with structured descriptors
  and policies `REQUIRE_ALL`, `REQUIRE_CLASSICAL`, `REQUIRE_PQ`,
  `VERIFY_LEGACY_ONLY`. No OR semantics.
- Extended key purposes, including transaction, validator,
  proposal, P2P, oracle, governance, attestation, evidence,
  wallet, interoperability, and backup encryption. Existing
  application purposes are preserved.
- Canonical descriptors: `KeyId`, `KeyVersion`, `AlgorithmId`,
  `CryptoSuiteId`, `KeyPurpose`, `PublicKeyDescriptor`,
  `SignatureDescriptor`, `HybridSignatureDescriptor`,
  `KeyLifecycleState`.
- Private-key isolation guards and tests.
- Deterministic `CryptoPolicy` evaluator (`ALLOW`, `VERIFY_ONLY`,
  `REQUIRE_HYBRID`, `REJECT`) with stable reason codes.
- Downgrade-resistant signed bindings (network, chain, protocol,
  schema, algorithm/suite, purpose, domain, payload hash).
- Cryptographic inventory (markdown + JSON).
- Threat model.
- Migration states without production dates.
- Benchmark harness that records measurements from the host.
  Results: [`docs/security/benchmark-results.md`](../security/benchmark-results.md).
- Validator key-separation contract for Chunk 36.
- RFC 8032 test vectors for Ed25519.

## What remains provider-only / later

- Production ML-DSA / ML-KEM / SLH-DSA library
- Protocol-upgrade machinery that transitions migration states
- Validator lifecycle (Chunk 36)
- Node, consensus, P2P, and transaction codec (Chunks 32R/34/35)
- Passkeys / WebAuthn
- Any quantum-proof or certification claim

## Exact CI

Local `npm run ci` on this branch: **ok**.

```
architectural invariants: ok
extraction dry-run: ok (32 package(s))
architectural-linter: ok
deployment posture: ok (simulation-only, live flags off)
kernel gating: passed (71 registered paths, all Kernel-authorized)
tests: 526 pass, 0 fail
demo: ok
typecheck: ok
secret scan: ok
CI pipeline: ok
```

`ENVIRONMENT` remains `simulation`. Every `LIVE_*` flag remains
`false`.

## Claims that are not made

- The system is not quantum-proof.
- The simulation PQ provider is not ML-DSA, ML-KEM, or SLH-DSA.
- Simulation Ed25519 is not a production key-ceremony.
