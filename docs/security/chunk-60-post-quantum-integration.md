# Chunk 60 — Standardized PQC in SunRey CryptoSuite (testnet)

SunRey CryptoSuite uses a real standardized post-quantum provider in
development/testnet. Hybrid classical-and-PQ signatures are enforced
through finalized protocol policy. Wallet, validator, oracle, and
governance keys can rotate through a controlled migration. Historical
verification is retained. Downgrade and provider failure fail closed.

This is **not** mainnet activation and **not** a quantum-proof claim.

## Provider

`@noble/post-quantum@0.5.4` behind `CryptoSuite` / `SignatureProvider` /
`KemProvider`. See [pqc-provider-selection.md](./pqc-provider-selection.md).

## Suites

| Suite ID | Algorithms | Lifecycle |
| --- | --- | --- |
| `sunrey-ed25519-v1` | Ed25519 | existing classical |
| `sunrey-hybrid-ed25519-mldsa-v1` | Ed25519 + ML-DSA-65 | `TESTNET_APPROVED` |
| `sunrey-mldsa-65-v1` | ML-DSA-65 | `TESTNET_APPROVED` |
| `sunrey-mlkem-768-v1` | ML-KEM-768 | `TESTNET_APPROVED` (KEM only) |
| `sunrey-slhdsa-sha2-128s-v1` | SLH-DSA-SHA2-128s | `TESTNET_APPROVED` (diversification) |
| `sunrey-hybrid-ed25519-mldsa-sim-v1` | simulation HMAC PQ | `TEST_ONLY` (retained) |

## Known-answer tests

Official/provider vectors in `packages/security/src/pq-official-vectors.json`
(public material only). Source: noble 0.5.4 deterministic keygen,
`extraEntropy: false`.

## CLI

`sunrey-ops crypto suites|policy|inventory|readiness|benchmark`

## Related

- [hybrid-signature-protocol.md](./hybrid-signature-protocol.md)
- [pqc-testnet-migration.md](./pqc-testnet-migration.md)
- [pqc-performance.md](./pqc-performance.md)
- [../runbooks/pqc-key-rotation.md](../runbooks/pqc-key-rotation.md)
- [../runbooks/pqc-provider-failure.md](../runbooks/pqc-provider-failure.md)
- ADR-0025
