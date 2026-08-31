# SunRey blockchain cryptography

This document describes SunRey's blockchain signing architecture after
Wave 3 Prompt 8. It extends Chunk 33R algorithm agility and Chunk 36R
validator key separation. This is **not** an independent security
certification.

Owners:

- `packages/security` — canonical cryptographic control plane
- `packages/sunrey-chain` — validator signing, envelopes, lifecycle

`ENVIRONMENT` remains `simulation`. Every `LIVE_*` flag remains `false`.

## Validator signing model

### Flow

1. **Validator initialization** — `ValidatorRecord` holds public descriptors
   only. Private keys never appear on the record.
2. **Identity** — `validatorId` binds signing to a registered validator.
   Consensus authorization uses `VALIDATOR_CONSENSUS_SIGNING` purpose.
3. **Key loading** — `ValidatorKeyLifecycleManager` resolves ACTIVE keys.
   PENDING, RETIRED, and REVOKED keys fail closed for signing.
4. **Vote/proposal creation** — `ConsensusSignRequest` carries network,
   chain, height, round, block ID, validator set version, and suite ID.
5. **Message serialization** — `encodeConsensusSignBytes` length-prefixes
   domain, network, chain, protocol version, message type, height, round,
   block ID, validator ID, set version, and suite ID.
6. **Signing** — `ValidatorSigningService` delegates to
   `createDevelopmentValidatorSigner` (simulation) or future HSM/KMS ports.
   `DurableSignerSafety` persists state before signing to prevent
   equivocation.
7. **Propagation** — `ValidatorSignedEnvelope` carries signer identity,
   `keyId`, `keyVersion`, `algorithmId`, `suiteId`, `signatureVersion`,
   domain, replay fields, and `signatureHex`.
8. **Verification** — `verifyConsensusBytes` verifies via the security
   provider catalog. Hybrid mode requires both classical and PQ components.
9. **Consensus handling** — Conflicting signatures at the same height/round/
   step produce equivocation evidence via `buildEquivocationEvidence`.

### Private-key access points

| Location | Access model |
|----------|--------------|
| `packages/security/src/blockchain-key-provider.ts` | Provider port; production fails closed |
| `packages/sunrey-chain/src/validators/pq-signer.ts` | Development seed → provider signRaw |
| `packages/sunrey-chain/src/validators/signer.ts` | `LocalDevelopmentSigner` delegate |
| `packages/security/src/hsm-kms.ts` | HSM/KMS port; non-exportable handles |
| `packages/sunrey-chain/rust/crates/crypto` | Rust Ed25519 only; PQ fail-closed |

### Public-key representation

- Classical: 32-byte Ed25519 hex
- Hybrid: `srhyb1:<classicalHex>:<pqHex>` versioned framing
- PQ-native: ML-DSA-65 public key hex via `@noble/post-quantum`

### Signature representation

- Classical: 64-byte Ed25519 hex
- Hybrid: `srhyb1:<classicalSigHex>:<pqSigHex>`
- Envelope: `ValidatorSignedEnvelope` with explicit metadata

### Validator ID derivation

`validatorId` is an explicit registry identifier (e.g. `val_dev_a`), not
derived from public key material.

## Transaction signing model

User/account transactions are signed separately from validator consensus:

| Aspect | Mechanism |
|--------|-----------|
| Canonical bytes | `unsigned_signature_payload` (Rust) / wallet `signWalletBytes` (TS) |
| Chain ID binding | Length-prefixed `networkId` + `chainId` in domain-separated hash |
| Nonce/sequence | Transaction envelope sequence field |
| Algorithm ID | `suiteId` on `WalletSignature` |
| Address derivation | Ed25519 public key → address; unchanged in this prompt |
| Domain | `SUNREY-KEY-TX-WALLET-V1` (wallet) / `SUNREY_TX_V1` (protocol hash) |

Wallet signing uses `LocalEncryptedDevelopmentSigner` in simulation.
Hardware, remote, HSM, and institutional signers are ports only.

## Domain separation

Canonical domains in `packages/security/src/signature-domains.ts`:

| Conceptual domain | Canonical string |
|-------------------|------------------|
| TRANSACTION | `sunrey.sig.transaction.v1` |
| BLOCK | `sunrey.sig.block.v1` |
| CONSENSUS_PROPOSAL | `sunrey.consensus.proposal.v1` |
| CONSENSUS_PREVOTE | `sunrey.consensus.prevote.v1` |
| CONSENSUS_PRECOMMIT | `sunrey.consensus.precommit.v1` |
| VALIDATOR_REGISTRATION | `sunrey.validator.record.v1` |
| NODE_IDENTITY | `sunrey.node.identity.v1` |
| INTEROP_MESSAGE | `sunrey.interop.message.v1` |

Bytes committed for signing use length-prefixed domain encoding via
`encodeSignatureDomainCommit`. Consensus sign-bytes additionally embed
network, chain, height, round, and validator set version.

