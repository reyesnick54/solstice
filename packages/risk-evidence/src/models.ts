/**
 * Canonical SunRey Risk Evidence models.
 *
 * External providers supply signals only. They do not authorize financial
 * execution. The Compliance Kernel and internal Risk Policy remain authoritative.
 */

import type { UtcInstant } from '../../domain/src/time.ts';

export const BUSINESS_STATUSES = ['ACTIVE', 'INACTIVE', 'DISSOLVED', 'SUSPENDED', 'UNKNOWN'] as const;
export type BusinessStatus = (typeof BUSINESS_STATUSES)[number];

export const DIGITAL_RISK_TYPES = [
  'IP_REPUTATION',
  'VPN',
  'PROXY',
  'TOR',
  'EMAIL_REPUTATION',
  'ABUSE_HISTORY',
  'NETWORK_RISK',
  'LOCATION_ANOMALY',
] as const;
export type DigitalRiskType = (typeof DIGITAL_RISK_TYPES)[number];

export const RISK_POLICY_OUTCOMES = [
  'NORMAL',
  'STEP_UP_AUTH',
  'REVIEW',
  'HOLD',
  'REJECT',
] as const;
export type RiskPolicyOutcome = (typeof RISK_POLICY_OUTCOMES)[number];

export const EVIDENCE_FRESHNESS = ['FRESH', 'STALE', 'EXPIRED'] as const;
export type EvidenceFreshness = (typeof EVIDENCE_FRESHNESS)[number];

export type BusinessOfficer = {
  readonly name: string;
  readonly role: string;
  readonly appointedDate: string | null;
};

export type RegisteredAddress = {
  readonly line1: string | null;
  readonly city: string | null;
  readonly region: string | null;
  readonly postalCode: string | null;
  readonly country: string;
};

/**
 * Canonical business identity evidence from public registries or KYB providers.
 */
export type BusinessIdentityEvidence = {
  readonly evidenceId: string;
  readonly entityId: string | null;
  readonly legalName: string;
  readonly tradingName: string | null;
  readonly registrationNumber: string | null;
  readonly jurisdiction: string;
  readonly status: BusinessStatus;
  readonly providerNativeStatus: string | null;
  readonly incorporationDate: string | null;
  readonly entityType: string | null;
  readonly registeredAddress: RegisteredAddress | null;
  readonly officers: readonly BusinessOfficer[];
  readonly providerId: string;
  readonly providerRecordId: string | null;
  readonly retrievedAt: UtcInstant;
  readonly sourceUpdatedAt: UtcInstant | null;
  readonly freshness: EvidenceFreshness;
  readonly confidence: number | null;
  readonly authorityClass: string;
  readonly provenance: string;
};

export type IpIntelligence = {
  readonly ip: string | null;
  readonly asn: string | null;
  readonly isp: string | null;
  readonly country: string | null;
  readonly proxy: boolean;
  readonly vpn: boolean;
  readonly tor: boolean;
  readonly hosting: boolean;
  readonly abuseFlags: readonly string[];
};

export type EmailReputation = {
  readonly reputation: 'GOOD' | 'NEUTRAL' | 'SUSPICIOUS' | 'UNKNOWN';
  readonly suspicious: boolean;
  readonly references: number | null;
  readonly domainAgeDays: number | null;
  readonly disposable: boolean | null;
  readonly breachMetadata: readonly string[];
};

/**
 * Canonical digital-risk evidence. External scores are signals, not SunRey decisions.
 */
export type DigitalRiskEvidence = {
  readonly evidenceId: string;
  readonly sessionId: string | null;
  readonly deviceId: string | null;
  readonly userId: string | null;
  readonly riskType: DigitalRiskType;
  readonly riskScore: number | null;
  readonly confidence: number | null;
  readonly providerId: string;
  readonly providerNativeClassification: string | null;
  readonly observedAt: UtcInstant;
  readonly retrievedAt: UtcInstant;
  readonly freshness: EvidenceFreshness;
  readonly provenance: string;
  readonly ipIntelligence: IpIntelligence | null;
  readonly emailReputation: EmailReputation | null;
};

export type BusinessSearchQuery = {
  readonly legalName?: string;
  readonly registrationNumber?: string;
  readonly jurisdiction: string;
  readonly lei?: string;
  readonly taxId?: string;
};

export type BusinessResolutionKey = {
  readonly registrationNumber: string;
  readonly jurisdiction: string;
};

export type RiskEvidenceSubjectRef = {
  readonly sessionId?: string;
  readonly deviceId?: string;
  readonly userId?: string;
};

export type RiskPolicyFeature = {
  readonly code: string;
  readonly weight: number;
  readonly source: string;
};

export type RiskPolicyInput = {
  readonly businessEvidence: readonly BusinessIdentityEvidence[];
  readonly digitalRiskEvidence: readonly DigitalRiskEvidence[];
  readonly features: readonly RiskPolicyFeature[];
};

export type RiskPolicyDecision = {
  readonly outcome: RiskPolicyOutcome;
  readonly reasonCodes: readonly string[];
  readonly stepUpRequired: boolean;
  readonly providerScoreUsed: false;
  readonly policyVersionId: string;
  readonly evaluatedAt: UtcInstant;
};

export type Wave4ProviderCoverage = {
  readonly providerId: string;
  readonly category: string;
  readonly status: 'IMPLEMENTED' | 'BLOCKED' | 'NOT_IN_CATALOG' | 'FIXTURE_ONLY';
  readonly notes: string;
};
