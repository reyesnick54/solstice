# Key purpose matrix

Machine-readable source: `KEY_PURPOSE_MATRIX` in
`packages/security/src/ceremony/authorities.ts`.

Each row records purpose, allowed authority, allowed CryptoSuites,
provider requirements, rotation/backup/recovery policy, online/offline
classification, attestation requirement, and production eligibility.

Production eligibility in this repository is `SIMULATION_ONLY`.
Unknown corridors and unverified hardware claims remain
`RESEARCH_REQUIRED` and disabled.

| Purpose | Authority | Suites | Online/offline | Attestation | Eligibility |
| --- | --- | --- | --- | --- | --- |
| `GENESIS_SIGNING` | `GENESIS_AUTHORITY` | Ed25519 | OFFLINE | required | SIMULATION_ONLY |
| `GOVERNANCE_SIGNING` | `PROTOCOL_GOVERNANCE_AUTHORITY` | Ed25519 / software PQ | OFFLINE | required | SIMULATION_ONLY |
| `GOVERNANCE_SIGNING` | `SECURITY_GOVERNANCE_AUTHORITY` | Ed25519 / software PQ | OFFLINE | required | SIMULATION_ONLY |
| `RELEASE_SIGNING` | `RELEASE_AUTHORITY` | Ed25519 | CEREMONY_ONLY | required | SIMULATION_ONLY |
| `VALIDATOR_CONSENSUS_SIGNING` | `VALIDATOR_CONSENSUS_AUTHORITY` | Ed25519 | ONLINE | required | SIMULATION_ONLY |
| `GOVERNANCE_SIGNING` | `VALIDATOR_GOVERNANCE_AUTHORITY` | Ed25519 / software PQ | OFFLINE | required | SIMULATION_ONLY |
| `P2P_IDENTITY` | `VALIDATOR_P2P_IDENTITY` | Ed25519 | ONLINE | required | SIMULATION_ONLY |
| `RECOVERY_SIGNING` | `RECOVERY_AUTHORITY` | Ed25519 | OFFLINE | required | SIMULATION_ONLY |
| `WALLET_SIGNING` | `CUSTODY_SIGNING_AUTHORITY` | Ed25519 / software PQ | ONLINE | required | SIMULATION_ONLY |
| `ORACLE_SIGNING` | `ORACLE_SIGNING_AUTHORITY` | Ed25519 | ONLINE | required | SIMULATION_ONLY |
| `BACKUP_ENCRYPTION` | wrap-only | AES-256-GCM | OFFLINE | required | SIMULATION_ONLY |

`BACKUP_ENCRYPTION` is the existing application purpose used when the
repository records encrypted backup *references*. Plaintext key bytes
are never stored.

Rotation policy: planned dual-control rotation; historical signatures
remain verifiable. Backup policy: provider backup-reference metadata
only. Recovery policy: replacement ceremony; recovery cannot become
protocol governance.
