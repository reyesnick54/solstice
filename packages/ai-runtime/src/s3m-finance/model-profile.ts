import type { UtcInstant } from '../../../domain/src/time.ts';
import { asModelId, asModelVersion } from '../../../model-registry/src/ids.ts';
import type { AiApprovedPurpose } from '../taxonomy.ts';
import type { InferenceLatencyClass, InferenceModelEnvironment } from '../catalog.ts';
import type { S3mFinanceHealthState, S3mFinanceQualificationState } from './taxonomy.ts';

export const S3M_FINANCE_PROFILE_KEY = 'S3M_FINANCE' as const;
export type S3mFinanceProfileKey = typeof S3M_FINANCE_PROFILE_KEY;

export const S3M_FINANCE_MODEL_ID = asModelId('mdl_sunrey_s3m_finance');
export const S3M_FINANCE_MODEL_VERSION = asModelVersion('s3m-finance-v0');
export const S3M_FINANCE_DEPLOYMENT_ID = 's3m-finance-external-pending';
export const S3M_FINANCE_SERVING_VERSION = 'serving-contract-v1';
export const S3M_FINANCE_MODEL_FAMILY = 'S3M_FINANCE';

export const S3M_FINANCE_APPROVED_PURPOSES: readonly AiApprovedPurpose[] = Object.freeze([
  'FINANCIAL_EXPLANATION',
  'GROWTH_PLANNING',
  'PORTFOLIO_REASONING',
  'STRUCTURED_PROPOSAL_NARRATION',
  'MARKET_OPPORTUNITY_RESEARCH',
  'GENERAL_ASSISTANT',
]);

export type S3mFinanceCapabilityProfile = {
  readonly privateContextReasoning: boolean;
  readonly specialistCoordination: boolean;
  readonly strategyResearch: boolean;
  readonly portfolioContextSynthesis: boolean;
  readonly critique: boolean;
  readonly structuredEconomicReasoning: boolean;
};

export type S3mFinancePrivacyCapability = {
  readonly authorizedContextClasses: readonly string[];
  readonly deploymentLocation: string | null;
  readonly dataRetentionPolicy: string | null;
  readonly loggingPolicy: string | null;
  readonly tenancyIsolation: string | null;
  readonly transportSecurity: string | null;
  readonly securityControls: readonly string[];
};

export type S3mFinanceModelProfile = {
  readonly profileKey: S3mFinanceProfileKey;
  readonly modelId: ReturnType<typeof asModelId>;
  readonly modelFamily: string;
  readonly deploymentId: string;
  readonly modelVersion: ReturnType<typeof asModelVersion>;
  readonly servingVersion: string;
  readonly capabilityProfile: S3mFinanceCapabilityProfile;
  readonly privacyCapability: S3mFinancePrivacyCapability;
  readonly allowedEnvironments: readonly InferenceModelEnvironment[];
  readonly supportsStructuredOutput: true;
  readonly supportsTools: boolean;
  readonly maxContextTokens: number;
  readonly maxOutputTokens: number;
  readonly latencyClass: InferenceLatencyClass;
  readonly qualificationState: S3mFinanceQualificationState;
  readonly approvalEvidenceRef: string | null;
  readonly approvalDate: UtcInstant | null;
  readonly endpointServiceIdentity: string | null;
  readonly healthState: S3mFinanceHealthState;
};

/**
 * Default S3M-Finance profile. Contract-ready but not qualified.
 * Does not claim an external S3M deployment is available.
 */
