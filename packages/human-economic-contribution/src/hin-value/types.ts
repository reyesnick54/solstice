import type { UtcInstant } from '../../../domain/src/time.ts';
import type { ContributionId, SubjectRef } from '../ids.ts';
import type { ContributionClass, MeasurementUnit, SourceClass } from '../taxonomy.ts';
import type { HinProductCategory } from './categories.ts';
import type { HinVerificationState } from './verification.ts';

export const HIN_VALUE_SCHEMA_VERSION = 1 as const;
export const HIN_ECONOMIC_VALUE_INPUT_UNIT = 'HIN_ECONOMIC_VALUE_INPUT_UNIT' as const;

export const HIN_ACTORS = [
  'AUTHORIZED_SOURCE',
  'AUTHORIZED_VERIFIER',
  'GOVERNANCE',
  'FRONTEND',
  'AGENT',
  'AI',
] as const;
export type HinActorKind = (typeof HIN_ACTORS)[number];

export const HIN_FAILURE_CODES = [
  'UNAUTHORIZED_ACTOR',
  'FRONTEND_CANNOT_VERIFY',
  'AGENT_CANNOT_VERIFY',
  'AGENT_CANNOT_MINT',
  'AI_CANNOT_VERIFY',
  'AI_CANNOT_SET_POLICY',
  'AI_CANNOT_SET_MINT',
  'AI_CANNOT_APPROVE_ISSUANCE',
  'ANONYMOUS_CONTRIBUTION_FORBIDDEN',
  'CONSENT_REQUIRED',
  'RIGHTS_REQUIRED',
  'PROVENANCE_INCOMPLETE',
  'DUPLICATE_CONTRIBUTION',
  'REPLAYED_EVENT',
  'CATEGORY_UNKNOWN',
  'CONTRIBUTION_NOT_FOUND',
  'ALREADY_DISPUTED',
  'NOT_DISPUTED',
  'QUALITY_BELOW_THRESHOLD',
  'CAP_EXCEEDED',
  'VALUE_INPUT_INELIGIBLE',
  'RAW_PERSONAL_DATA_FORBIDDEN',
  'PROTECTED_TRAIT_FORBIDDEN',
  'MINT_FORBIDDEN',
  'ISSUANCE_NOT_AUTHORIZED',
] as const;
export type HinFailureCode = (typeof HIN_FAILURE_CODES)[number];

export type HinFailure = {
  readonly code: HinFailureCode;
  readonly message: string;
};

export function hinFailure(code: HinFailureCode, message: string): HinFailure {
  return Object.freeze({ code, message });
}

export type HinActor = {
  readonly kind: HinActorKind;
  readonly actorId: string;
};

export type HinProvenance = {
  readonly source: SourceClass;
  readonly method: string;
  readonly observedAt: UtcInstant;
  readonly rightsReference: string | null;
  readonly consentReference: string | null;
  readonly verificationReference: string | null;
  readonly integrityDigest: string;
};

export type HinContributionRecord = {
  readonly schemaVersion: typeof HIN_VALUE_SCHEMA_VERSION;
  readonly contributionId: ContributionId;
  readonly subject: SubjectRef;
  readonly category: HinProductCategory;
  readonly canonicalClass: ContributionClass;
  readonly source: SourceClass;
  readonly sourceReference: string;
  readonly verification: HinVerificationState;
  readonly provenance: HinProvenance;
  readonly rightsReference: string | null;
  readonly purpose: string | null;
  readonly observedAt: UtcInstant;
  readonly quantity: bigint;
  readonly unit: MeasurementUnit;
  readonly qualityBps: bigint;
  readonly confidenceBps: bigint;
  readonly status: HinVerificationState;
  readonly valuationPolicyVersion: string | null;
  readonly economicValueInputId: string | null;
  readonly evidenceDigest: string;
  readonly containsRawPersonalData: false;
  readonly sunReyQuantity: null;
  readonly mintRequested: false;
  readonly issuancePromised: false;
};

export type HinEconomicValueInput = {
  readonly schema: 'sunrey.hin.economic-value-input.v1';
  readonly valueInputId: string;
  readonly contributionId: ContributionId;
  readonly methodologyId: string;
  readonly methodologyVersion: string;
  readonly inputs: {
    readonly quantity: string;
    readonly unit: MeasurementUnit;
    readonly qualityBps: string;
    readonly confidenceBps: string;
    readonly verificationState: HinVerificationState;
    readonly verificationWeightBps: string;
  };
  readonly normalizedValue: bigint;
  readonly denomination: typeof HIN_ECONOMIC_VALUE_INPUT_UNIT;
  readonly confidenceBps: bigint;
  readonly timestamp: UtcInstant;
  readonly provenanceDigest: string;
  readonly isSunReyQuantity: false;
  readonly isMintAmount: false;
  readonly isMarketPrice: false;
  readonly productionActivated: false;
};

