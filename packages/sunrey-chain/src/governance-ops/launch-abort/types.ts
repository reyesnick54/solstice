/**
 * Chunk 167 — launch abort, domain-scoped emergency restrictions,
 * rollback semantics, recovery gates, and resumption authorization.
 *
 * Extends Chunk 79 governance-ops emergency authority. Does not create
 * a second emergency authority, global kill switch, or super-admin.
 */

import type {
  EmergencyActionClass,
  EmergencyActionRecord,
  RestrictionState,
} from '../types.ts';
import type { IndependentCapability } from '../../post-genesis/types.ts';

export const LAUNCH_ABORT_SCHEMA_VERSION = 1 as const;
export const LAUNCH_ABORT_DOMAIN = 'sunrey.governance.launch-abort.v1' as const;
export const GLOBAL_SUPER_ADMIN_EXISTS = false as const;
export const EMERGENCY_CAN_MINT = false as const;
export const EMERGENCY_CAN_REWRITE_SUPPLY = false as const;
export const EMERGENCY_CAN_REWRITE_FINALIZED_HISTORY = false as const;
export const EMERGENCY_CAN_CONFISCATE = false as const;
export const RESTRICTIONS_DOMAIN_SCOPED = true as const;
export const INCIDENT_END_AUTO_RESUMES = false as const;
export const AI_CAN_AUTHORIZE_EMERGENCY = false as const;
export const PRODUCTION_ACTIVE = false as const;
export const APPLICATION_ROLLBACK_IS_NOT_CHAIN_HISTORY_ROLLBACK = true as const;

export const PRE_GENESIS_ABORT_REASONS = [
  'CANDIDATE_INTEGRITY',
  'CEREMONY_DEFECT',
  'AUTHORIZATION_INCOMPLETE',
  'PROVIDER_EVIDENCE_REVOKED',
  'SECURITY_FINDING',
  'OPERATOR_HOLD',
  'EXTERNAL_BLOCKER',
] as const;
export type PreGenesisAbortReason = (typeof PRE_GENESIS_ABORT_REASONS)[number];

export const CEREMONY_ABORT_PHASES = [
  'BEFORE_GENESIS',
  'DURING_CEREMONY',
] as const;
export type CeremonyAbortPhase = (typeof CEREMONY_ABORT_PHASES)[number];

export const RECOVERY_DOMAINS = [
  'ORACLE',
  'MOONREY_ISSUANCE',
  'SUNREY_ISSUANCE',
  'HSM_CUSTODY',
  'PAYMENT_RAIL',
  'BANKING_RAIL',
  'HUMAN_INFORMATION_MARKET',
  'COMPLIANCE',
  'DATABASE',
  'CHAIN_FINALITY',
  'PROVIDER_BINDING',
  'APPLICATION_RELEASE',
] as const;
export type RecoveryDomain = (typeof RECOVERY_DOMAINS)[number];

export const RESUMPTION_STATES = [
  'INELIGIBLE',
  'CANDIDATE',
  'AWAITING_HUMAN_APPROVAL',
  'AUTHORIZED',
  'REJECTED',
] as const;
export type ResumptionState = (typeof RESUMPTION_STATES)[number];

export const RECOVERY_GATE_STATES = [
  'BLOCKED',
  'RECONCILIATION_REQUIRED',
  'READY_FOR_RESUMPTION_REVIEW',
] as const;
export type RecoveryGateState = (typeof RECOVERY_GATE_STATES)[number];

export type LaunchAbortEvidence = {
  readonly incidentId: string;
  readonly candidateFreezeHash: string | null;
  readonly activePolicyHashes: readonly string[];
  readonly chainHeight: number | null;
  readonly stateRoot: string | null;
  readonly providerState: string;
  readonly reconciliationState: 'CLEAN' | 'MISMATCH' | 'UNKNOWN' | 'NOT_APPLICABLE';
  readonly operatorActions: readonly string[];
  readonly containsRawSecrets: false;
};

export type PreGenesisAbortRecord = {
  readonly abortId: string;
  readonly reason: PreGenesisAbortReason;
  readonly phase: 'BEFORE_GENESIS';
  readonly candidateFreezeHash: string;
  readonly ceremonyTranscriptHash: string | null;
  readonly evidence: LaunchAbortEvidence;
  readonly operatorActions: readonly string[];
  readonly createdChainHistory: false;
  readonly createdGenesisBlock: false;
  readonly migratedBalances: false;
  readonly productionActive: false;
};