export function defaultS3mFinanceModelProfile(now: UtcInstant): S3mFinanceModelProfile {
  return Object.freeze({
    profileKey: S3M_FINANCE_PROFILE_KEY,
    modelId: S3M_FINANCE_MODEL_ID,
    modelFamily: S3M_FINANCE_MODEL_FAMILY,
    deploymentId: S3M_FINANCE_DEPLOYMENT_ID,
    modelVersion: S3M_FINANCE_MODEL_VERSION,
    servingVersion: S3M_FINANCE_SERVING_VERSION,
    capabilityProfile: Object.freeze({
      privateContextReasoning: false,
      specialistCoordination: false,
      strategyResearch: false,
      portfolioContextSynthesis: false,
      critique: false,
      structuredEconomicReasoning: false,
    }),
    privacyCapability: Object.freeze({
      authorizedContextClasses: Object.freeze(['PUBLIC_RESEARCH']),
      deploymentLocation: null,
      dataRetentionPolicy: null,
      loggingPolicy: null,
      tenancyIsolation: null,
      transportSecurity: null,
      securityControls: Object.freeze([]),
    }),
    allowedEnvironments: Object.freeze(['SIMULATION', 'SANDBOX'] as readonly InferenceModelEnvironment[]),
    supportsStructuredOutput: true,
    supportsTools: false,
    maxContextTokens: 32_768,
    maxOutputTokens: 4_096,
    latencyClass: 'STANDARD',
    qualificationState: 'NOT_CONFIGURED',
    approvalEvidenceRef: null,
    approvalDate: null,
    endpointServiceIdentity: null,
    healthState: 'UNKNOWN',
  });
}

export function withQualificationState(
  profile: S3mFinanceModelProfile,
  state: S3mFinanceQualificationState,
  input?: {
    readonly approvalEvidenceRef?: string | null;
    readonly approvalDate?: UtcInstant | null;
    readonly endpointServiceIdentity?: string | null;
    readonly healthState?: S3mFinanceHealthState;
    readonly privacyCapability?: Partial<S3mFinancePrivacyCapability>;
    readonly capabilityProfile?: Partial<S3mFinanceCapabilityProfile>;
    readonly supportsTools?: boolean;
  },
): S3mFinanceModelProfile {
  const privateQualified = state === 'QUALIFIED_PRIVATE_CONTEXT';
  const sandboxQualified = state === 'QUALIFIED_SANDBOX' || privateQualified;
  return Object.freeze({
    ...profile,
    qualificationState: state,
    approvalEvidenceRef: input?.approvalEvidenceRef ?? profile.approvalEvidenceRef,
    approvalDate: input?.approvalDate ?? profile.approvalDate,
    endpointServiceIdentity: input?.endpointServiceIdentity ?? profile.endpointServiceIdentity,
    healthState: input?.healthState ?? profile.healthState,
    supportsTools: input?.supportsTools ?? profile.supportsTools,
    capabilityProfile: Object.freeze({
      privateContextReasoning: privateQualified,
      specialistCoordination: sandboxQualified,
      strategyResearch: sandboxQualified,
      portfolioContextSynthesis: sandboxQualified,
      critique: sandboxQualified,
      structuredEconomicReasoning: sandboxQualified,
      ...(input?.capabilityProfile ?? {}),
    }),
    privacyCapability: Object.freeze({
      ...profile.privacyCapability,
      authorizedContextClasses: Object.freeze(
        privateQualified
          ? ['PEG_POSITION_SUMMARY', 'PEG_GOAL_SUMMARY', 'MARKET_OBSERVATION', 'WORK_ORDER_SCOPE', 'MANDATE_CONSTRAINT', 'PUBLIC_RESEARCH']
          : sandboxQualified
            ? ['MARKET_OBSERVATION', 'WORK_ORDER_SCOPE', 'PUBLIC_RESEARCH']
            : ['PUBLIC_RESEARCH'],
      ),
      ...(input?.privacyCapability ?? {}),
    }),
  });
}

export function onModelVersionChange(
  profile: S3mFinanceModelProfile,
  newVersion: ReturnType<typeof asModelVersion>,
): S3mFinanceModelProfile {
  const reset = Object.freeze({
    ...profile,
    modelVersion: newVersion,
    approvalEvidenceRef: null,
    approvalDate: null,
    endpointServiceIdentity: null,
    healthState: 'UNKNOWN' as const,
    capabilityProfile: Object.freeze({
      privateContextReasoning: false,
      specialistCoordination: false,
      strategyResearch: false,
      portfolioContextSynthesis: false,
      critique: false,
      structuredEconomicReasoning: false,
    }),
    privacyCapability: Object.freeze({
      ...profile.privacyCapability,
      authorizedContextClasses: Object.freeze(['PUBLIC_RESEARCH']),
    }),
    supportsTools: false,
  });
  return withQualificationState(reset, 'QUALIFICATION_PENDING');
}
