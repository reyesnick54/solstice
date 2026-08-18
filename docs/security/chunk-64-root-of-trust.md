# Chunk 64 — SunRey root-of-trust and key ceremony architecture

This chunk implements production-class ceremony architecture and
simulation/rehearsal tooling at `packages/security`.

It does **not** create real production private keys in CI. It does
**not** claim that a commercial HSM, certification, or production
ceremony has already been completed.

Capability `sunrey-root-of-trust` is `IMPLEMENTED` on
`packages/security`. `evaluateChunkRequirements` returns
`mustStop: false`.

Do not create `packages/ceremony`, `packages/hsm-v2`,
`packages/root-of-trust`, or `packages/key-ceremony`.

## What is implemented

- cryptographic authority registry (`RootOfTrustAuthority`)
- machine-readable `KeyPurposeMatrix`
- versioned `CeremonyPlan` and participant roles
- extended HSM provider contract (non-exportable)
- HSM capability verification and PQ readiness categories
- public-key contribution workflow
- provider-neutral `HsmAttestationRecord`
- multi-person approvals and dual control
- append-only `CeremonyTranscript`
- signed/hash-verified offline package format
- genesis, governance, release, validator, and recovery preparation
- key rotation, backup references, compromise, and retirement states
- local ceremony simulator labeled `SIMULATION`
- `sunrey-ceremony` CLI and full seven-validator rehearsal
- Chunk 85 extends `sunrey-ceremony production *` for the production
  genesis ceremony architecture. Real production ceremony evidence
  remains EXTERNAL/HUMAN until performed. See
  [`docs/mainnet/chunk-85-production-genesis-ceremony.md`](../mainnet/chunk-85-production-genesis-ceremony.md).

## Authority classes

| Authority | Canonical `KeyPurpose` |
| --- | --- |
| `GENESIS_AUTHORITY` | `GENESIS_SIGNING` |
| `PROTOCOL_GOVERNANCE_AUTHORITY` | `GOVERNANCE_SIGNING` |
| `SECURITY_GOVERNANCE_AUTHORITY` | `GOVERNANCE_SIGNING` |
| `RELEASE_AUTHORITY` | `RELEASE_SIGNING` (Chunk 59 artifact signing only) |
| `VALIDATOR_CONSENSUS_AUTHORITY` | `VALIDATOR_CONSENSUS_SIGNING` |
| `VALIDATOR_GOVERNANCE_AUTHORITY` | `GOVERNANCE_SIGNING` |
| `VALIDATOR_P2P_IDENTITY` | `P2P_IDENTITY` |
| `RECOVERY_AUTHORITY` | `RECOVERY_SIGNING` |
| `CUSTODY_SIGNING_AUTHORITY` | `WALLET_SIGNING` |
| `ORACLE_SIGNING_AUTHORITY` | `ORACLE_SIGNING` |

A key authorized for one high-risk role does not authorize another.
Release signing does not vote in consensus. Consensus keys do not sign
custody withdrawals. Governance keys do not sign customer wallet
transfers. Recovery cannot become protocol governance. AI cannot
possess a human governance authorization role.

## PQC hardware treatment

Chunk 60 provides standardized PQC software for development/testnet.
External HSM PQC capability is recorded as
`HARDWARE_PROVIDER_UNCONFIRMED` unless actual provider evidence exists.
Software capability is `SOFTWARE_PROVIDER_AVAILABLE`.

## Related

- [key-purpose-matrix.md](./key-purpose-matrix.md)
- [hsm-provider-requirements.md](./hsm-provider-requirements.md)
- [key-ceremony-protocol.md](./key-ceremony-protocol.md)
- [genesis-signing-ceremony.md](./genesis-signing-ceremony.md)
- [../runbooks/root-key-compromise.md](../runbooks/root-key-compromise.md)
- [../runbooks/key-rotation-ceremony.md](../runbooks/key-rotation-ceremony.md)
- [../runbooks/ceremony-verification.md](../runbooks/ceremony-verification.md)
