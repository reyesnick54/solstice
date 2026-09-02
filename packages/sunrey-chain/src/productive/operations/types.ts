/**
 * Wave 5 — Productive operations types.
 *
 * Productive economic truth is not static. Providers fail, lie, change
 * schemas, publish corrections, and become stale. Claims can be challenged,
 * corrected, superseded, or disputed. Finalized blockchain history is never
 * rewritten; subsequent challenge and correction state is recorded separately.
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { ProductiveCategory } from '../types.ts';

export const PRODUCTIVE_OPERATIONS_SCHEMA_VERSION = 'sunrey.productive.operations.v1' as const;

/** Productive claim challenge lifecycle — extends Wave 3 / oracle dispute naming. */
export const PRODUCTIVE_CHALLENGE_STATUSES = [
  'OPEN',
  'UNDER_REVIEW',
  'UPHELD',
  'REJECTED',
  'CORRECTED',
  'SUPERSEDED',
] as const;
export type ProductiveChallengeStatus = (typeof PRODUCTIVE_CHALLENGE_STATUSES)[number];

export const PRODUCTIVE_CHALLENGE_REASONS = [
  'DATA_INTEGRITY',
  'SOURCE_COMPROMISE',
  'METHODOLOGY_DISPUTE',
  'CAPACITY_EXCEEDED',
  'DUPLICATE_EVENT',
  'GEOGRAPHY_MISMATCH',
  'STALE_EVIDENCE',
  'RIGHTS_DEFICIENCY',
  'PROVIDER_CORRECTION',
  'POST_FINALITY_REVIEW',
] as const;
export type ProductiveChallengeReason = (typeof PRODUCTIVE_CHALLENGE_REASONS)[number];

export type ProductiveClaimChallenge = {
  readonly schemaVersion: typeof PRODUCTIVE_OPERATIONS_SCHEMA_VERSION;
  readonly challengeId: string;
  readonly claimId: string;
  readonly status: ProductiveChallengeStatus;
  readonly reason: ProductiveChallengeReason;
  readonly challengerId: string;
  readonly evidenceCommitment: string;
  readonly openedAtUtc: UtcInstant;
  readonly resolvedAtUtc: UtcInstant | null;
  readonly resolutionNote: string | null;
  readonly postFinality: boolean;
  readonly supersedingClaimId: string | null;
  readonly correctingClaimId: string | null;
};

/** Governance mechanisms required for corrective monetary action after post-finality challenge. */
export const CORRECTIVE_ACTION_REQUIREMENTS = [
  'GOVERNANCE_REVIEW',
  'MULTI_PARTY_AUTHORIZATION',
  'COMPENSATING_GOVERNED_TRANSACTION',
  'PARAMETER_PACKAGE_AMENDMENT',
  'MANUAL_COUNSEL_REVIEW',
] as const;
export type CorrectiveActionRequirement = (typeof CORRECTIVE_ACTION_REQUIREMENTS)[number];

export type PostFinalityChallengeRecord = {
  readonly schemaVersion: typeof PRODUCTIVE_OPERATIONS_SCHEMA_VERSION;
  readonly challengeId: string;
  readonly claimId: string;
  readonly issuanceReceiptId: string | null;
  readonly historicalBlockHeight: number;
  readonly historicalBlockId: string;
  readonly historyRewritten: false;
  readonly automaticClawback: false;
  readonly silentBurn: false;
  readonly requiredCorrectiveActions: readonly CorrectiveActionRequirement[];
  readonly recordedAtUtc: UtcInstant;
};

/** Oracle / provider incident classifications. */
export const PROVIDER_INCIDENT_CLASSES = [
  'PROVIDER_OUTAGE',
  'AUTH_FAILURE',
  'SCHEMA_BREAK',
  'DATA_INTEGRITY_FAILURE',
  'SOURCE_COMPROMISE_SUSPECTED',
  'LICENSE_CHANGE',
  'EXTREME_OUTLIER',
  'SYSTEMATIC_BIAS_SUSPECTED',
] as const;
export type ProviderIncidentClass = (typeof PROVIDER_INCIDENT_CLASSES)[number];

