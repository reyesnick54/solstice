# Crypto benchmark results (Chunk 33R)

Measured on the Cloud Agent host that implemented this chunk.
These are **actual harness outputs**, not estimates. They are not
production SLOs and not a certification.

Host notes: Node.js 22, `node:crypto` Ed25519, Linux. Simulation PQ
rows are **not** ML-DSA or ML-KEM performance.

| Algorithm | Provider | Operation | Iterations | Elapsed ms | Size notes |
| --- | --- | --- | --- | --- | --- |
| Ed25519 | node-crypto-ed25519 | keygen | 50 | 2.367 | public key 32 bytes |
| Ed25519 | node-crypto-ed25519 | sign | 200 | 65.568 | signature 64 bytes; includes SignedBinding encode |
| Ed25519 | node-crypto-ed25519 | verify | 200 | 18.873 | block-verification cost sample on this host |
| SIMULATION-ML-DSA-65 | simulation-pq-placeholder | sign | 200 | 3.028 | public 32 / sig 32; NOT ML-DSA |
| SIMULATION-ML-KEM-768 | simulation-pq-placeholder | encapsulate | 200 | 2.046 | ciphertext 64 bytes; NOT ML-KEM |
| SIMULATION-ML-KEM-768 | simulation-pq-placeholder | decapsulate | 200 | 2.578 | NOT ML-KEM |
| Ed25519 | node-crypto-ed25519 | transaction-size-impact | 1 | 0 | public key + signature = 96 bytes |

Harness: `packages/security/src/crypto-benchmark.ts`.