export const HIN_DISPUTE_KINDS = [
  'CHALLENGE_CONTRIBUTION',
  'CHALLENGE_ATTRIBUTION',
  'CHALLENGE_VALUATION_INPUT',
  'SOURCE_CORRECTION',
  'INVALIDATE_CONTRIBUTION',
] as const;
export type HinDisputeKind = (typeof HIN_DISPUTE_KINDS)[number];

export const HIN_DISPUTE_STATES = ['OPEN', 'UPHELD', 'REJECTED', 'CORRECTED'] as const;
export type HinDisputeState = (typeof HIN_DISPUTE_STATES)[number];

export type HinDispute = {
  readonly disputeId: string;
  readonly contributionId: ContributionId;
  readonly kind: HinDisputeKind;
  readonly state: HinDisputeState;
  readonly openedAt: UtcInstant;
  readonly openedBy: string;
  readonly reasonCode: string;
  readonly resolvedAt: UtcInstant | null;
  readonly historicalEvidencePreserved: true;
};

export type HinAnomalyFlag = {
  readonly flagId: string;
  readonly contributionId: ContributionId;
  readonly code: 'DUPLICATE_PATTERN' | 'QUANTITY_SPIKE' | 'REPLAY_SUSPECT' | 'SELF_GENERATED_CLUSTER';
  readonly raisedBy: 'AI' | 'SYSTEM';
  readonly determinesMint: false;
};

export type HinIssuanceBasisProposal = {
  readonly schema: 'sunrey.hin.issuance-basis-proposal.v1';
  readonly proposalId: string;
  readonly kind: 'ECONOMIC_INPUT_ISSUANCE_BASIS';
  readonly contributionId: ContributionId;
  readonly economicValueInputId: string;
  readonly normalizedValue: string;
  readonly denomination: typeof HIN_ECONOMIC_VALUE_INPUT_UNIT;
  readonly methodologyId: string;
  readonly methodologyVersion: string;
  readonly mintRequested: false;
  readonly sunReyQuantity: null;
  readonly requiresPhaseGGovernance: true;
  readonly requiresNativeAssetAuthority: true;
  readonly productionActivated: false;
  readonly aiApproved: false;
};

export type HinCustomerContributionView = {
  readonly contributionId: ContributionId;
  readonly category: HinProductCategory;
  readonly verification: HinVerificationState;
  readonly observedAt: UtcInstant;
  readonly quantity: string;
  readonly unit: MeasurementUnit;
  readonly economicValueInput: string | null;
  readonly issuancePromised: false;
};

export type HinCustomerSummary = {
  readonly schema: 'sunrey.hin.customer-summary.v1';
  readonly subject: SubjectRef;
  readonly contributions: readonly HinCustomerContributionView[];
  readonly verified: readonly HinCustomerContributionView[];
  readonly pending: readonly HinCustomerContributionView[];
  readonly economicValueInputs: readonly {
    readonly valueInputId: string;
    readonly contributionId: ContributionId;
    readonly normalizedValue: string;
    readonly denomination: typeof HIN_ECONOMIC_VALUE_INPUT_UNIT;
    readonly isMintAmount: false;
  }[];
  readonly dataRights: readonly string[];
  readonly compensation: {
    readonly present: boolean;
    readonly mintRequested: false;
    readonly issuancePromised: false;
    readonly note: string;
  };
  readonly history: readonly HinCustomerContributionView[];
  readonly issuancePromised: false;
  readonly productionActivated: false;
};

export type HinAggregateMetrics = {
  readonly schema: 'sunrey.hin.aggregate-metrics.v1';
  readonly verifiedContributors: number;
  readonly contributionCategories: readonly { readonly category: HinProductCategory; readonly count: number }[];
  readonly contributionVolume: number;
  readonly economicValueInputs: {
    readonly count: number;
    readonly totalNormalized: string;
    readonly denomination: typeof HIN_ECONOMIC_VALUE_INPUT_UNIT;
    readonly isMintAmount: false;
  };
  readonly geographicSummaries: readonly { readonly jurisdiction: string; readonly count: number }[];
  readonly categoryGrowth: readonly { readonly category: HinProductCategory; readonly prior: number; readonly current: number }[];
  readonly qualityMetrics: {
    readonly meanQualityBps: string;
    readonly meanConfidenceBps: string;
    readonly systemVerifiedShareBps: string;
  };
  readonly suppression: {
    readonly kAnonymityThreshold: number;
    readonly jurisdictionsSuppressed: number;
    readonly individualRecordsExposed: false;
  };
  readonly productionActivated: false;
};
