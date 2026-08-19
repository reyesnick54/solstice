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
