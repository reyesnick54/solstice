# Wave 7 — Jurisdiction and Regulatory Controls

**Status:** Engineering architecture — `RESEARCH_REQUIRED`  
**Owner:** `packages/kernel/src/regulatory-controls`  
**Environment:** `simulation`; all `LIVE_*` flags remain `false`

This document describes SunRey's Wave 7 compliance-enabling architecture for
systematic jurisdiction and regulatory-control enforcement. **Technical controls
do not constitute legal compliance.** All profiles, gates, and constraints carry
`legalStatus: RESEARCH_REQUIRED` until counsel review.

## Purpose

SunRey must change allowed behavior based on:

- jurisdiction
- data type
- provider license
- user rights
- service function
- regulatory classification
- retention rule
- purpose

…without embedding legal assumptions throughout application code.

## Architecture

```text
ActionIntent / DataUseRequest
        |
        v
JurisdictionContext (versioned, multi-signal)
        |
        +--> RegulatoryControlProfile (category requirements)
        +--> RegulatoryFeatureGate (service activation by jurisdiction)
        +--> ProviderLicenseRegistry (capability restrictions)
        +--> DataResidencyRegistry (storage region constraints)
        +--> RetentionPolicyRegistry (category retention + legal hold)
        |
        v
RegulatoryControlEngine.evaluate()
        |
        v
ComplianceAuditReceipt[] (auditable decision chain)
        |
        v
Kernel six proofs (jurisdictionProof, complianceProof, ...)
```

## Components

### JurisdictionContext

Versioned object (`sunrey.jurisdiction-context.v1`) supporting distinct signals:

| Dimension | Example source |
| --- | --- |
| USER | Customer jurisdiction |
| ENTITY | Legal entity jurisdiction |
| DATA_SOURCE | Provider/oracle origin |
| DATA_STORAGE | Storage location jurisdiction |
| SERVICE | Service deployment jurisdiction |
| TRANSACTION | Origin/destination jurisdiction |

Signals are **not assumed identical**. Conflicting signals produce `DEFER` with
reason code `JURISDICTION_CONTEXT_AMBIGUOUS`.

Location: `packages/kernel/src/regulatory-controls/jurisdiction-context.ts`

### RegulatoryControlProfile

Configurable technical requirement structures for categories:

- BANKING, INVESTMENT, DIGITAL_ASSETS, EXCHANGE, MONEY_TRANSMISSION
- HEALTH_DATA, CONSUMER_PRIVACY, RESEARCH_DATA, AI_AGENTS, CROSS_BORDER_DATA

Profiles describe engineering controls (e.g. `KERNEL_IDENTITY_PROOF`,
`CONSENT_PURPOSE_GATE`, `RESIDENCY_CONSTRAINT`). They do not encode legal
conclusions.

Location: `packages/kernel/src/regulatory-controls/regulatory-profile.ts`

### Regulatory Feature Gates

Controls regulated services by jurisdiction and environment:

| Feature | Enabled | Sandbox | Disabled |
| --- | --- | --- | --- |
| EXCHANGE | GB | US | SA, AE |
| HEALTH_DATA_CONTRIBUTION | — | — | US, EU, GB |
| CRYPTO_CONVERSION | — | GB | US, SA |
| AI_AGENT_FINANCIAL_AUTOMATION | — | GB, US, EU | SA |

Architecture support does **not** activate regulated services. Gates remain
disabled until explicitly configured and approved.

Location: `packages/kernel/src/regulatory-controls/feature-gates.ts`

### Provider License Enforcement

Provider restrictions propagate through policy decisions:

| Capability | Meaning |
| --- | --- |
| QUERY | Read/fetch from provider |
| PERSIST | Store provider response |
| INTERNAL_COMPUTATION | Use in internal processing |
| REDISTRIBUTE | Share with third parties |
| COMMERCIAL_USE / NON_COMMERCIAL_USE | Usage class restrictions |

Example: `fixture-oracle-alpha` permits QUERY and INTERNAL_COMPUTATION but
denies PERSIST and REDISTRIBUTE.

Location: `packages/kernel/src/regulatory-controls/provider-license.ts`

### Compliance Audit Receipts

Every regulatory control evaluation produces auditable receipts:

| Kind | Covers |
| --- | --- |
| POLICY | Regulatory profile application |
| JURISDICTION | JurisdictionContext resolution |
| IDENTITY_ASSURANCE | Identity proof commitments |
| RIGHTS | Economic proof rights |
| CONSENT | Consent/purpose decisions |
| PROVIDER_LICENSE | Provider capability checks |
| SERVICE_FEATURE_GATE | Feature gate evaluation |
| RETENTION | Retention policy decisions |
| RESIDENCY | Data residency checks |
| LEGAL_HOLD | Legal hold status |
| DECISION | Final regulatory control outcome |

Receipts support later compliance review. They are sealed with SHA-256 digest
prefixes and stored in `ComplianceAuditReceiptStore`.

Location: `packages/kernel/src/regulatory-controls/audit-receipts.ts`

### Auditor Role

Read-only `AUDITOR` staff role (existing in `packages/identity`) can inspect:

- decision history (receipt chain)
- proof commitments
- governance references
- control status
- incident history

Auditors **cannot** post journals, issue Execution Authority, or access custody
keys. `assertAuditorCannotMutate()` enforces this at the regulatory control plane.

Location: `packages/kernel/src/regulatory-controls/auditor.ts`

### Legal Hold

Technical concept for preserving off-chain records:

- Records authority reference (not legal interpretation)
- Specifies affected retention categories
- Blocks retention deletion while active
- Supports release with timestamp

Does not affect immutable financial history (ledger, Evidence Vault).

Location: `packages/kernel/src/regulatory-controls/legal-hold.ts`

## Integration with Existing Systems

| System | Relationship |
| --- | --- |
| Kernel policy engine | Jurisdiction packs + `jurisdictionProof` remain authoritative for EA |
| Chunk 161 operating scope | Feeds `OperatingScopeFact` into Kernel; regulatory controls complement |
| Consent engine | Purpose/consent gates feed regulatory control evaluation |
| PDV retention | Product retention policies align with Wave 7 retention categories |
| Regulatory Digital Twin | Simulates policy changes; does not issue EA |
| Identity staff roles | AUDITOR role provides read-only inspection |

## Application Service Rule

Application services (`services/*`) must **not** embed country-specific regulatory
logic. They pass jurisdiction signals to the Kernel regulatory control engine and
return its decision unchanged.

## Future Legal Review Required

The following require counsel review before any production claim:

1. Jurisdiction pack selection and conflict-of-law resolution
2. Regulatory profile requirements per category and jurisdiction
3. Feature gate enablement for production jurisdictions
4. Provider license interpretation and commercial use boundaries
5. Data residency adequacy and cross-border transfer mechanisms
6. Retention period selection per data category
7. Legal hold authority and scope definitions
8. Auditor access scope and privilege boundaries

## Tests

- `packages/kernel/src/regulatory-controls/regulatory-controls.test.ts`
- `tests/wave-7-jurisdiction-regulatory-controls.test.ts`

## Related Documents

- [`SUNREY_DATA_RETENTION_AND_RESIDENCY_MODEL.md`](./SUNREY_DATA_RETENTION_AND_RESIDENCY_MODEL.md)
- [`constitution.md`](./constitution.md)
- [`ADR-0006-policy-engine-language.md`](./adr/ADR-0006-policy-engine-language.md)
- [`../compliance/chunk-161-operating-scope-matrix.md`](../compliance/chunk-161-operating-scope-matrix.md)
