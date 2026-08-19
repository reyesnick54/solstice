import { asUtcInstant } from '../../../domain/src/time.ts';
import { CONTRIBUTION_CLASSES, type ContributionClass } from '../taxonomy.ts';
import { jurisdictionPolicyRefFor, policyRuleRefFor, valuationPolicyIdFor, valuationPolicyVersionFor } from './ids.ts';
import type {
  HumanContributionValuationPolicy,
  MethodEligibilityRule,
  ValuationFactor,
  ValuationMethod,
  ValuationReferenceSourceClass,
} from './types.ts';

const DEFAULT_SOURCE_BY_METHOD: Readonly<Record<ValuationMethod, ValuationReferenceSourceClass>> = Object.freeze({
  CONTRACTUAL_COMPENSATION: 'CONTRACTUAL_TERM',
  GOVERNED_FIXED_SCHEDULE: 'GOVERNED_FIXED_SCHEDULE',
  INFORMATION_USAGE_RIGHT_SCHEDULE: 'INFORMATION_RIGHT_USAGE_SCHEDULE',
  PROFESSIONAL_SERVICE_SCHEDULE: 'APPROVED_PROFESSIONAL_RATE_SCHEDULE',
  CREATOR_ROYALTY_SCHEDULE: 'ROYALTY_SCHEDULE',
  RESEARCH_PARTICIPATION_SCHEDULE: 'APPROVED_RESEARCH_COMPENSATION_SCHEDULE',
  COMMUNITY_CONTRIBUTION_SCHEDULE: 'COMMUNITY_CONTRIBUTION_SCHEDULE',
  MARKET_REFERENCE: 'APPROVED_MARKET_REFERENCE',
  VERIFIED_OUTCOME_ATTRIBUTION: 'OUTCOME_ATTRIBUTION_SCHEDULE',
});

const DEFAULT_METHOD_BY_CLASS: Readonly<Record<ContributionClass, ValuationMethod>> = Object.freeze({
  INFORMATION_RIGHT_CONTRIBUTION: 'INFORMATION_USAGE_RIGHT_SCHEDULE',
  VERIFIED_KNOWLEDGE_CONTRIBUTION: 'GOVERNED_FIXED_SCHEDULE',
  CREATIVE_PRODUCTION: 'GOVERNED_FIXED_SCHEDULE',
  RESEARCH_PARTICIPATION: 'RESEARCH_PARTICIPATION_SCHEDULE',
  PROFESSIONAL_EXPERTISE: 'PROFESSIONAL_SERVICE_SCHEDULE',
  ECONOMIC_PARTICIPATION: 'MARKET_REFERENCE',
  COMMUNITY_CONTRIBUTION: 'COMMUNITY_CONTRIBUTION_SCHEDULE',
  EDUCATION_SKILL_ATTESTATION: 'GOVERNED_FIXED_SCHEDULE',
  MODEL_TRAINING_PARTICIPATION: 'INFORMATION_USAGE_RIGHT_SCHEDULE',
  HUMAN_SERVICE_DELIVERY: 'PROFESSIONAL_SERVICE_SCHEDULE',
  ENTREPRENEURIAL_ACTIVITY: 'CONTRACTUAL_COMPENSATION',
  CREATOR_ROYALTY_EVENT: 'CREATOR_ROYALTY_SCHEDULE',
  OTHER_GOVERNED_HUMAN_CONTRIBUTION: 'GOVERNED_FIXED_SCHEDULE',
});

function identityFactor(seed: string): ValuationFactor {
  return Object.freeze({
    factorType: 'QUALITY',
    inputRef: `factor:${seed}`,
    numerator: 1n,
    denominator: 1n,
    basisPoints: 10_000n,
    reasonCode: 'METHOD_SELECTED',
    policyRuleRef: policyRuleRefFor(seed),
  });
}

function eligibilityFor(contributionClass: ContributionClass): MethodEligibilityRule {
  const method = DEFAULT_METHOD_BY_CLASS[contributionClass];
  return Object.freeze({
    contributionClass,
    methods: Object.freeze([method]),
    requiredEvidenceMin: 1,
    requiredReferenceSource: DEFAULT_SOURCE_BY_METHOD[method],
  });
}

export const DEFAULT_VALUATION_POLICY_ID = valuationPolicyIdFor('sunrey-human-contribution-valuation-v1');
export const DEFAULT_VALUATION_POLICY_VERSION = valuationPolicyVersionFor('sunrey-human-contribution-valuation-v1');

export function createSimulationValuationPolicy(
  overrides: Partial<HumanContributionValuationPolicy> = {},
): HumanContributionValuationPolicy {
  return Object.freeze({
    valuationPolicyId: DEFAULT_VALUATION_POLICY_ID,
    valuationPolicyVersion: DEFAULT_VALUATION_POLICY_VERSION,
    status: 'ACTIVE',
    effectiveFrom: asUtcInstant('2026-01-01T00:00:00.000Z'),
    effectiveUntil: null,
    jurisdictions: Object.freeze(['GB', 'US', 'IE', 'DE', 'FR']),
    jurisdictionPolicyRef: jurisdictionPolicyRefFor('simulation-gb-us'),
    roundingRule: 'ROUND_DOWN',
    allowNegative: false,
    zeroValueRequiresReview: false,
    minConfidenceBps: 5000n,
    maxReferenceAgeSeconds: 366n * 24n * 60n * 60n,
    maxFactorProductBps: 15_000n,
    globalCap: 1_000_000_000n,
    globalFloor: 0n,
    methodCaps: Object.freeze({
      CONTRACTUAL_COMPENSATION: 50_000_000n,
      GOVERNED_FIXED_SCHEDULE: 10_000_000n,
      INFORMATION_USAGE_RIGHT_SCHEDULE: 5_000_000n,
      PROFESSIONAL_SERVICE_SCHEDULE: 25_000_000n,
      CREATOR_ROYALTY_SCHEDULE: 25_000_000n,
      RESEARCH_PARTICIPATION_SCHEDULE: 5_000_000n,
      COMMUNITY_CONTRIBUTION_SCHEDULE: 1_000_000n,
      MARKET_REFERENCE: 10_000_000n,
      VERIFIED_OUTCOME_ATTRIBUTION: 10_000_000n,
    }),
    eligibility: Object.freeze(CONTRIBUTION_CLASSES.map(eligibilityFor)),
    allowedFactors: Object.freeze([
      'QUALITY',
      'REALIZATION',
      'RIGHTS_SCOPE',
      'USAGE',
      'OUTCOME_ATTRIBUTION',
      'FRESHNESS',
      'JURISDICTION_POLICY',
    ]),
    defaultFactors: Object.freeze([identityFactor('default-quality')]),
    outcomeAttributionRequiresExplicitEvidence: true,
    correction: Object.freeze({
      allowCorrectedSuccessor: true,
      allowSupersededRecord: false,
      allowUnverifiedCorrection: false,
    }),
    productionEligible: false,
    createsMintAuthority: false,
    createsExecutionAuthority: false,
    ...overrides,
  });
}

export const DEFAULT_SIMULATION_VALUATION_POLICY = createSimulationValuationPolicy();

export function requiredReferenceSource(method: ValuationMethod): ValuationReferenceSourceClass {
  return DEFAULT_SOURCE_BY_METHOD[method];
}

export function defaultMethodForClass(contributionClass: ContributionClass): ValuationMethod {
  return DEFAULT_METHOD_BY_CLASS[contributionClass];
}
