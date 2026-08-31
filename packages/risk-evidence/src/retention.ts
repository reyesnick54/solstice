/**
 * Retention policies for risk evidence.
 */

import type { EvidenceFreshness } from './models.ts';

export const RETENTION_POLICIES = Object.freeze({
  SESSION_DIGITAL_RISK: Object.freeze({
    policyId: 'retention:session-digital-risk',
    maxAgeHours: 24,
    description: 'Short-lived session/device risk signals',
  }),
  COMPLIANCE_AUDIT: Object.freeze({
    policyId: 'retention:compliance-audit',
    maxAgeDays: 2555,
    description: 'Compliance audit evidence where required by policy',
  }),
  KYB_EVIDENCE: Object.freeze({
    policyId: 'retention:kyb-evidence',
    maxAgeDays: 365,
    description: 'KYB evidence retained per verification lifecycle',
  }),
});

export function classifyFreshness(retrievedAt: string, nowUtc: string, maxAgeHours: number): EvidenceFreshness {
  const retrieved = Date.parse(retrievedAt);
  const now = Date.parse(nowUtc);
  const ageHours = (now - retrieved) / (1000 * 60 * 60);
  if (ageHours <= maxAgeHours) return 'FRESH';
  if (ageHours <= maxAgeHours * 4) return 'STALE';
  return 'EXPIRED';
}

export function sessionEvidenceExpired(retrievedAt: string, nowUtc: string): boolean {
  return classifyFreshness(retrievedAt, nowUtc, RETENTION_POLICIES.SESSION_DIGITAL_RISK.maxAgeHours) === 'EXPIRED';
}
