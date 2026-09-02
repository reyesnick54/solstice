# SunRey Data Retention and Residency Model

**Status:** Engineering architecture — `RESEARCH_REQUIRED`  
**Owner:** `packages/kernel/src/regulatory-controls` (retention + residency)  
**Companion:** PDV product retention at `packages/personal-data-vault/src/product/retention.ts`

This document describes SunRey's configurable retention semantics and
vendor-neutral data residency architecture. **Technical controls do not
constitute legal compliance.**

## Retention Model

### Categories

| Category | Default retention | Immutable | Legal hold blocks deletion |
| --- | --- | --- | --- |
| TRANSACTION_RECORDS | Indefinite | Yes | Yes |
| LEDGER_RECORDS | Indefinite | Yes | Yes |
| EVIDENCE_VAULT | Indefinite | Yes | Yes |
| RAW_PROVIDER_RESPONSES | 90 days | No | Yes |
| PERSONAL_DATA | 730 days | No | Yes |
| CONSENT_RECORDS | Indefinite | No | Yes |
| USAGE_RECEIPTS | 365 days | No | Yes |
| LOGS | 180 days | No | Yes |
| TEMPORARY_CACHES | 7 days | No | No |

### Immutable Financial History

The following categories are **protected from destructive deletion** by ordinary
application retention:

- `LEDGER_RECORDS` — append-only ledger journals
- `EVIDENCE_VAULT` — hash-chained evidence seals
- `TRANSACTION_RECORDS` — financial transaction audit trail

Corrections to financial state are compensating entries, not deletions. Retention
evaluation returns `RETENTION_IMMUTABLE` for these categories regardless of age.

### Retention Evaluation

```text
record + category + active legal holds
        |
        v
RetentionPolicyRegistry.evaluate()
        |
        +--> immutable? → deletable: false
        +--> legal hold active? → deletable: false
        +--> retentionDays exceeded? → expired: true, deletable: true
        +--> otherwise → deletable: false
```

### Legal Hold Interaction

When a legal hold is active for a category:

1. Retention expiry does not permit deletion
2. Hold records `authorityRef` (external reference, not legal interpretation)
3. Hold specifies `subjectRef` and affected `recordCategories`
4. Release sets `releasedAt` and `active: false`

Legal hold does **not** affect immutable financial history categories.

### PDV Alignment

PDV product retention modes map to Wave 7 categories:

| PDV mode | Wave 7 category |
| --- | --- |
| SERVICE_ACTIVE | PERSONAL_DATA |
| TIME_LIMITED | PERSONAL_DATA / LOGS |
| LEGAL_HOLD | Any non-immutable category |
| EVIDENCE_RETENTION | EVIDENCE_VAULT |

PDV remains the owner for subject-bound encrypted personal data. Wave 7 retention
provides the cross-cutting policy layer.

## Data Residency Model

### Design Principles

1. **Vendor-neutral** — regions are abstract (`EU_WEST`, `US_EAST`, `UK_SOUTH`, `ME_CENTRAL`, `AP_SOUTHEAST`, `PROCESSING_ONLY`)
2. **No cloud assumptions** — no AWS/GCP/Azure region IDs in the control plane
3. **Configurable per jurisdiction** — constraints are data, not hard-coded logic
4. **Processing-only mode** — supports compute-without-persist requirements

### Constraint Modes

| Mode | Behavior |
| --- | --- |
| ALLOWED_REGIONS | Data may only persist in listed regions |
| PROHIBITED_REGIONS | Listed regions are blocked |
| CROSS_BORDER_RESTRICTED | Cross-border storage signals trigger review |
| PROCESSING_ONLY_NO_PERSIST | Computation permitted; persistence denied |

### Default Constraints (simulation)

| Jurisdiction | Allowed regions | Prohibited regions |
| --- | --- | --- |
| EU (DE, FR, IE) | EU_WEST, EU_CENTRAL | US_EAST, US_WEST, ME_CENTRAL |
| GB | UK_SOUTH, EU_WEST | US_EAST, US_WEST |
| SA, AE | ME_CENTRAL | US_EAST, US_WEST, EU_WEST |
| US | US_EAST, US_WEST | — |

### Residency Evaluation

```text
jurisdiction + storageRegion + persist flag
        |
        v
DataResidencyRegistry.evaluate()
        |
        +--> processing-only + persist? → DENY
        +--> region prohibited? → DENY
        +--> region not in allowed list? → DENY
        +--> otherwise → ALLOW
```

### Cross-Border Detection

`JurisdictionContext.hasCrossBorderSignal()` compares USER, DATA_STORAGE, and
TRANSACTION dimension signals. Cross-border scenarios feed the
`CROSS_BORDER_DATA` regulatory profile but do not auto-permit or auto-deny.

## Provider Data Handling

Provider license restrictions interact with residency:

| Provider capability | Residency implication |
| --- | --- |
| QUERY only | `persist: false` in residency evaluation |
| PERSIST denied | Provider response must not be stored |
| REDISTRIBUTE denied | Output cannot leave the service boundary |

Example: `fixture-oracle-alpha` allows QUERY but denies PERSIST. A fetch that
attempts to store the response in `US_EAST` for an EU jurisdiction fails both
provider license and residency checks.

## Audit Trail

Retention and residency decisions produce `ComplianceAuditReceipt` records:

- Kind: `RETENTION` or `RESIDENCY`
- Outcome: `ALLOW` or `DENY`
- Reason code and evidence references
- `legalStatus: RESEARCH_REQUIRED`

Receipts are inspectable by the read-only AUDITOR role.

## Future Legal Review Required

1. Retention period selection per jurisdiction and data category
2. Legal hold authority, scope, and release procedures
3. Cross-border transfer adequacy mechanisms
4. Processing-only vs. persistence boundaries for regulated data
5. Alignment with PDV subject-access and erasure requests
6. Provider data processing agreement terms vs. technical restrictions

## Related Documents

- [`WAVE7_JURISDICTION_AND_REGULATORY_CONTROLS.md`](./WAVE7_JURISDICTION_AND_REGULATORY_CONTROLS.md)
- [`../productization/PHASE_H_01_PERSONAL_DATA_VAULT.md`](../productization/PHASE_H_01_PERSONAL_DATA_VAULT.md)
- [`ADR-0007-identity-stack.md`](./adr/ADR-0007-identity-stack.md)