export type CeremonyAbortRecord = {
  readonly abortId: string;
  readonly phase: CeremonyAbortPhase;
  readonly reason: PreGenesisAbortReason;
  readonly ceremonyTranscriptHash: string;
  readonly transcriptPreserved: true;
  readonly createdGenesisBlock: false;
  readonly createdChainHistory: false;
  readonly evidence: LaunchAbortEvidence;
};

export type ApplicationRollbackPlan = {
  readonly planId: string;
  readonly releaseHash: string;
  readonly configurationHash: string;
  readonly schemaCompatible: boolean;
  readonly dataMigrationCompatible: boolean;
  readonly approval: string | null;
  readonly postRollbackVerification: string | null;
  readonly rewritesChainHistory: false;
  readonly applicationRollbackIsNotChainHistoryRollback: true;
  readonly accepted: boolean;
  readonly rejectionReason: string | null;
};

export type ProtocolRollbackAttempt = {
  readonly attemptId: string;
  readonly method: 'GIT_CHECKOUT' | 'GOVERNED_UPGRADE';
  readonly accepted: boolean;
  readonly rejectionReason: string | null;
  readonly requiresGovernance: true;
  readonly rewritesFinalizedState: false;
};

export type DomainRestrictionPlan = {
  readonly incidentId: string;
  readonly domain: RecoveryDomain;
  readonly actions: readonly EmergencyActionClass[];
  readonly scopedCapabilities: readonly IndependentCapability[];
  readonly unrelatedCapabilitiesRemainAvailable: true;
  readonly suspendsCanonicalDomainOwner: false;
  readonly deletesFinalizedBalances: false;
  readonly rewritesSupply: false;
};

export type CapabilityResumptionCandidate = {
  readonly candidateId: string;
  readonly capability: IndependentCapability;
  readonly incidentId: string;
  readonly restriction: EmergencyActionRecord;
  readonly rootCauseAddressed: boolean;
  readonly reconciliationClean: boolean;
  readonly providerEvidenceCurrent: boolean;
  readonly securityReviewComplete: boolean;
  readonly controlRoomHealthy: boolean;
  readonly humanApproval: string | null;
  readonly incidentResolved: boolean;
  readonly state: ResumptionState;
  readonly runtimeEnabled: boolean;
  readonly incidentEndAutoResumed: false;
  readonly aiAuthorized: false;
  readonly productionActive: false;
};

export type EmergencyRecommendation = {
  readonly recommendationId: string;
  readonly actorKind: 'AI';
  readonly summary: string;
  readonly recommendedClasses: readonly EmergencyActionClass[];
  readonly mayActivateEmergencyAuthority: false;
  readonly mayResumeCapability: false;
  readonly mayRewriteBalance: false;
  readonly mayMint: false;
  readonly maySignGovernanceAction: false;
};

export type RecoveryGate = {
  readonly domain: RecoveryDomain;
  readonly state: RecoveryGateState;
  readonly reconciled: boolean;
  readonly restoredApplicationDbIsSupplyAuthority: false;
  readonly restoredApplicationDbIsChainHistory: false;
  readonly reasons: readonly string[];
};

export type PaymentUnknownRecovery = {
  readonly decision: 'QUERY' | 'RECONCILE' | 'RETRY_FORBIDDEN';
  readonly queryRequiredBeforeRetry: true;
  readonly incidentPressureAuthorizesBlindResubmission: false;
  readonly retryClass: 'DO_NOT_RETRY_WITHOUT_QUERY';
};

export type HsmCompromiseRecovery = {
  readonly signingDisabled: true;
  readonly credentialBindingsRevoked: true;
  readonly signingRouteSuspended: true;
  readonly priorSignaturesPreserved: true;
  readonly recoveryCeremonyStarted: true;
  readonly assetsTransferredAutomatically: false;
};

export type SupplyMismatchIncident = {
  readonly severity: 'HIGH' | 'CRITICAL';
  readonly newIssuanceRestricted: true;
  readonly supplyNumbersEditedToMatch: false;
  readonly reconciliationRequired: true;
};
