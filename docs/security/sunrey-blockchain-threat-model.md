# SunRey Blockchain threat model (Chunk 33R)

Owner: `packages/security` with chain consumers in
`packages/sunrey-chain`. Engineering record only. Not a certification,
penetration-test report, or counsel review. The system is **not**
claimed quantum-proof.

Simulation `ENVIRONMENT` remains `simulation`. Every `LIVE_*` flag
remains `false`.

## Scope

In scope: cryptographic agility, algorithm identifiers, suite
lifecycle, hybrid verification policy, key-purpose separation,
downgrade-resistant bindings, and private-key isolation.

Out of scope: a production node, consensus, P2P mesh, mainnet,
MoonRey issuance, and live custody.

## Threats, controls, residual risk

| Threat | Controls in this chunk | Residual risk |
| --- | --- | --- |
| Stolen user keys | Typed `WALLET_SIGNING` / `TRANSACTION_SIGNING` purposes; private keys are `PrivateKeyMaterial`; leakage guards | Compromise of an endpoint still forges that user's signatures |
| Compromised validator key | Distinct consensus, proposal, P2P, governance, and recovery keys; HMAC forbidden for consensus | Chunk 36 lifecycle / HSM binding is not implemented |
| Validator cartel | Architecture only (ADR-0017/0018); no consensus runtime here | Cartel risk is unmitigated until a node exists |
| Malicious peer | `P2P_IDENTITY` purpose and suite binding; unknown algorithm IDs fail closed | P2P stack is not implemented (Chunk 35 stopped) |
| Eclipse attack | Recorded; networking ADR exists | No eclipse-resistance implementation |
| DDoS | Recorded; not a crypto-control | No rate-limit / networking implementation |
| Compromised RPC | Simulation only; no public RPC | A future RPC must not hold validator private keys |
| Oracle manipulation | `ORACLE_SIGNING` purpose + binding (network, domain, suite) | Oracle runtime is not implemented |
| Malicious operator | Operator identity is separate from voting / proposal keys | No operator ceremony yet |
| CI/CD compromise | Secret scan, simulation keys, no production secrets in git | A compromised CI runner can still alter this tree |
| Dependency supply-chain compromise | No new PQC TCB; classical path is `node:crypto` | `node:crypto` and npm remain trusted |
| Malicious upgrade | Suite lifecycle is immutable after registry construction; AI cannot flip policy | Protocol-upgrade machinery is later |
| Bridge compromise | `INTEROPERABILITY_SIGNING` purpose reserved | No bridge is implemented |
| Custody compromise | Custody remains simulation envelopes; no live provider | Simulation custody is not a vault |
| Cryptographic downgrade | Policy `REQUIRE_HYBRID` / `DOWNGRADE_REJECTED`; bindings include suite and algorithm IDs | Misconfigured migration state could still allow classical-only |
| Algorithm confusion | Explicit algorithm IDs; providers refuse mismatch; no silent fallback | Operator error registering a wrong suite remains possible |
| Signature replay | Binding includes network, chain, protocol, schema, domain, payload hash | Application must not omit the binding |
| Cross-protocol reuse | `messageDomain` and `keyPurpose` are signed | Callers must use distinct domains |
| Harvest-now-decrypt-later | Inventory flags AES envelopes; ML-KEM suite is DRAFT | Stored envelopes remain classically confidential |
| Future quantum attack | Hybrid envelope + migration states; no quantum-proof claim | Classical Ed25519 is forgeable by a future CRQC |
| PQ implementation defects | Production PQ not selected; simulation provider cannot be treated as ML-DSA | A later PQ library may be defective; fail-closed IDs reduce premature use |

## Trust boundaries

```text
Protocol / business code
    → descriptors (public keys, signatures, suite IDs)
    → CryptoPolicy (deterministic; no AI mutation)
    → CryptoSuiteRegistry (immutable)
    → SignatureProvider / KemProvider
    → node:crypto Ed25519 | simulation PQ test double
```

Private key material must not appear in logs, events, evidence
payloads, transaction objects, public APIs, ordinary database
metadata, or error messages.

## Residual statement

This threat model makes the chain *agile*. It does not make the
chain *safe against a cryptographically relevant quantum computer*,
and it does not replace node, consensus, or operational security
work in later chunks.
