import { createHash } from 'node:crypto';

import { asQualificationPolicyId, type QualificationPolicyId } from './ids.ts';

export const QUALIFICATION_POLICY_VERSION = 'qual-policy-v1' as const;

export type QualificationMetricThreshold = {
  readonly metric: string;
  readonly min?: number;
  readonly max?: number;
  readonly required?: boolean;
};

export type QualificationPolicy = {
  readonly policyId: QualificationPolicyId;
  readonly version: string;
  readonly policyHash: string;
  readonly applicableStrategyClass: string;
  readonly requiredEvaluationTypes: readonly ('TRAIN' | 'VALIDATION' | 'OUT_OF_SAMPLE_TEST' | 'WALK_FORWARD' | 'STRESS')[];
  readonly minimumEvaluationDays: number;
  readonly minimumOpportunityCount: number;
  readonly maxDrawdownBps: number;
  readonly maxLossMinor: bigint | null;
  readonly benchmarkRelativeMinBps: number | null;
  readonly costSensitivityRequired: boolean;
  readonly robustnessWindowCount: number;
  readonly futureLeakageForbidden: true;
  readonly reproducibilityRequired: true;
  readonly knownLimitationsMustBeAccepted: true;
  readonly shadowMinimumDurationDays: number;
  readonly shadowMinimumDecisions: number;
  readonly shadowMinimumNoActionDecisions: number;
  readonly shadowRegimeCoverageRequired: boolean;
  readonly shadowMaxDrawdownProxyBps: number;
  readonly shadowCostSensitivityRequired: boolean;
  readonly shadowBenchmarkComparisonRequired: boolean;
  readonly shadowCalibrationRequired: boolean;
  readonly paperEligibilityExpiryDays: number;
  readonly reviewIntervalDays: number;
  readonly authorityRequired: 'QUALIFICATION_SERVICE' | 'HUMAN_GOVERNANCE';
  readonly liveExecutionPermitted: false;
};

const DEFAULT_POLICY_BODY = Object.freeze({
  applicableStrategyClass: 'RESEARCH_STRATEGY',
  requiredEvaluationTypes: Object.freeze(['OUT_OF_SAMPLE_TEST', 'STRESS'] as const),
  minimumEvaluationDays: 14,
  minimumOpportunityCount: 3,
  maxDrawdownBps: 2500,
  maxLossMinor: null as bigint | null,
  benchmarkRelativeMinBps: null as number | null,
  costSensitivityRequired: true,
  robustnessWindowCount: 1,
  futureLeakageForbidden: true as const,
  reproducibilityRequired: true as const,
  knownLimitationsMustBeAccepted: true as const,
  shadowMinimumDurationDays: 7,
  shadowMinimumDecisions: 5,
  shadowMinimumNoActionDecisions: 1,
  shadowRegimeCoverageRequired: false,
  shadowMaxDrawdownProxyBps: 1500,
  shadowCostSensitivityRequired: true,
  shadowBenchmarkComparisonRequired: false,
  shadowCalibrationRequired: false,
  paperEligibilityExpiryDays: 90,
  reviewIntervalDays: 30,
  authorityRequired: 'QUALIFICATION_SERVICE' as const,
  liveExecutionPermitted: false as const,
});

function policyHash(body: Omit<QualificationPolicy, 'policyId' | 'policyHash'>): string {
  return createHash('sha256')
    .update(
      JSON.stringify(body, (_key, value) => (typeof value === 'bigint' ? value.toString() : value)),
    )
    .digest('hex');
}

export function createQualificationPolicy(
  overrides: Partial<Omit<QualificationPolicy, 'policyId' | 'policyHash' | 'version' | 'liveExecutionPermitted'>> = {},
): QualificationPolicy {
  const body = {
    ...DEFAULT_POLICY_BODY,
    ...overrides,
    version: QUALIFICATION_POLICY_VERSION,
    liveExecutionPermitted: false as const,
  };
  const hash = policyHash(body);
  return Object.freeze({
    policyId: asQualificationPolicyId(`qpol_${hash.slice(0, 16)}`),
    policyHash: hash,
    ...body,
  });
}

export const DEFAULT_QUALIFICATION_POLICY = createQualificationPolicy();
