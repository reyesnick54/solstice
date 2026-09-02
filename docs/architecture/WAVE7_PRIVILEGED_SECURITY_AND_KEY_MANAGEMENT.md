# Wave 7 — Privileged Security and Key Management

**Status:** Simulation / engineering hardening  
**Owner:** `packages/security/src/productization`  
**Does not activate production.** No `LIVE_*` flag may be flipped by this work.

## Objective

Ensure compromise of:

- admin account
- API credential
- application server
- provider credential
- ordinary service identity

does **not** automatically mean compromise of:

- validator keys
- monetary governance
- canonical supply
- user custody
- evidence integrity

## Privileged operation matrix

The canonical catalog lives at `packages/security/src/productization/privileged-matrix.ts`.

| Category | Example operations | Approval model |
|----------|-------------------|----------------|
| PROVIDER | enable, disable, configure | Dual control |
| POLICY | activate, retire | Dual control |
| RIGHTS | commit, revoke | Single / dual |
| IDENTITY | suspend, recovery override | Single / dual |
| ADMIN_ROLE | grant, revoke | Dual control |
| FEATURE_FLAG | runtime toggle | **NOT PERMITTED** |
| VALIDATOR | set change, key rotate | Governance / ceremony |
| KEY_ACCESS | access high-value handle | Ceremony only |
| TRANSACTION_SIGNING | user / validator | Role-bound |
| GOVERNANCE | approve, activate package | Multi-party |
| MAINNET | activate | Ceremony only |
| ISSUANCE | SunRey / MoonRey activate | Multi-party governance |
| MONETARY | parameter change | Multi-party governance |

Every operation records `privileged.*` audit events. No operation sets `bypassesMonetaryControl: true`.

## Key classification

Eight explicit roles in `key-classification.ts`:

| Role | Purpose | HSM required | Must not reuse |
|------|---------|--------------|----------------|
| `USER_WALLET_KEY` | `WALLET_SIGNING` | Yes | Validator, governance, service, API, admin |
| `VALIDATOR_KEY` | Consensus, proposal, P2P | Yes | Wallet, governance, service, API, admin |
| `GOVERNANCE_SIGNING_KEY` | Governance, genesis, release | Yes | Wallet, validator, service, API, admin |
| `SERVICE_KEY` | Service auth, webhooks | No | Wallet, validator, governance, admin |
| `API_CREDENTIAL` | Session signing | No | Wallet, validator, governance, admin |
| `DATABASE_CREDENTIAL` | DB connection | No | All signing roles |
| `ENCRYPTION_KEY` | Data / backup encryption | No | All signing roles |
| `ADMIN_AUTHENTICATION_CREDENTIAL` | Admin signing | No | Wallet, validator, governance, service, API |

Roles map to existing `KeyPurpose` and `SecretClass` values. Cross-role reuse is refused at enforcement time.

## Key storage

Forbidden surfaces (`key-storage.ts`):

- Source code / git repository
- Application logs
- Ordinary database rows
- Public API containers
- Explorer / consumer BFF
- Plaintext environment variables

Validator keys must not appear on `PUBLIC_API_CONTAINER` or `CONSUMER_BFF`. Configuration holds `secret://` references only.

## HSM / KMS boundary

| Posture field | Value |
|---------------|-------|
| Status | `INTERFACE_READY_NOT_PRODUCTION_CONNECTED` |
| Interface ready | `true` |
| Production connected | `false` |
| `PRODUCTION_HSM_KMS_CONFIGURED` | `false` |
| Private key in application memory | Never for high-value keys |

Application code calls `requestRemoteSignature()`. The HSM/KMS port (`hsm-kms.ts`) has no export-private method. Production signing fails closed via `requireProductionSigningProvider()`.

## Multi-party governance signing

`governance-signing.ts` supports:

- Multiple authorized human governance approvals
- Configurable threshold requirements (`DEFAULT_GOVERNANCE_THRESHOLDS`)
- Separation of duties (distinct approvers)
- Approval expiry (`approvalTtlSeconds`)
- Proposal hashes (`computeProposalHash`)
- Policy version binding

Services, agents, and AI cannot approve governance (`assertServiceCannotGovern`).

Actual thresholds remain governed configuration. This module does not invent multisig economics.

## Break-glass

Break-glass (`privileged.ts` + `break-glass-monetary.ts`):

- Named human only; no shared accounts
- Recorded reason (minimum 8 characters)
- Time-bounded lease
- Highly audited open/close events

Break-glass **cannot** bypass:

- Mint / issuance activation
- Ledger posting / Execution Authority
- Validator consensus override
- Supply invariants
- Single-env mainnet activation
- Monetary parameter direct write
- Custody key export
- Governance approve / activate

## Secret rotation

`rotation.ts` supports overlapping verification for:

- API credentials
- Service credentials
- Database credentials
- Encryption keys
- Validator keys (ceremony-required)
- Governance keys (ceremony-required)

Rotation does not destroy historical verification. Emergency revocation invalidates active use while preserving encrypted data and validator state.

## Administrative approval flows

`admin-approvals.ts` evaluates single-admin vs multi-party requirements per operation. Sensitive non-monetary operations:

- `provider.configure`
- `provider.disable`
- `policy.activate`
- `identity.recovery_override`
- `circuit_breaker.release`
- `feature_flag.staged_activation`

Business thresholds are configuration-driven, not hard-coded policy invention.

## Immutable admin audit

Every privileged operation creates a `PrivilegedAuditEvent` (`admin-audit.ts`) containing:

- who, what, when
- resource
- policy decision
- authorization
- previous state reference
- new state reference
- reason / reference
- event hash

Secrets are redacted before sealing. `assertAuditContainsNoSecrets` guards audit payloads.

## Mainnet activation ceremony (design only)

`mainnet-ceremony-design.ts` evaluates eleven prerequisites:

1. Approved genesis
2. Validator set
3. Governance configuration
4. Production keys
5. Backups
6. Monitoring
7. Security audit
8. Regulatory feature gates
9. Economics approval
10. SunRey activation decision
11. MoonRey activation decision

No single environment variable may activate all production monetary systems (`refuseSingleEnvMainnetActivation`). The ceremony is **not executed** in simulation.

## Enforcement facade

`privileged-enforcement.ts` is the central entry point:

- `enforcePrivilegedOperation` — role, step-up, break-glass, approval checks
- `enforceAdminCannotMint` — ordinary admin cannot authorize issuance
- `enforceValidatorKeyNotUserKey` — key type crossing refused
- `enforceRevokedServiceCredential` — revoked credentials cannot sign

## Tests

`tests/wave-7-prompt-28-privileged-security.test.ts` covers:

- Key role separation
- Privileged matrix completeness
- Storage audit and redaction
- HSM/KMS interface-ready posture
- Governance threshold and expiry
- Break-glass monetary boundary
- Admin audit without secrets
- Mainnet ceremony prerequisite blocking
- Admin mint refusal, service governance refusal, wrong key type, revoked credential

## Related owners

| Component | Owner |
|-----------|-------|
| Execution Authority | `packages/permissions` |
| Staff SoD | `packages/identity/src/staff` |
| Governance ops | `packages/sunrey-chain/src/governance-ops` |
| Production activation firewall | `packages/sunrey-chain/src/economics/production-activation` |
| Evidence Vault | `packages/evidence` |
| HSM/KMS port | `packages/security/src/hsm-kms.ts` |
