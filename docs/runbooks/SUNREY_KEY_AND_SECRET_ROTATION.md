# SunRey Key and Secret Rotation Runbook

**Simulation posture.** Production rotation requires connected HSM/KMS (`PRODUCTION_HSM_KMS_CONFIGURED=false` today).

## Scope

This runbook covers rotation for:

| Secret / key class | Rotation policy | Historical verification |
|--------------------|-----------------|------------------------|
| API credentials | 90 days or on compromise | Overlapping window |
| Service credentials | 90 days or on compromise | Overlapping window |
| Database credentials | 60 days; app and migrator independent | Overlapping window |
| Encryption keys | Rewrap before retire | Historical envelopes decrypt until retire |
| JWT / session signing | Versioned; overlap until retire | Previous version verifies until policy retire |
| Validator keys | Ceremony; dual control | Historical signatures remain verifiable |
| Governance keys | Per governance design | Proposal hashes remain verifiable |
| Provider credentials | Provider-coordinated overlap | Webhook versions overlap |
| Administrative credentials | Short-lived session or break-glass lease | Revoke on close |

## Principles

1. **Never destroy historical verification.** Deprecated key versions verify until explicit retire after overlap window.
2. **Never store plaintext in configuration.** Use `secret://` references resolved at runtime.
3. **Never rotate all sessions at once** without explicit policy (`invalidateSessionsOnRotate: false` for session signing).
4. **Never export validator or governance private material.** Rotation is a ceremony through HSM/KMS handles.
5. **Record every rotation** in the Evidence Vault. Audit events must not contain secrets.

## API credential rotation

1. Issue new credential in secret manager (new version).
2. Deploy consuming service with new `secret://` reference.
3. Verify traffic on new credential.
4. Mark previous version `DEPRECATED`; set overlap end date (default 90 days).
5. Revoke previous version after overlap.
6. Seal `privileged.key.rotation` audit event.

## Service credential rotation

1. Issue per-service certificate identity (`issueServiceCertificateIdentity`).
2. Reject shared universal internal API keys (`rejectSharedInternalKey`).
3. Rotate with `rotateWithOverlap(keys, 'SERVICE_AUTHENTICATION', overlapUntil)`.
4. Authenticate peers with `authenticatePeer` after rotation.
5. Emergency revoke with recorded reason if compromised.

## Database credential rotation

1. Rotate migrator role independently from application role.
2. Application role must not be superuser (`assertApplicationRole`).
3. TLS required (`assertDatabaseTls`).
4. Migrator must not serve traffic (`assertMigratorCannotServeTraffic`).

## Encryption key rotation

1. Generate new DEK version in KMS/HSM.
2. Rewrap active envelopes before retiring old version.
3. Historical envelopes decrypt with their `keyVersion` until explicit retire.
4. Use `ROTATION_POLICIES.DATA_ENCRYPTION` — `corruptHistoricalEnvelopes: false`.

## Validator key rotation

1. Schedule dual-control ceremony (`VALIDATOR_CONSENSUS_SIGNING` policy).
2. Generate new handle in HSM (`SIGNER_PRIVATE` zone only).
3. Apply epoch-boundary validator set update.
4. Mark old key `DEPRECATED`; retain for historical signature verification.
5. Never place validator keys on public API containers.

## Governance key rotation

1. Follow `DEFAULT_GOVERNANCE_THRESHOLDS` for multi-party approval.
2. Bind rotation proposal to policy version and proposal hash.
3. New governance signatures use active key; historical proposals verify against retired versions within overlap.
4. Recovery keys cannot become protocol governance keys.

## Emergency revocation

Use `emergencyRevoke(keys, purpose, version, reason, now)`:

- Requires non-empty recorded reason
- Session signing: invalidates active sessions
- Encrypted data: preserved
- Validator state: preserved

## Verification checklist

- [ ] New credential active and verified
- [ ] Old credential deprecated with overlap end date
- [ ] Audit event sealed (no secrets in payload)
- [ ] Historical verification spot-checked
- [ ] No plaintext committed to repository
- [ ] HSM attestation reference recorded (production only)

## Code references

- `packages/security/src/productization/rotation.ts`
- `packages/security/src/productization/secrets.ts`
- `packages/security/src/regulated/credentials/rotation.ts`
- `packages/security/src/hsm-kms.ts`
- `docs/architecture/WAVE7_PRIVILEGED_SECURITY_AND_KEY_MANAGEMENT.md`
