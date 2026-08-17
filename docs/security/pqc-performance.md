# PQC performance (measured, no marketing)

Host timings vary. These are engineering measurements, not SLAs.

## Fixed sizes (FIPS / V1 raw NIST bytes)

| Algorithm | Public key | Secret key (if measurable) | Signature / ciphertext |
| --- | --- | --- | --- |
| Ed25519 | 32 | 32 seed | 64 |
| ML-DSA-65 | 1952 | 4032 | 3309 |
| ML-KEM-768 | 1184 | 2400 | 1088 ct |
| SLH-DSA-SHA2-128s | 32 | 64 | 7856 |

Hybrid envelope = classical component + PQ component + `srhyb1` framing.
Vote / commit-certificate / block impact scale with signature encoding
size. See `CONSENSUS_SIZE_AUDIT` in
`packages/sunrey-chain/src/pqc/consensus-bounds.ts`.

## Bounds

- Remote signer signature: 16384 bytes, no truncation
- P2P PQ message: 1048576 bytes (existing frame cap)
- Max tx: 16384 bytes (hybrid ML-DSA fits; SLH-DSA is not default consensus)
- Rust node votes remain 64-byte Ed25519 and fail-close unknown suites

## Batch verification

`@noble/post-quantum` 0.5.4 has no established batch-verify API.
Custom cryptographic batching is forbidden. Sequential verify is used.

## How to measure

```
sunrey-ops crypto benchmark
```

Degradation versus Ed25519 is expected and must not be hidden.
