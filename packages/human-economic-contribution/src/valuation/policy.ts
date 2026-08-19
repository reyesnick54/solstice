import { ENGINEERING_SIMULATION_PARAMETERS, PRODUCTION_HUMAN_VALUATION_POLICY, type HumanContributionValuationPolicy } from './types.ts';

export const SIMULATION_VALUATION_POLICY_ID = 'sunrey.human-contribution.valuation.simulation.v1' as const;
export const SIMULATION_VALUATION_POLICY_VERSION = '1' as const;
export const SIMULATION_REFERENCE_DENOMINATION = 'HUMAN_CONTRIBUTION_REFERENCE_UNIT' as const;

/**
 * Engineering-simulation valuation policy. These scalars are labeled
 * ENGINEERING_SIMULATION_PARAMETERS and are not production tokenomics.
 */
export function simulationValuationPolicy(input?: {
  readonly policyId?: string;
  readonly version?: string;
  readonly environment?: 'DEVELOPMENT' | 'SIMULATION';
  readonly unitScaleNumerator?: bigint;
  readonly unitScaleDenominator?: bigint;
  readonly perContributionReferenceCeiling?: bigint;
  readonly jurisdictionPolicyRef?: string;
}): HumanContributionValuationPolicy {
  const unitScaleDenominator = input?.unitScaleDenominator ?? 1n;
  if (unitScaleDenominator <= 0n) {
    throw new TypeError('valuation policy denominator must be positive');
  }
  return Object.freeze({
    policyId: input?.policyId ?? SIMULATION_VALUATION_POLICY_ID,
    version: input?.version ?? SIMULATION_VALUATION_POLICY_VERSION,
    environment: input?.environment ?? 'SIMULATION',
    referenceDenomination: SIMULATION_REFERENCE_DENOMINATION,
    method: 'ENGINEERING_SIMULATION_MEASUREMENT_SCALE',
    unitScaleNumerator: input?.unitScaleNumerator ?? 100n,
    unitScaleDenominator,
    perContributionReferenceCeiling: input?.perContributionReferenceCeiling ?? 10_000n,
    jurisdictionPolicyRef: input?.jurisdictionPolicyRef ?? 'policy.sim.jurisdiction.unconfigured',
    governanceReference: 'sunrey.protocol.simulation.human-contribution-valuation.v1',
    effectiveFrom: '2026-08-19T00:00:00.000Z',
    effectiveUntil: null,
    simulationOnly: true,
    productionActivated: false,
    parameterClass: ENGINEERING_SIMULATION_PARAMETERS,
    peveUsedAsTokenFormula: false,
    humanWorthUsedAsValue: false,
  });
}

export function productionValuationPolicyUnavailable(): typeof PRODUCTION_HUMAN_VALUATION_POLICY {
  return PRODUCTION_HUMAN_VALUATION_POLICY;
}

export function validateValuationPolicy(policy: HumanContributionValuationPolicy): 'VALUATION_POLICY_INVALID' | 'PRODUCTION_VALUATION_UNAVAILABLE' | null {
  if (policy.productionActivated) {
    return 'PRODUCTION_VALUATION_UNAVAILABLE';
  }
  if (!policy.simulationOnly) {
    return 'PRODUCTION_VALUATION_UNAVAILABLE';
  }
  if (policy.parameterClass !== ENGINEERING_SIMULATION_PARAMETERS) {
    return 'VALUATION_POLICY_INVALID';
  }
  if (policy.unitScaleNumerator <= 0n || policy.unitScaleDenominator <= 0n) {
    return 'VALUATION_POLICY_INVALID';
  }
  if (policy.perContributionReferenceCeiling <= 0n) {
    return 'VALUATION_POLICY_INVALID';
  }
  if (policy.peveUsedAsTokenFormula || policy.humanWorthUsedAsValue) {
    return 'VALUATION_POLICY_INVALID';
  }
  if (policy.environment === undefined) {
    return 'VALUATION_POLICY_INVALID';
  }
  return null;
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
    ] as const),
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
  }) as HumanContributionValuationPolicy;
}

export const DEFAULT_SIMULATION_VALUATION_POLICY = createSimulationValuationPolicy();

export function requiredReferenceSource(method: ValuationMethod): ValuationReferenceSourceClass {
  return DEFAULT_SOURCE_BY_METHOD[method];
}

