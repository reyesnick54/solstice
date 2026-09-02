# MoonRey Productive Data Incident Response Runbook

**Scope:** Simulation operational response for productive oracle / provider
incidents  
**Owner:** `packages/sunrey-chain/src/productive/operations`  
**Environment:** `simulation` only — no `LIVE_*` activation

---

## When to Use This Runbook

Use this runbook when productive data quality, provider health, or claim
integrity issues affect MoonRey verification or proposal gating. This runbook
covers **operational containment and review** — not monetary clawback or
history rewrite.

---

## 1. Provider Outage

### Symptoms

- Provider unreachable or circuit breaker `OPEN`
- `PROVIDER_OUTAGE` incident classification
- Elevated `provider_outages` metric
- Domain verification may degrade if coverage drops

### Immediate Actions

1. Confirm outage via provider health and incident registry
2. Open incident with `PROVIDER_OUTAGE` classification
3. Apply containment: `DISABLE_PROVIDER`, `REQUIRE_MANUAL_REVIEW`
4. Verify unrelated domains still have sufficient independent source coverage
5. **Do not** pause entire blockchain or ordinary transfers

### Recovery

1. Confirm provider restoration with human review
2. Re-enable provider via `ProviderIncidentRegistry.reEnableProvider`
3. Update domain circuit breaker coverage for affected category
4. Resume verification only after independent source threshold met

---

## 2. Data Integrity Failure

### Symptoms

- `DATA_INTEGRITY_FAILURE` or `SCHEMA_BREAK` incident
- Anomaly signals: capacity exceeded, duplicate frequency, extreme outliers
- Challenge filed with reason `DATA_INTEGRITY`

### Immediate Actions

1. Quarantine affected provider data (`QUARANTINE_DATA`)
2. Stop domain verification if coverage insufficient (`STOP_DOMAIN_VERIFICATION`)
3. Open productive claim challenge if issuance path affected
4. Block future MoonRey proposals tied to affected claim

### Recovery

1. Obtain corrected data or superseding claim from provider
2. Resolve challenge to `CORRECTED` or `SUPERSEDED` with reference IDs
3. Clear quarantine after human approval
4. Re-evaluate domain circuit breaker state

---

## 3. Oracle Disagreement

### Symptoms

- Conflicting observations across independent sources
- Elevated `conflict_rate_bps` metric
- Challenge reason `METHODOLOGY_DISPUTE` or `DUPLICATE_EVENT`
- Source reputation `observed_disagreement` dimension degraded

### Immediate Actions

1. Move challenge to `UNDER_REVIEW`
2. Use AI only for comparison and evidence summary — **not** fact validation
3. Check independent source count per claim
4. Apply `REQUIRE_MANUAL_REVIEW` containment if systematic

### Recovery

1. Human adjudication: `UPHELD`, `REJECTED`, `CORRECTED`, or `SUPERSEDED`
2. Update source reputation scores from outcome
3. Record event resolution metric
4. Unblock proposals only after challenge terminal state permits

---

## 4. Suspected Compromise

### Symptoms

- `SOURCE_COMPROMISE_SUSPECTED` incident
- Auth failures, schema breaks, or systematic bias signals
- Prior valid provider data now suspect

### Immediate Actions

1. **Disable provider immediately** (`DISABLE_PROVIDER`)
2. Quarantine all data from compromised window
3. Stop domain verification for affected scope
4. File post-finality challenge if historical issuance involved
5. **Do not** automatically burn user-held MoonRey

### Post-Finality Note

If compromise affects previously finalized issuance:

- Record `PostFinalityChallengeRecord`
- `historyRewritten` remains `false`
- Determine required corrective actions (governance review, multi-party
  authorization, compensating governed transaction)
- Escalate to counsel if `MANUAL_COUNSEL_REVIEW` required

### Recovery

1. Complete compromise investigation with sealed evidence
2. Human-only provider restoration (never AI-automated)
3. Re-onboard provider through existing certification path
4. Governance decision on any corrective monetary action

---

## 5. Claim Challenge

### Workflow

```
OPEN → UNDER_REVIEW → UPHELD | REJECTED | CORRECTED | SUPERSEDED
```

### Rules

- Active challenges block future monetization
- `UPHELD` sustains dispute; does not rewrite history
- `CORRECTED` links `correctingClaimId`
- `SUPERSEDED` links `supersedingClaimId`
- Post-finality challenges require governance corrective action plan

---

## 6. Domain Verification Pause

### When to Pause

Pause a **single domain** when:

- Independent source coverage < `requiredIndependentSources`
- Incident containment includes `STOP_DOMAIN_VERIFICATION`
- Circuit breaker state is `OPEN`

### What Continues

- Unrelated productive domains (e.g., energy pause does not stop compute)
- Ordinary blockchain transfers
- Existing finalized history

### Recovery / Re-enable Procedure

1. Restore minimum independent source coverage
2. Update `DomainCircuitBreakerRegistry.updateCoverage`
3. Confirm circuit state returns to `CLOSED` or `HALF_OPEN`
4. Run `assertVerificationAllowed` for domain
5. Clear blocked proposal reasons tied to domain circuit

---

## 7. Monitoring Checklist

Review `ProductiveOperationsAuditView` and metrics:

| Question | Audit Field |
| --- | --- |
| Energy verification providers? | `energyVerificationProviders` |
| Degraded sources? | `degradedSourceClasses` |
| Challenged claims? | `challengedClaims` |
| Blocked proposals and why? | `blockedProposals` |
| Anomaly flags? | `anomalyFlags` |
| Open incidents? | `openIncidents` |
| Domain circuit state? | `domainCircuits` |

---

## 8. Escalation

Escalate to governance operations when:

- Post-finality challenge upheld
- Multi-domain source compromise suspected
- Corrective monetary action may be required
- Counsel review indicated

Wave 5 operations code **records state and blocks future progression** —
it does not execute clawback, burn, or supply modification.

---

## Related

- [`../architecture/WAVE5_PRODUCTIVE_OPERATIONS_AND_CHALLENGES.md`](../architecture/WAVE5_PRODUCTIVE_OPERATIONS_AND_CHALLENGES.md)
- [`../providers/PROVIDER_RISK_MONITOR.md`](../providers/PROVIDER_RISK_MONITOR.md)
- [`../providers/provider-failure-handling.md`](../providers/provider-failure-handling.md)
