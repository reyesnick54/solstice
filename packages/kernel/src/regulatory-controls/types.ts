/**
 * Wave 7 — Jurisdiction and regulatory-control types.
 */

import type { Jurisdiction } from '../../../domain/src/jurisdiction.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import type {
  ComplianceReceiptKind,
  JurisdictionDimension,
  LegalReviewStatus,
  ProviderLicenseCapability,
  RegulatedFeature,
  RegulatoryCategory,
  RegulatoryControlOutcome,
  ResidencyConstraintMode,
  RetentionCategory,
  StorageRegion,
} from './taxonomy.ts';

export const JURISDICTION_CONTEXT_SCHEMA_VERSION = 'sunrey.jurisdiction-context.v1' as const;

export type JurisdictionSignal = {
  readonly dimension: JurisdictionDimension;
  readonly jurisdiction: Jurisdiction | string;
  readonly sourceRef: string;
};

export type JurisdictionContext = {
  readonly schemaVersion: typeof JURISDICTION_CONTEXT_SCHEMA_VERSION;
  readonly contextId: string;
  readonly version: string;
  readonly effectiveFrom: UtcInstant;
  readonly signals: readonly JurisdictionSignal[];
  readonly resolvedPrimary: Jurisdiction | string | null;
  readonly ambiguous: boolean;
  readonly ambiguityReason: string | null;
  readonly legalStatus: LegalReviewStatus;
};

export type RegulatoryControlRequirement = {
  readonly requirementId: string;
  readonly description: string;
  readonly technicalControl: string;
  readonly mandatory: boolean;
};

export type RegulatoryControlProfile = {
  readonly profileId: string;
  readonly version: string;
  readonly category: RegulatoryCategory;
  readonly jurisdictions: readonly (Jurisdiction | string)[];
  readonly effectiveFrom: UtcInstant;
  readonly requirements: readonly RegulatoryControlRequirement[];
  readonly enabled: boolean;
  readonly legalStatus: LegalReviewStatus;
  readonly notes: string;
};

export type RetentionPolicyRule = {
  readonly ruleId: string;
  readonly category: RetentionCategory;
  readonly retentionDays: number | null;
  readonly immutable: boolean;
  readonly legalHoldBlocksDeletion: boolean;
  readonly effectiveFrom: UtcInstant;
  readonly legalStatus: LegalReviewStatus;
};

export type DataResidencyConstraint = {
  readonly constraintId: string;
  readonly mode: ResidencyConstraintMode;
  readonly jurisdictions: readonly (Jurisdiction | string)[];
  readonly allowedRegions: readonly StorageRegion[];
  readonly prohibitedRegions: readonly StorageRegion[];
  readonly crossBorderRestricted: boolean;
  readonly processingOnlyNoPersist: boolean;
  readonly effectiveFrom: UtcInstant;
  readonly legalStatus: LegalReviewStatus;
};

export type ProviderLicenseRestriction = {
  readonly providerId: string;
  readonly licenseRef: string;
  readonly permitted: readonly ProviderLicenseCapability[];
  readonly denied: readonly ProviderLicenseCapability[];
  readonly jurisdictions: readonly (Jurisdiction | string)[];
  readonly effectiveFrom: UtcInstant;
  readonly legalStatus: LegalReviewStatus;
};

export type RegulatoryFeatureGate = {
  readonly gateId: string;
  readonly feature: RegulatedFeature;
  readonly enabledJurisdictions: readonly (Jurisdiction | string)[];
  readonly sandboxJurisdictions: readonly (Jurisdiction | string)[];
  readonly disabledJurisdictions: readonly (Jurisdiction | string)[];
  readonly effectiveFrom: UtcInstant;
  readonly legalStatus: LegalReviewStatus;
};

export type ComplianceAuditReceipt = {
  readonly receiptId: string;
  readonly kind: ComplianceReceiptKind;
  readonly decisionRef: string;
  readonly outcome: RegulatoryControlOutcome;
  readonly jurisdictionContextId: string | null;
  readonly profileId: string | null;
  readonly providerId: string | null;
  readonly feature: RegulatedFeature | null;
  readonly reasonCode: string;
  readonly reason: string;
  readonly evidenceRefs: readonly string[];
  readonly recordedAt: UtcInstant;
  readonly legalStatus: LegalReviewStatus;
};

export type LegalHoldRecord = {
  readonly holdId: string;
  readonly authorityRef: string;
  readonly subjectRef: string;
  readonly recordCategories: readonly RetentionCategory[];
  readonly effectiveFrom: UtcInstant;
  readonly releasedAt: UtcInstant | null;
  readonly active: boolean;
  readonly legalStatus: LegalReviewStatus;
};

export type RegulatoryControlEvaluationInput = {
  readonly action: string;
  readonly jurisdictionContext: JurisdictionContext;
  readonly regulatoryCategory?: RegulatoryCategory | null;
  readonly retentionCategory?: RetentionCategory | null;
  readonly storageRegion?: StorageRegion | null;
  readonly providerId?: string | null;
  readonly providerCapability?: ProviderLicenseCapability | null;
  readonly regulatedFeature?: RegulatedFeature | null;
  readonly rightsGranted?: boolean;
  readonly consentGranted?: boolean;
  readonly environment: 'simulation' | 'sandbox' | 'production';
  readonly at: UtcInstant;
};

export type RegulatoryControlEvaluationResult = {
  readonly outcome: RegulatoryControlOutcome;
  readonly reasonCode: string;
  readonly reason: string;
  readonly receipts: readonly ComplianceAuditReceipt[];
  readonly blockedBy: ComplianceReceiptKind | null;
};

export type AuditorInspectionScope = {
  readonly decisionHistory: boolean;
  readonly proofCommitments: boolean;
  readonly governanceReferences: boolean;
  readonly controlStatus: boolean;
  readonly incidentHistory: boolean;
};

export type AuditorAccessRequest = {
  readonly operatorId: string;
  readonly role: 'AUDITOR';
  readonly scope: AuditorInspectionScope;
  readonly at: UtcInstant;
};

export type AuditorAccessResult = {
  readonly permitted: boolean;
  readonly readOnly: true;
  readonly reason: string;
  readonly inspectionRefs: readonly string[];
};
