/**
 * Configurable retention. There is no single retention period for all data.
 */

export const RETENTION_MODES = [
  'SERVICE_ACTIVE',
  'TIME_LIMITED',
  'CONSENT_WITHDRAWN',
  'LEGAL_HOLD',
  'EVIDENCE_RETENTION',
] as const;
export type RetentionMode = (typeof RETENTION_MODES)[number];

export type ProductRetentionPolicy = {
  readonly policyId: string;
  readonly mode: RetentionMode;
  readonly defaultDays: number | null;
  readonly deleteWhenConsentWithdrawn: boolean;
  readonly legalHold: boolean;
  readonly evidenceRetention: boolean;
  readonly legalStatus: 'RESEARCH_REQUIRED';
};

export const RETENTION_POLICIES = Object.freeze({
  service_active: Object.freeze({
    policyId: 'pdv.retention.service_active.v1',
    mode: 'SERVICE_ACTIVE',
    defaultDays: null,
    deleteWhenConsentWithdrawn: true,
    legalHold: false,
    evidenceRetention: false,
    legalStatus: 'RESEARCH_REQUIRED',
  } satisfies ProductRetentionPolicy),
  time_limited_180: Object.freeze({
    policyId: 'pdv.retention.time_limited_180.v1',
    mode: 'TIME_LIMITED',
    defaultDays: 180,
    deleteWhenConsentWithdrawn: true,
    legalHold: false,
    evidenceRetention: false,
    legalStatus: 'RESEARCH_REQUIRED',
  } satisfies ProductRetentionPolicy),
  time_limited_730: Object.freeze({
    policyId: 'pdv.retention.time_limited_730.v1',
    mode: 'TIME_LIMITED',
    defaultDays: 730,
    deleteWhenConsentWithdrawn: false,
    legalHold: false,
    evidenceRetention: false,
    legalStatus: 'RESEARCH_REQUIRED',
  } satisfies ProductRetentionPolicy),
  legal_hold: Object.freeze({
    policyId: 'pdv.retention.legal_hold.v1',
    mode: 'LEGAL_HOLD',
    defaultDays: null,
    deleteWhenConsentWithdrawn: false,
    legalHold: true,
    evidenceRetention: true,
    legalStatus: 'RESEARCH_REQUIRED',
  } satisfies ProductRetentionPolicy),
  evidence: Object.freeze({
    policyId: 'pdv.retention.evidence.v1',
    mode: 'EVIDENCE_RETENTION',
    defaultDays: null,
    deleteWhenConsentWithdrawn: false,
    legalHold: false,
    evidenceRetention: true,
    legalStatus: 'RESEARCH_REQUIRED',
  } satisfies ProductRetentionPolicy),
});

export function retentionPolicyById(policyId: string): ProductRetentionPolicy | undefined {
  return Object.values(RETENTION_POLICIES).find((row) => row.policyId === policyId);
}
