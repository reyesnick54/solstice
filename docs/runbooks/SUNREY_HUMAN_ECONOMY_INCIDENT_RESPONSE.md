# SunRey Human Economy Incident Response Runbook

**Scope:** Wave 6 human-economy monetary pipeline operations  
**Environment:** Simulation unless explicitly authorized for production  
**Owner:** Human governance + protocol operations (not AI, PEVE, HIN, or validators acting alone)

---

## 1. Principles

1. **No automatic seizure or burn** — post-finality corrections are append-only records; corrective monetary action requires explicit governed monetary policy.
2. **No blockchain history rewrite** — challenges and corrections do not mutate finalized blocks.
3. **Domain-scoped response** — circuit breakers pause verification for one contribution domain; they do not halt MoonRey, ordinary transfers, or unrelated domains.
4. **Privacy** — incident records use pseudonymous commitments and digests; do not copy raw PDV, health, or travel data into incident tickets or metrics.

---

## 2. Identity Compromise

**Symptoms:** Sybil signals, identity conflict metrics, duplicate actor commitments, anomalous claim velocity.

**Response:**

1. Increment monitoring: `identityConflicts`, `sybilSignals`.
2. File claim challenge with reason `IDENTITY_COMPROMISE` via `registerClaimChallenge`.
3. Transition to `UNDER_REVIEW`; require human governance review.
4. If upstream issuance occurred, append post-finality correction — do **not** auto-burn user-held SunRey.
5. Coordinate with identity service owners for credential rotation (identity service cannot authorize monetary correction alone).

**Recovery gate:** Governance confirms actor re-binding; unrelated domains remain operational.

---

## 3. Attestation Fraud

**Symptoms:** Revoked attestation, verifier reputation spike, provider health alert.

**Response:**

1. Pause domain verification: `pauseDomainVerification` for affected domain (e.g. `RESEARCH`).
2. Record attestation-provider health alert in monitoring.
3. File challenges with reason `ATTESTATION_REVOKED` or `CREDENTIAL_FRAUDULENT`.
4. Update verifier reputation signals; reputation is a risk signal, not truth.
5. Reject new SunRey proposals for paused domain (`DOMAIN_VERIFICATION_PAUSED`).

**Recovery:** `resumeDomainVerification` after provider replacement or governance clearance. Existing finalized issuance stands unless separate governed correction policy applies.

---

## 4. Credential Revocation

**Symptoms:** Verifier `issuerStatus: REVOKED`, stale verification receipts.

**Response:**

1. Mark verifier reputation `REVOKED`.
2. Challenge affected claims referencing revoked verifier commitment.
3. Pause domain if revocation is systemic.
4. Do not retroactively edit Evidence Vault or block history.

---

## 5. Consent Dispute

**Symptoms:** Rights denial metrics, purpose mismatch, inactive consent.

**Response:**

1. Increment `consentDenials` or `rightsDenials`.
2. File challenge with reason `RIGHTS_DISPUTE`.
3. Block new monetization for disputed claim (`hasActiveChallenge`).
4. If issuance already finalized, append correction record only.

---

## 6. Duplicate Contribution

**Symptoms:** `duplicateDetected` metric, `CLAIM_FINGERPRINT_DUPLICATE`, matching fingerprints.

**Response:**

1. Refuse new claim registration or issuance (Wave 3 + Wave 6 anti-replay).
2. File challenge with reason `DUPLICATE_CONTRIBUTION`.
3. Investigate attestation mesh deduplication upstream.
4. Never issue twice for same monetization key or claim ID.

---

## 7. Provider Compromise

**Symptoms:** Compromised attestation provider, elevated dispute/revocation rates for one domain.

**Response:**

1. Activate domain circuit breaker (example: research attestation provider compromised → pause `RESEARCH` verification only).
2. Confirm ordinary SunRey transfers, MoonRey, and unrelated contribution categories continue.
3. Alert via `attestationProviderHealthAlerts` metric.
4. Coordinate provider certification quarantine (Wave 4 provider framework).

---

## 8. Claim Challenge Workflow

```
FILED → UNDER_REVIEW → UPHELD | REJECTED | CORRECTION_RECORDED
```

- **UPHELD:** append post-finality correction; schedule governed monetary review if supply correction needed.
- **REJECTED:** close challenge; no supply action.
- **CORRECTION_RECORDED:** document source correction without history rewrite.

Functions: `registerClaimChallenge`, `transitionClaimChallenge`, `appendCorrectionRecord`.

---

## 9. Verification Category Pause

Use `pauseDomainVerification` / `resumeDomainVerification`.

**Does not halt:**

- Ordinary SunRey transfers
- MoonRey issuance or transfers
- Unrelated contribution categories
- Whole blockchain consensus

---

## 10. Recovery Checklist

- [ ] Root cause documented (governance ticket, not raw personal data)
- [ ] Domain circuit breaker state reviewed
- [ ] Verifier reputation updated
- [ ] Active challenges triaged
- [ ] Consumption store integrity verified (`loadConsumptionStore`, `replayConsumptionLog`)
- [ ] Monitoring snapshot reviewed (`snapshotMetrics`)
- [ ] Production issuance remains disabled unless formal formula approval exists
- [ ] No automatic burn or seizure executed without governed monetary policy

---

## 11. Escalation

| Severity | Condition | Action |
| --- | --- | --- |
| S1 | Active fraudulent issuance attempt blocked | Log refusal code; monitor |
| S2 | Domain verification paused | Governance review within simulation SLA |
| S3 | Upheld challenge on finalized issuance | Governed monetary policy review; append correction |
| S4 | Systemic multi-domain verifier compromise | Pause affected domains; full governance ceremony |

---

## 12. References

- `docs/architecture/WAVE6_SUNREY_MONETARY_PIPELINE_AND_OPERATIONS.md`
- `packages/sunrey-chain/src/economics/human-economy/`
- `docs/architecture/WAVE3_PROOF_BOUND_MONETARY_TRANSITIONS.md`
- `docs/architecture/SUNREY_MONETARY_AUTHORITY_CONTRACT.md`
