# PQC provider selection (Chunk 60)

Status: **SELECTED_FOR_DEVELOPMENT_AND_TESTNET**.
Production status: **NOT_SELECTED_FOR_PRODUCTION**.

This is an engineering record of a standardized post-quantum
algorithm implementation for development and testnet. It is not a
quantum-proof, unbreakable, or fully quantum-secure claim. Legal
confidence remains `RESEARCH_REQUIRED`.

## Decision

TypeScript / testnet CryptoSuite path uses **`@noble/post-quantum@0.5.4`**
(MIT), pinned in `package-lock.json`, behind `SignatureProvider` and
`KemProvider`. Application modules do not import the library.

The Rust local node does **not** silently map hybrid/PQ suite IDs to
Ed25519. Unknown standardized PQ suites fail closed. RustCrypto crates
were evaluated and not selected for this chunk so the TypeScript
testnet path remains the single TCB for official KATs.

## Evaluation criteria

| Criterion | `@noble/post-quantum` 0.5.4 | liboqs / liboqs-js | future `node:crypto` | RustCrypto ml-dsa / ml-kem / slh-dsa |
| --- | --- | --- | --- | --- |
| Standards | FIPS 203/204/205 | FIPS 203/204/205 | not shipped in Node 22 | FIPS 203/204/205 |
| Maintenance | active noble ecosystem | reference, native | n/a | active |
| Maturity | used in JS ecosystems | C reference | n/a | Rust ecosystem |
| Memory safety | TypeScript/JS | native C risk | runtime | Rust |
| License | MIT | mix; bindings vary | runtime | Apache/MIT |
| Cross-platform CI | portable | not portable here | portable if shipped | portable if MSRV allows |
| Test vectors | official/provider KATs | official | n/a | official |
| Supply-chain | npm pin + SBOM | native toolchain | none | cargo pin |
| HSM interoperability | none claimed | none claimed | none | none |
| Selected | **yes, testnet** | no | no | no, this chunk |

The library was not chosen because it has the shortest API.

## Parameter sets

| Algorithm ID | Family | Parameter set | Encoding | Role |
| --- | --- | --- | --- | --- |
| `ML_DSA_65_V1` | ML-DSA | ML-DSA-65 | raw NIST bytes v1 | default testnet PQ signature |
| `ML_KEM_768_V1` | ML-KEM | ML-KEM-768 | raw NIST bytes v1 | KEM only; never a signature |
| `SLH_DSA_SHA2_128S_V1` | SLH-DSA | SLH-DSA-SHA2-128s | raw NIST bytes v1 | diversification; not default consensus |

## Lifecycle

Suites begin at `TESTNET_APPROVED` (simulation/test ALLOW, production
REJECT). No mainnet activation. No `CONFIRMED_BY_COUNSEL`.

## Honest limitations

- JS/`@noble/post-quantum` does **not** guarantee secure zeroization.
- No established batch-verification API; sequential verify only.
- Not an external HSM. `REAL_PQ_SUPPORTED` is local/test only.
- Production / certification / counsel approval remains pending.

Machine-readable copy: `packages/security/src/pqc-library-selection.ts`.