export const INCIDENT_CONTAINMENT_ACTIONS = [
  'DISABLE_PROVIDER',
  'QUARANTINE_DATA',
  'STOP_DOMAIN_VERIFICATION',
  'REQUIRE_MANUAL_REVIEW',
] as const;
export type IncidentContainmentAction = (typeof INCIDENT_CONTAINMENT_ACTIONS)[number];

export type ProviderIncident = {
  readonly schemaVersion: typeof PRODUCTIVE_OPERATIONS_SCHEMA_VERSION;
  readonly incidentId: string;
  readonly providerId: string;
  readonly sourceClass: string | null;
  readonly classification: ProviderIncidentClass;
  readonly containmentActions: readonly IncidentContainmentAction[];
  readonly domainScope: ProductiveCategory | 'ALL_DOMAINS';
  readonly evidenceCommitment: string;
  readonly openedAtUtc: UtcInstant;
  readonly resolvedAtUtc: UtcInstant | null;
  readonly blockchainPaused: false;
};

/** Domain circuit breaker — fail-closed per productive category. */
export const DOMAIN_CIRCUIT_STATES = ['CLOSED', 'OPEN', 'HALF_OPEN'] as const;
export type DomainCircuitState = (typeof DOMAIN_CIRCUIT_STATES)[number];

export type DomainCircuitBreaker = {
  readonly schemaVersion: typeof PRODUCTIVE_OPERATIONS_SCHEMA_VERSION;
  readonly domain: ProductiveCategory;
  readonly state: DomainCircuitState;
  readonly reason: string;
  readonly independentSourceCoverage: number;
  readonly requiredIndependentSources: number;
  readonly openedAtUtc: UtcInstant | null;
  readonly transfersPaused: false;
};

/** Anomaly review signal — not automatic monetary judgment. */
export const ANOMALY_SIGNAL_KINDS = [
  'PRODUCTION_EXCEEDS_CAPACITY',
  'RETIRED_FACILITY_OUTPUT',
  'IMPOSSIBLE_GEOGRAPHIC_MOVEMENT',
  'EXTREME_COMPUTE_OUTPUT',
  'DUPLICATE_EVENT_FREQUENCY',
  'WATER_OUTPUT_EXCEEDS_BOUNDS',
  'MANUFACTURING_EXCEEDS_THROUGHPUT',
] as const;
export type AnomalySignalKind = (typeof ANOMALY_SIGNAL_KINDS)[number];

export type ProductiveAssetAnomaly = {
  readonly schemaVersion: typeof PRODUCTIVE_OPERATIONS_SCHEMA_VERSION;
  readonly anomalyId: string;
  readonly objectId: string;
  readonly claimId: string | null;
  readonly kind: AnomalySignalKind;
  readonly domain: ProductiveCategory;
  readonly severity: 'LOW' | 'MEDIUM' | 'HIGH';
  readonly reviewSignalOnly: true;
  readonly automaticMonetaryJudgment: false;
  readonly detectedAtUtc: UtcInstant;
  readonly evidenceCommitment: string;
};

export type ProductiveOperationsRejectionCode =
  | 'CHALLENGE_NOT_FOUND'
  | 'INVALID_CHALLENGE_TRANSITION'
  | 'CLAIM_NOT_FOUND'
  | 'PROVIDER_ALREADY_DISABLED'
  | 'DOMAIN_CIRCUIT_OPEN'
  | 'AI_CANNOT_OVERRIDE_HARD_RULE'
  | 'AI_CANNOT_DECLARE_FACT_VALID'
  | 'AI_CANNOT_APPROVE_ISSUANCE'
  | 'POST_FINALITY_HISTORY_IMMUTABLE'
  | 'AUTOMATIC_CLAWBACK_FORBIDDEN';

export type ProductiveOperationsRejection = {
  readonly code: ProductiveOperationsRejectionCode;
  readonly detail: string;
};