export function defaultMethodForClass(contributionClass: ContributionClass): ValuationMethod {
  return DEFAULT_METHOD_BY_CLASS[contributionClass];
import { err, ok, type Result } from '../../../domain/src/result.ts';
import { isUtcInstant, type UtcInstant } from '../../../domain/src/time.ts';
import type { ContributionClass } from '../taxonomy.ts';
import { isContributionClass } from '../taxonomy.ts';
import { isMethodEligibleForClass } from './eligibility.ts';
import { assertFactorRule, type RoundingRule, type ValuationFactorRule, ROUNDING_RULES } from './factors.ts';
import { scanForbiddenValuationInputs, isAllowedValuationInputType, type AllowedValuationInputType } from './inputs.ts';
import { isForbiddenValuationMethod, isPermittedValuationMethod, type PermittedValuationMethod } from './methods.ts';
import { valuationPolicyHashFor, type ValuationPolicyHash, type ValuationPolicyId, type ValuationPolicyVersion } from './ids.ts';
import { valuationFailure, type ValuationFailure } from './types.ts';
import type { ContributionReferenceValue } from './value.ts';
import { createContributionReferenceValue } from './value.ts';

export const VALUATION_POLICY_STATUSES = ['DEVELOPMENT', 'SIMULATION', 'PRODUCTION_CANDIDATE', 'SUPERSEDED'] as const;
export type ValuationPolicyStatus = (typeof VALUATION_POLICY_STATUSES)[number];

export type ValuationBound = {
  readonly amount: bigint;
  readonly denomination: string;
};

export type JurisdictionRule = {
  readonly jurisdiction: string;
  readonly allowed: boolean;
};

export type HumanContributionValuationPolicy = {
  readonly policyId: ValuationPolicyId;
  readonly version: ValuationPolicyVersion;
  readonly status: ValuationPolicyStatus;
  readonly contributionClass: ContributionClass;
  readonly method: PermittedValuationMethod;
  readonly allowedInputTypes: readonly AllowedValuationInputType[];
  readonly requiredEvidence: readonly string[];
  readonly referenceDenomination: string;
  readonly factorRules: readonly ValuationFactorRule[];
  readonly caps: ValuationBound | null;
  readonly floors: ValuationBound | null;
  readonly roundingRule: RoundingRule;
  readonly jurisdictionRules: readonly JurisdictionRule[];
  readonly effectiveFrom: UtcInstant;
  readonly effectiveUntil: UtcInstant | null;
  readonly governanceReference: string;
  readonly methodologyReference: string;
  readonly methodPriority: readonly PermittedValuationMethod[];
  readonly conflictToleranceBasisPoints: bigint | null;
  readonly productionActivated: false;
};

export type RegisterableValuationPolicy = Omit<HumanContributionValuationPolicy, 'productionActivated'> & {
  readonly productionActivated?: false;
};

function assertBound(bound: ValuationBound | null, label: string): Result<true, ValuationFailure> {
  if (bound === null) {
    return ok(true);
  }
  if (typeof bound.amount !== 'bigint') {
    return err(valuationFailure('FLOAT_MONETARY_MATH_FORBIDDEN', `${label} must use bigint amounts`));
  }
  return ok(true);
}

export function validateValuationPolicy(input: RegisterableValuationPolicy): Result<HumanContributionValuationPolicy, ValuationFailure> {
  const forbiddenPayload = scanForbiddenValuationInputs(input);
  if (!forbiddenPayload.ok) {
    return forbiddenPayload;
  }
  if (!isContributionClass(input.contributionClass)) {
    return err(valuationFailure('INVALID_POLICY', 'contributionClass is not a governed contribution class'));
  }
  if (isForbiddenValuationMethod(input.method)) {
    return err(valuationFailure('FORBIDDEN_VALUATION_METHOD', `method '${input.method}' is forbidden`));
  }
  if (!isPermittedValuationMethod(input.method)) {
    return err(valuationFailure('FORBIDDEN_VALUATION_METHOD', `method '${input.method}' is not a permitted valuation method`));
  }
  if (!isMethodEligibleForClass(input.contributionClass, input.method)) {
    return err(
      valuationFailure(
        'CLASS_METHOD_NOT_ELIGIBLE',
        `${input.contributionClass} does not permit ${input.method}; taxonomy membership does not grant valuation eligibility`,
      ),
    );
  }
  if (input.productionActivated === true) {
    return err(valuationFailure('PRODUCTION_ACTIVATION_FORBIDDEN', 'production valuation policy cannot be activated'));
  }
  if (!(VALUATION_POLICY_STATUSES as readonly string[]).includes(input.status)) {
    return err(valuationFailure('INVALID_POLICY', `unknown policy status '${input.status}'`));
  }
  if (input.status === 'PRODUCTION_CANDIDATE' && input.productionActivated !== false && input.productionActivated !== undefined) {
    return err(valuationFailure('PRODUCTION_POLICY_UNAVAILABLE', 'PRODUCTION_CANDIDATE does not activate production valuation'));
  }
  if (!(ROUNDING_RULES as readonly string[]).includes(input.roundingRule)) {
    return err(valuationFailure('INVALID_POLICY', 'roundingRule must be FLOOR, CEILING, or HALF_EVEN'));
  }
  if (!isUtcInstant(input.effectiveFrom) || (input.effectiveUntil !== null && !isUtcInstant(input.effectiveUntil))) {
    return err(valuationFailure('INVALID_POLICY', 'policy effective window must use UTC instants'));
  }
  if (input.effectiveUntil !== null && input.effectiveUntil <= input.effectiveFrom) {
    return err(valuationFailure('INVALID_POLICY', 'effectiveUntil must be after effectiveFrom'));
  }
  if (input.governanceReference.length === 0 || input.methodologyReference.length === 0) {
    return err(valuationFailure('INVALID_POLICY', 'governanceReference and methodologyReference are required'));
  }
  if (input.allowedInputTypes.length === 0) {
    return err(valuationFailure('INVALID_POLICY', 'a policy must name allowed contribution-specific input types'));
  }
  for (const inputType of input.allowedInputTypes) {
    if (!isAllowedValuationInputType(inputType)) {
      return err(valuationFailure('FORBIDDEN_VALUATION_INPUT', `input type '${inputType}' is not allowed`));
    }
  }
  for (const rule of input.factorRules) {
    const factor = assertFactorRule(rule);
    if (!factor.ok) {
      return factor;
    }
  }
  const caps = assertBound(input.caps, 'caps');
  if (!caps.ok) {
    return caps;
  }
  const floors = assertBound(input.floors, 'floors');
  if (!floors.ok) {
    return floors;
  }
  if (input.conflictToleranceBasisPoints !== null && typeof input.conflictToleranceBasisPoints !== 'bigint') {
    return err(valuationFailure('FLOAT_MONETARY_MATH_FORBIDDEN', 'conflict tolerance must be bigint basis points'));
  }
  for (const method of input.methodPriority) {
    if (!isMethodEligibleForClass(input.contributionClass, method)) {
      return err(valuationFailure('CLASS_METHOD_NOT_ELIGIBLE', `priority method '${method}' is not eligible for ${input.contributionClass}`));
    }
  }
  if (input.referenceDenomination === 'SUNREY' || input.referenceDenomination === 'SUNREY_COIN') {
    return err(valuationFailure('SUNREY_QUANTITY_FORBIDDEN', 'a valuation policy cannot default to a SunRey quantity'));
  }

  return ok(
    Object.freeze({
      ...input,
      allowedInputTypes: Object.freeze([...input.allowedInputTypes]),
      requiredEvidence: Object.freeze([...input.requiredEvidence]),
      factorRules: Object.freeze([...input.factorRules]),
      jurisdictionRules: Object.freeze([...input.jurisdictionRules]),
      methodPriority: Object.freeze([...input.methodPriority]),
      productionActivated: false,
    }),
  );
}

export function hashValuationPolicy(policy: HumanContributionValuationPolicy): ValuationPolicyHash {
  return valuationPolicyHashFor(canonicalPolicyMaterial(policy));
}

export function canonicalPolicyMaterial(policy: HumanContributionValuationPolicy): string {
  return stableSerialize({
    policyId: policy.policyId,
    version: policy.version,
    contributionClass: policy.contributionClass,
    method: policy.method,
    allowedInputTypes: [...policy.allowedInputTypes].sort(),
    requiredEvidence: [...policy.requiredEvidence].sort(),
    referenceDenomination: policy.referenceDenomination,
    factorRules: policy.factorRules.map((rule) => ({
      factor: rule.factor,
      multiplier: rule.multiplier,
    })),
    caps: policy.caps,
    floors: policy.floors,
    roundingRule: policy.roundingRule,
    jurisdictionRules: policy.jurisdictionRules,
    effectiveFrom: policy.effectiveFrom,
    effectiveUntil: policy.effectiveUntil,
    governanceReference: policy.governanceReference,
    methodologyReference: policy.methodologyReference,
    methodPriority: [...policy.methodPriority],
    conflictToleranceBasisPoints: policy.conflictToleranceBasisPoints,
    productionActivated: false,
  });
}

function stableSerialize(value: unknown): string {
  if (typeof value === 'bigint') {
    return `${value.toString()}n`;
  }
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) {
      throw new TypeError('float monetary math is forbidden in policy hashing');
    }
    return JSON.stringify(value);
  }
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function policyCannotMint(policy: HumanContributionValuationPolicy): boolean {
  return policy.productionActivated === false;
}

export function policyReferenceValue(
  policy: HumanContributionValuationPolicy,
  amount: bigint,
): Result<ContributionReferenceValue, ValuationFailure> {
  return createContributionReferenceValue({
    amount,
    denomination: policy.referenceDenomination,
    minorUnitPrecision: 2n,
    valueClass: policy.method === 'CONTRACTUAL_COMPENSATION' ? 'CONTRACT_REFERENCE' : 'GOVERNED_SETTLEMENT_REFERENCE',
  });
}