## Replay protection

| Artifact | Replay fields |
|----------|---------------|
| Consensus vote/proposal | networkId, chainId, height, round, validatorSetVersion, domain, signerId |
| Transaction | networkId, chainId, sequence/nonce, tx domain hash |
| Validator registration | validator set version, epoch-bound activation |
| Interop message | networkId, chainId, domain, sequence |

`assertReplayProtection` rejects cross-chain, cross-domain, and
cross-height replays.

## Key lifecycle

States (from `packages/security/src/lifecycle.ts`):

- **PENDING** — generated, not yet authorized. Sign fails closed.
- **ACTIVE** — current signing key.
- **DEPRECATED** — superseded by rotation. Verify only.
- **RETIRED** — planned withdrawal. Verify fails closed.
- **REVOKED** — compromise kill. All operations fail closed.

`ValidatorKeyLifecycleManager` enforces explicit activation and auditable
rotation events. Replacement keys cannot retroactively impersonate old keys
because `keyVersion` increments and old versions become DEPRECATED.

## Rotation and revocation

Rotation flow:

1. `beginRotation` — ACTIVE → DEPRECATED; successor registered as PENDING
2. `activate` — PENDING → ACTIVE at epoch boundary (operator ceremony)
3. `revoke` — any non-terminal state → REVOKED on compromise

Operator rotation packages (`packages/sunrey-chain/src/validator-operator`)
prepare governance ceremonies. Epoch-bound activation remains a human
ceremony requirement.

## Hybrid verification

Hybrid mode uses `CLASSICAL_AND_PQ` combiner with `REQUIRE_ALL` policy.
Both classical (Ed25519) and post-quantum (ML-DSA-65) signatures must
verify. There is no fallback from hybrid to classical-only when PQ
verification fails.

Encoding: `srhyb1:<classicalHex>:<pqHex>` per
[`hybrid-signature-protocol.md`](./hybrid-signature-protocol.md).

## Secure key-provider abstraction

`BlockchainKeyProvider` (`packages/security/src/blockchain-key-provider.ts`):

| Backend | Use |
|---------|-----|
| DEVELOPMENT_SOFTWARE | Simulation only; labeled fixtures |
| ENVIRONMENT_SECRET | Secret-reference backed store (port) |
| KMS_HSM | Non-exportable HSM/KMS adapter (port) |

`createBlockchainKeyProvider` fails closed in production when
`DEVELOPMENT_SOFTWARE` is configured. Software key storage is not
equivalent to HSM/KMS custody.

## Production activation requirements

Default production state (`PRODUCTION_VALIDATOR_CRYPTO_DEFAULTS`):

- Migration state: `CLASSICAL_ONLY`
- Accepted suite for sign: `sunrey-ed25519-v1`
- Hybrid enabled: `false`
- PQ native enabled: `false`
- Development software backend: forbidden

Height-activated migration uses `migrationStateAtHeight` from finalized
chain height. Local environment variables cannot weaken policy.

Activation requires:

1. Protocol-upgrade machinery transition owner approval
2. Height-scheduled migration (`HeightActivatedCryptoSchedule`)
3. HSM/KMS provider with `REAL_PQ_SUPPORTED` capability evidence
4. External security review (see below)
5. Genesis or epoch-bound validator set update

## Node identity separation

`ValidatorRecord` requires distinct `consensusPublicKey` and
`p2pPublicKey`. Networking identity (`P2P_IDENTITY`) and consensus
authorization (`VALIDATOR_CONSENSUS_SIGNING`) are separate keys by
contract. See `nodeIdentitySeparationReport()`.

## Items requiring external security review

- Production ML-DSA / ML-KEM / SLH-DSA library selection and FIPS validation
- HSM/KMS integration and key ceremony for validator consensus keys
- Hybrid migration activation on testnet/mainnet
- Threshold/multi-party signing for validator operators
- Rust PQ/hybrid wiring in `sunrey-crypto` (currently Ed25519 only)
- Domain string unification across TS validators, Rust consensus, and legacy node
- Remote signer network transport security
- Side-channel analysis of software PQ providers

## Related documents

- [`chunk-33-crypto-agility.md`](../architecture/chunk-33-crypto-agility.md)
- [`ADR-0024`](../architecture/adr/ADR-0024-sunrey-blockchain-cryptographic-agility.md)
- [`ADR-0025`](../architecture/adr/ADR-0025-sunrey-blockchain-post-quantum-migration.md)
- [`hybrid-signature-protocol.md`](./hybrid-signature-protocol.md)
- [`sunrey-blockchain-threat-model.md`](./sunrey-blockchain-threat-model.md)
- [`key-ceremony-protocol.md`](./key-ceremony-protocol.md)
- [`benchmark-results.md`](./benchmark-results.md)
