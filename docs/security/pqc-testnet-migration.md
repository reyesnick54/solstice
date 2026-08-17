# Hybrid testnet migration

Network: `net_sunrey_testnet_1` / `chn_sunrey_testnet_1`.
Not mainnet.

## Height-activated policy

Every validator derives the same `CryptoPolicy` from finalized height.
Local configuration cannot invent a weaker policy.

| Height | State | New signatures |
| --- | --- | --- |
| `< 20` | `CLASSICAL_ONLY` | Ed25519 |
| `>= 20` | `HYBRID_AVAILABLE` | Ed25519, hybrid, or ML-DSA-65 |
| `>= 40` | `HYBRID_REQUIRED_SELECTED_ROLES` | hybrid required for validator consensus, oracle, and governance |
| `>= 60` | `PQ_PRIMARY` | PQ-primary for the selected testnet role (`VALIDATOR_CONSENSUS_SIGNING`) |

Classical verification is **not** irreversibly retired in this chunk
(`retireClassicalVerification: false`). Historical signatures remain
verifiable.

## Mixed-key validator set

During `HYBRID_AVAILABLE`, classical and hybrid validators may coexist.
During `HYBRID_REQUIRED_SELECTED_ROLES`, consensus/oracle/governance
new signatures must be hybrid. Remaining validators migrate before
they can produce new consensus signatures. Commit certificates verify
under the current derived policy.

## Rehearsal

`packages/sunrey-chain/src/pqc/hybrid-rehearsal.ts` runs a
seven-validator simulation: register PQ public keys, schedule
migration, rotate selected validators, require hybrid, continue
finality, migrate remaining validators, verify certificates, retain
legacy history.

Wallet, oracle, and governance identities migrate through the same
states. AI cannot vote.
