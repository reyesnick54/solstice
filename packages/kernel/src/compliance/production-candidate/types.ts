/**
 * Phase D Prompt 3 — provider-independent compliance adapter contracts.
 *
 * Provider results become normalized findings. Findings feed the
 * canonical Compliance Fabric and Kernel. A provider MATCH is not a
 * Kernel decision and never issues Execution Authority.
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { SecretReference } from '../../../../security/src/secrets.ts';
import type { CaseType, ScreeningOutcome, ScreeningType, SubjectKind } from '../types.ts';

export const COMPLIANCE_ADAPTER_CAPABILITY = 'sunrey-compliance-provider-adapters' as const;
export const COMPLIANCE_ADAPTER_VERSION = 'phase-d-03/1' as const;

export const PROVIDER_MATCH_STATES = [
  'NO_MATCH',
  'POSSIBLE_MATCH',
  'CONFIRMED_MATCH',
  'REQUIRES_REVIEW',
  'UNAVAILABLE',
] as const;
export type ProviderMatchState = (typeof PROVIDER_MATCH_STATES)[number];

export const COMPLIANCE_FINDING_KINDS = [
  'SANCTIONS',
  'PEP',
  'ADVERSE_MEDIA',
  'AML',
  'FRAUD',
  'TRAVEL_RULE',
  'BLOCKCHAIN_RISK',
  'KYC',
  'KYB',
] as const;
export type ComplianceFindingKind = (typeof COMPLIANCE_FINDING_KINDS)[number];

export const COMPLIANCE_FINDING_SEVERITIES = ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type ComplianceFindingSeverity = (typeof COMPLIANCE_FINDING_SEVERITIES)[number];

export const SCREENING_SUBJECTS = [
  'PERSON',
  'ORGANIZATION',
  'BENEFICIARY',
  'COUNTERPARTY',
  'WALLET',
  'DEVICE',
  'ACCOUNT',
] as const;
export type ScreeningSubject = (typeof SCREENING_SUBJECTS)[number];

export const AML_EVENT_SOURCES = [
  'PAYMENTS',
  'FX',
  'CARDS',
  'EXCHANGE',
  'CUSTODY',
  'WALLETS',
] as const;
export type AmlEventSource = (typeof AML_EVENT_SOURCES)[number];

export const FRAUD_RECOMMENDED_ACTIONS = [
  'ALLOW',
  'STEP_UP',
  'REVIEW',
  'HOLD',
  'BLOCK',
] as const;
export type FraudRecommendedAction = (typeof FRAUD_RECOMMENDED_ACTIONS)[number];

export const MONITORING_TRIGGERS = [
  'SANCTIONS_LIST_UPDATE',
  'PEP_STATUS_UPDATE',
  'KYC_EXPIRY',
  'BUSINESS_STATUS',
  'WALLET_RISK_CHANGE',
] as const;
export type MonitoringTrigger = (typeof MONITORING_TRIGGERS)[number];

export const COMPLIANCE_JOB_TYPES = [
  'COMPLIANCE_RESCREEN',
  'KYC_EXPIRY_CHECK',
  'SANCTIONS_LIST_UPDATE',
  'PEP_STATUS_UPDATE',
  'BUSINESS_STATUS_UPDATE',
  'WALLET_RISK_CHANGE',
] as const;
export type ComplianceJobType = (typeof COMPLIANCE_JOB_TYPES)[number];

export type ComplianceAdapterFlags = {
  readonly productionAuthorized: false;
  readonly productionActive: false;
  readonly liveVendorConnected: false;
  readonly providerResultIsKernelDecision: false;
  readonly providerMatchIsProhibition: false;
  readonly adapterCanPostJournal: false;
  readonly adapterCanIssueExecutionAuthority: false;
  readonly adapterCanEditLedger: false;
};

export const COMPLIANCE_ADAPTER_FLAGS: ComplianceAdapterFlags = Object.freeze({
  productionAuthorized: false,
  productionActive: false,
  liveVendorConnected: false,
  providerResultIsKernelDecision: false,
  providerMatchIsProhibition: false,
  adapterCanPostJournal: false,
  adapterCanIssueExecutionAuthority: false,
  adapterCanEditLedger: false,
});

export type ComplianceAdapterProfile = {
  readonly providerId: string;
  readonly version: string;
  readonly lifecycle: 'SIMULATED' | 'SANDBOX' | 'CERTIFICATION' | 'PREPRODUCTION';
  readonly environment: 'SIMULATION' | 'SANDBOX' | 'CERTIFICATION';
  readonly capabilities: readonly ComplianceFindingKind[];
  readonly health: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE';
  readonly certified: boolean;
  readonly credentialRef: SecretReference | null;
  readonly supportedJurisdictions: readonly string[];
  readonly dataProcessingAgreementRef: string | null;
  readonly retentionPolicyRef: string | null;
  readonly productionAuthorized: false;
  readonly liveVendorConnected: false;
};

export type NormalizedComplianceFinding = {
  readonly findingId: string;
  readonly kind: ComplianceFindingKind;
  readonly subjectKind: ScreeningSubject;
  readonly subjectRef: string;
  readonly providerId: string;
  readonly providerRef: string;
  readonly matchState: ProviderMatchState | null;
  readonly severity: ComplianceFindingSeverity;
  readonly reasonCodes: readonly string[];
  readonly score: number | null;
  readonly recommendedAction: FraudRecommendedAction | null;
  readonly policyResult: ScreeningOutcome | null;
  readonly caseId: string | null;
  readonly evidenceRefs: readonly string[];
  readonly observedAt: UtcInstant;
  readonly isKernelDecision: false;
  readonly isEligibilityDecision: false;
};

export type AmlSignal = {
  readonly signalId: string;
  readonly source: AmlEventSource;
  readonly subjectRef: string;
  readonly counterpartyRef: string | null;
  readonly amountMinor: bigint;
  readonly currency: string;
  readonly eventRef: string;
  readonly now: UtcInstant;
};

export type AmlProviderResult = {
  readonly signalId: string;
  readonly alert: boolean;
  readonly finding: NormalizedComplianceFinding;
  readonly duplicate: boolean;
};

export type FraudSignalInput = {
  readonly subjectRef: string;
  readonly sessionRef?: string;
  readonly deviceRef?: string;
  readonly transactionRef?: string;
  readonly recipientRef?: string;
  readonly cardAuthorizationRef?: string;
  readonly accountBehavior?: 'NORMAL' | 'UNUSUAL' | 'HIGH_VELOCITY';
  readonly now: UtcInstant;
};

export type FraudProviderResult = {
  readonly riskScore: number | null;
  readonly riskCategory: 'LOW' | 'STANDARD' | 'ELEVATED' | 'HIGH';
  readonly reasonCodes: readonly string[];
  readonly recommendedAction: FraudRecommendedAction;
  readonly finding: NormalizedComplianceFinding;
};

export function subjectToFabricKind(subject: ScreeningSubject): SubjectKind {
  if (subject === 'ORGANIZATION') return 'BUSINESS';
  if (subject === 'WALLET') return 'COUNTERPARTY';
  return subject;
}

export function matchStateToScreeningOutcome(state: ProviderMatchState): ScreeningOutcome {
  switch (state) {
    case 'NO_MATCH':
      return 'CLEAR';
    case 'POSSIBLE_MATCH':
    case 'REQUIRES_REVIEW':
      return 'REVIEW';
    case 'CONFIRMED_MATCH':
      return 'BLOCK';
    case 'UNAVAILABLE':
      return 'UNAVAILABLE';
  }
}

export function findingKindToScreeningType(kind: ComplianceFindingKind): ScreeningType | null {
  if (kind === 'SANCTIONS') return 'SANCTIONS';
  if (kind === 'PEP') return 'PEP';
  if (kind === 'ADVERSE_MEDIA') return 'ADVERSE_MEDIA';
  if (kind === 'AML') return 'TRANSACTION_MONITORING';
  if (kind === 'FRAUD') return 'FRAUD';
  return null;
}

export function findingKindToCaseType(kind: ComplianceFindingKind): CaseType | null {
  if (kind === 'SANCTIONS') return 'SANCTIONS_REVIEW';
  if (kind === 'PEP') return 'PEP_REVIEW';
  if (kind === 'AML') return 'AML_ALERT';
  if (kind === 'FRAUD') return 'FRAUD_ALERT';
  if (kind === 'ADVERSE_MEDIA') return 'PEP_REVIEW';
  return null;
}

export function providerFindingIsNotKernelDecision(): false {
  return false;
}

export function providerMatchIsNotProhibition(): false {
  return false;
}
