/**
 * Engineering fixtures that look like external evidence references.
 * fixture=true and engineeringOnly=true. A fixture never satisfies
 * production evidence.
 */

import { ExternalEvidenceRegistry, type ExternalEvidenceDraft } from './registry.ts';
import { FIXTURE_COUNTS_AS_EXTERNAL, type ExternalProductionEvidenceRecord } from './types.ts';

export const FIXTURE_NOW_UTC = '2026-08-20T00:00:00.000Z' as const;

export function fixtureSecurityAuditDraft(overrides?: Partial<ExternalEvidenceDraft>): ExternalEvidenceDraft {
  return {
    recordId: overrides?.recordId ?? 'ext-ev-fixture-security-audit',
    evidenceClass: overrides?.evidenceClass ?? 'EXTERNAL_SECURITY_AUDIT',
    issuerOrSource: overrides?.issuerOrSource ?? 'fixture-auditor.example',
    subjectType: overrides?.subjectType ?? 'MAINNET_READINESS_DIMENSION',
    subjectId: overrides?.subjectId ?? 'EXTERNAL_SECURITY_REVIEW',
    scope: overrides?.scope ?? {
      label: 'SUNREY_CHAIN/simulation',
      jurisdictions: ['SIM'],
      activationDomains: ['SUNREY_CHAIN'],
    },
    issuedAtUtc: overrides?.issuedAtUtc ?? '2026-01-01T00:00:00.000Z',
    validFromUtc: overrides?.validFromUtc ?? '2026-01-01T00:00:00.000Z',
    expiresAtUtc: overrides?.expiresAtUtc ?? '2027-01-01T00:00:00.000Z',
    reviewDueAtUtc: overrides?.reviewDueAtUtc ?? '2026-10-01T00:00:00.000Z',
    reference: overrides?.reference ?? {
      kind: 'DOCUMENT_REFERENCE',
      locator: 'secure-repo://fixtures/security-audit-ref',
      repositoryId: 'fixture-doc-store',
    },
    contentDigest: overrides?.contentDigest ?? 'a'.repeat(64),
    confidential: overrides?.confidential ?? true,
    fixture: true,
    engineeringOnly: true,
    version: overrides?.version ?? 1,
    previousVersionId: overrides?.previousVersionId ?? null,
  };
}

export function externalLookingDraft(overrides?: Partial<ExternalEvidenceDraft>): ExternalEvidenceDraft {
  return {
    recordId: overrides?.recordId ?? 'ext-ev-security-audit-metadata',
    evidenceClass: overrides?.evidenceClass ?? 'EXTERNAL_SECURITY_AUDIT',
    issuerOrSource: overrides?.issuerOrSource ?? 'independent-review-org',
    subjectType: overrides?.subjectType ?? 'MAINNET_READINESS_DIMENSION',
    subjectId: overrides?.subjectId ?? 'EXTERNAL_SECURITY_REVIEW',
    scope: overrides?.scope ?? {
      label: 'SUNREY_CHAIN/EXTERNAL_SECURITY_REVIEW',
      jurisdictions: ['US'],
      activationDomains: ['SUNREY_CHAIN'],
    },
    issuedAtUtc: overrides?.issuedAtUtc ?? '2026-06-01T00:00:00.000Z',
    validFromUtc: overrides?.validFromUtc ?? '2026-06-01T00:00:00.000Z',
    expiresAtUtc: overrides?.expiresAtUtc ?? '2027-06-01T00:00:00.000Z',
    reviewDueAtUtc: overrides?.reviewDueAtUtc ?? '2027-03-01T00:00:00.000Z',
    reference: overrides?.reference ?? {
      kind: 'SECURE_REPOSITORY_REFERENCE',
      locator: 'secure-repo://legal-hold/security-review/2026-06',
      repositoryId: 'sunrey-secure-docs',
    },
    contentDigest: overrides?.contentDigest ?? 'b'.repeat(64),
    confidential: overrides?.confidential ?? true,
    fixture: false,
    engineeringOnly: false,
    version: overrides?.version ?? 1,
    previousVersionId: overrides?.previousVersionId ?? null,
  };
}

export function counselOpinionDraft(overrides?: Partial<ExternalEvidenceDraft>): ExternalEvidenceDraft {
  return externalLookingDraft({
    recordId: 'ext-ev-counsel-opinion',
    evidenceClass: 'COUNSEL_OPINION',
    subjectId: 'LEGAL',
    issuerOrSource: 'authorized-counsel',
    scope: {
      label: 'LEGAL/US',
      jurisdictions: ['US'],
      activationDomains: ['SUNREY_CHAIN'],
    },
    ...overrides,
  });
}

export function regulatoryApprovalDraft(overrides?: Partial<ExternalEvidenceDraft>): ExternalEvidenceDraft {
  return externalLookingDraft({
    recordId: 'ext-ev-regulatory-approval',
    evidenceClass: 'REGULATORY_APPROVAL',
    subjectId: 'REGULATORY',
    issuerOrSource: 'regulator-slot',
    scope: {
      label: 'REGULATORY/US',
      jurisdictions: ['US'],
      activationDomains: ['SUNREY_CHAIN'],
    },
    ...overrides,
  });
}

export function providerAgreementDraft(overrides?: Partial<ExternalEvidenceDraft>): ExternalEvidenceDraft {
  return externalLookingDraft({
    recordId: 'ext-ev-payment-rail-contract',
    evidenceClass: 'SERVICE_CONTRACT',
    subjectType: 'PROVIDER',
    subjectId: 'rail-provider-1',
    issuerOrSource: 'payment-rail-counterparty',
    scope: {
      label: 'PAYMENT_RAIL/US',
      jurisdictions: ['US'],
      providerDomains: ['PAYMENT_RAIL'],
      activationDomains: ['PAYMENT_RAILS'],
    },
    ...overrides,
  });
}

export function registerFixtureSecurityAudit(
  registry: ExternalEvidenceRegistry = new ExternalEvidenceRegistry(),
): ExternalProductionEvidenceRecord {
  const result = registry.register(fixtureSecurityAuditDraft());
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.value;
}

export function createFixtureRegistry(): ExternalEvidenceRegistry {
  const registry = new ExternalEvidenceRegistry();
  registerFixtureSecurityAudit(registry);
  return registry;
}

export const FIXTURE_CANNOT_SATISFY_PRODUCTION = !FIXTURE_COUNTS_AS_EXTERNAL;
