/**
 * Production-candidate Productive Value validation.
 *
 * Validates structure, forbidden factors, attribution, units, and the
 * price-feedback firewall. Does not activate production or mint.
 */

import { VALUE_FACTOR_TYPES } from '../types.ts';
import { exclusivePartnerCategories, semanticMatchesCategory, unitCompatibleWithCategory } from './bindings.ts';
import { isProductionForbiddenFactor } from './factors.ts';
import {
  FORBIDDEN_AUTHORIZATION_ACTORS,
  FORBIDDEN_PRICE_FEEDBACK_LOOPS,
  GOVERNED_VALUE_V2,
  LEGACY_ENGINEERING_SIMULATION_V1,
  productionCandidateOk,
  productionCandidateRefuse,
  type MoonReyProductiveValuePolicyCandidate,
  type ProductionCandidateRefusal,
  type ProductionCandidateResult,
  type ProductionCandidateValueInput,
  type ProductiveBaseValueScheduleCandidate,
} from './types.ts';

export function validateProductionCandidateSchedule(
  schedule: ProductiveBaseValueScheduleCandidate,
  input?: Pick<ProductionCandidateValueInput, 'canonicalUnit' | 'semanticQualifier' | 'category'>,
): ProductionCandidateRefusal | null {
  if (schedule.productionActivated) {
    return productionCandidateRefuse('PRODUCTION_CANDIDATE_CANNOT_ACTIVATE', 'schedule productionActivated must be false');
  }
  if (typeof schedule.baseGpuvNumerator !== 'bigint' || typeof schedule.baseGpuvDenominator !== 'bigint') {
    return productionCandidateRefuse('FLOAT_MATH_FORBIDDEN', 'schedule GPUV values must be bigint');
  }
  if (schedule.baseGpuvDenominator === 0n) {
    return productionCandidateRefuse('DENOMINATOR_ZERO', 'schedule denominator cannot be zero');
  }
  if (!unitCompatibleWithCategory(schedule.productiveCategory, schedule.canonicalUnit)) {
    return productionCandidateRefuse('INCOMPATIBLE_UNIT', 'schedule unit is incompatible with category');
  }
  if (!semanticMatchesCategory(schedule.productiveCategory, schedule.semanticQualifier)) {
    return productionCandidateRefuse('SEMANTIC_MISMATCH', 'schedule semantic does not match category constitution');
  }
  if (input && input.category !== schedule.productiveCategory) {
    return productionCandidateRefuse('SEMANTIC_MISMATCH', 'input category does not match schedule');
  }
  if (input && !unitCompatibleWithCategory(schedule.productiveCategory, input.canonicalUnit)) {
    return productionCandidateRefuse('INCOMPATIBLE_UNIT', 'input unit is incompatible with category');
  }
  if (input && input.semanticQualifier !== schedule.semanticQualifier) {
    return productionCandidateRefuse('SEMANTIC_MISMATCH', 'input semantic does not match schedule');
  }
  return null;
}

export function validateForbiddenFactor(factorType: string): ProductionCandidateRefusal | null {
  if (factorType === 'AI_VALUE_FACTOR' || factorType === 'MODEL_OPINION_FACTOR') {
    return productionCandidateRefuse('AI_FACTOR_REJECTED', `${factorType} is forbidden`);
  }
  if (
    factorType === 'PROVIDER_SELF_REPORTED_VALUE_FACTOR' ||
    factorType === 'PROVIDER_SELF_REPORTED_ECONOMIC_VALUE_MULTIPLIER'
  ) {
    return productionCandidateRefuse('PROVIDER_SELF_VALUE_FACTOR_REJECTED', `${factorType} is forbidden`);
  }
  if (isProductionForbiddenFactor(factorType)) {
    return productionCandidateRefuse('FORBIDDEN_FACTOR', `${factorType} is forbidden in production-candidate policy`);
  }
  if (factorType.startsWith('DEMAND_ELASTICITY') || factorType === 'SUBSTITUTION_FACTOR' || factorType === 'MULTI_PERIOD_SMOOTHING_FACTOR') {
    return productionCandidateRefuse('RESERVED_FACTOR_NOT_IMPLEMENTED', `${factorType} remains reserved`);
  }
  if (!(VALUE_FACTOR_TYPES as readonly string[]).includes(factorType)) {
    return productionCandidateRefuse('FORBIDDEN_FACTOR', `${factorType} is not a reused Chunk 123/124 factor`);
  }
  return null;
}

export function validateAttributionRequired(input: ProductionCandidateValueInput): ProductionCandidateRefusal | null {
  if (!input.eventId || !input.attributionDecisionId) {
    return productionCandidateRefuse('ATTRIBUTION_REQUIRED', 'event identity and attribution decision are required');
  }
  if (!input.availableAttributionShare) {
    return productionCandidateRefuse('ATTRIBUTION_SHARE_MISSING', 'available attribution share is required');
  }
  if (input.availableAttributionShare.denominator <= 0n) {
    return productionCandidateRefuse('ATTRIBUTION_SHARE_MISSING', 'attribution share denominator must be positive');
  }
  if (input.availableAttributionShare.numerator === input.availableAttributionShare.denominator && input.availableAttributionShare.numerator === 0n) {
    return productionCandidateRefuse('ATTRIBUTION_SHARE_MISSING', 'zero attribution share is not implicit full credit');
  }
  return null;
}

export function validateDuplicateEventProtection(input: ProductionCandidateValueInput): ProductionCandidateRefusal | null {
  const credited = input.creditedCategories ?? [input.category];
  const partners = exclusivePartnerCategories(input.category);
  if (credited.some((category) => partners.includes(category))) {
    return productionCandidateRefuse(
      'DUPLICATE_EVENT_FULL_CREDIT',
      `${input.category} cannot take a second full credit against ${partners.join(',')}`,
    );
  }
  return null;
}

export function validateReferencePriceFirewall(input: ProductionCandidateValueInput): ProductionCandidateRefusal | null {
  if (input.referencePriceAlone) {
    return productionCandidateRefuse(
      'REFERENCE_PRICE_ALONE_CANNOT_VALUE',
      'REFERENCE_PRICE cannot create GPUV alone',
    );
  }
  return null;
}

export function validatePriceFeedbackFirewall(input: ProductionCandidateValueInput): ProductionCandidateRefusal | null {
  if (input.moonreyMarketPrice) {
    return productionCandidateRefuse(
      'MOONREY_MARKET_PRICE_FORBIDDEN',
      `${FORBIDDEN_PRICE_FEEDBACK_LOOPS[0]} is prohibited`,
    );
  }
  if (input.issuanceQuantityAsScarcity) {
    return productionCandidateRefuse(
      'SELF_REFERENTIAL_PRICE_FEEDBACK',
      `${FORBIDDEN_PRICE_FEEDBACK_LOOPS[1]} is prohibited`,
    );
  }
  return null;
}

export function validateScarcity(input: ProductionCandidateValueInput): ProductionCandidateRefusal | null {
  if (input.unboundedScarcityMultiplier) {
    return productionCandidateRefuse('UNBOUNDED_SCARCITY_REJECTED', 'scarcity multipliers must be bounded and versioned');
  }
  if (input.factorTypes?.includes('SCARCITY_FACTOR') && input.scarcityEvidenced === false) {
    return productionCandidateRefuse('SCARCITY_NOT_EVIDENCE_BOUND', 'scarcity must be evidence-bound');
  }
  return null;
}

export function validateAuthorizationActor(actor: string | undefined): ProductionCandidateRefusal | null {
  if (!actor) {
    return null;
  }
  if (actor === 'AI') {
    return productionCandidateRefuse('AI_CANNOT_AUTHORIZE', 'AI cannot authorize production-candidate policy');
  }
  if (actor === 'S3M') {
    return productionCandidateRefuse('S3M_CANNOT_AUTHORIZE', 'S3M cannot authorize production-candidate policy');
  }
  if (actor === 'GROK') {
    return productionCandidateRefuse('GROK_CANNOT_AUTHORIZE', 'Grok cannot authorize production-candidate policy');
  }
  if (actor === 'MODEL') {
    return productionCandidateRefuse('MODEL_CANNOT_AUTHORIZE', 'model output cannot authorize production-candidate policy');
  }
  if (actor === 'ORACLE_PROVIDER' || actor === 'DATA_PROVIDER') {
    return productionCandidateRefuse('PROVIDER_CANNOT_AUTHORIZE', 'providers cannot authorize production-candidate policy');
  }
  if (actor === 'PRODUCTIVE_CONTROLLER') {
    return productionCandidateRefuse('CONTROLLER_CANNOT_AUTHORIZE', 'controllers cannot authorize production-candidate policy');
  }
  if ((FORBIDDEN_AUTHORIZATION_ACTORS as readonly string[]).includes(actor) || actor === 'FINANCIAL_AGENT') {
    return productionCandidateRefuse('AI_CANNOT_AUTHORIZE', `${actor} cannot authorize production-candidate policy`);
  }
  return null;
}

export function validateValuePath(input: ProductionCandidateValueInput): ProductionCandidateRefusal | null {
  if (input.valuePath === LEGACY_ENGINEERING_SIMULATION_V1) {
    return productionCandidateRefuse('LEGACY_V1_CANNOT_QUALIFY_PRODUCTION', 'legacy V1 cannot qualify production');
  }
  if (input.fixturePolicy && input.valuePath === GOVERNED_VALUE_V2) {
    return productionCandidateRefuse('FIXTURE_V2_CANNOT_QUALIFY_PRODUCTION', 'fixture V2 cannot qualify production');
  }
  return null;
}

export function validateProductionValueInput(
  input: ProductionCandidateValueInput,
  schedule?: ProductiveBaseValueScheduleCandidate,
): ProductionCandidateResult<true> {
  const actor = validateAuthorizationActor(input.authorizedBy);
  if (actor) {
    return actor;
  }
  if (input.referencePriceAlone) {
    return validateReferencePriceFirewall(input)!;
  }
  const price = validatePriceFeedbackFirewall(input);
  if (price) {
    return price;
  }
  if (input.factorTypes) {
    for (const factorType of input.factorTypes) {
      const forbidden = validateForbiddenFactor(factorType);
      if (forbidden) {
        return forbidden;
      }
    }
  }
  const scarcity = validateScarcity(input);
  if (scarcity) {
    return scarcity;
  }
  const path = validateValuePath(input);
  if (path) {
    return path;
  }
  const attribution = validateAttributionRequired(input);
  if (attribution) {
    return attribution;
  }
  const duplicate = validateDuplicateEventProtection(input);
  if (duplicate) {
    return duplicate;
  }
  if (schedule) {
    const scheduleRefusal = validateProductionCandidateSchedule(schedule, input);
    if (scheduleRefusal) {
      return scheduleRefusal;
    }
  } else {
    return productionCandidateRefuse('VALUE_UNCONFIGURED', 'production base GPUV remains VALUE_UNCONFIGURED');
  }
  return productionCandidateOk(true);
}

export function validateProductiveValuePolicyCandidate(
  policy: MoonReyProductiveValuePolicyCandidate,
): ProductionCandidateResult<true> {
  if (policy.productionActivated) {
    return productionCandidateRefuse('PRODUCTION_CANDIDATE_CANNOT_ACTIVATE', 'policy cannot activate production');
  }
  if (policy.canMint) {
    return productionCandidateRefuse('GPUV_RESULT_CANNOT_MINT', 'policy cannot mint');
  }
  if (policy.gpuvEqualsMoonReyByDefinition) {
    return productionCandidateRefuse('MOONREY_MARKET_PRICE_FORBIDDEN', 'GPUV is not MoonRey');
  }
  if (policy.valueSemantics !== GOVERNED_VALUE_V2) {
    return productionCandidateRefuse('LEGACY_V1_CANNOT_QUALIFY_PRODUCTION', 'production candidate requires GOVERNED_VALUE_V2');
  }
  if (policy.factorPolicy.moonreyMarketPriceFeedsPvf) {
    return productionCandidateRefuse('MOONREY_MARKET_PRICE_FORBIDDEN', 'MoonRey market price cannot feed PVF');
  }
  for (const schedule of policy.baseSchedules) {
    const refusal = validateProductionCandidateSchedule(schedule);
    if (refusal) {
      return refusal;
    }
  }
  return productionCandidateOk(true);
}

export function staticPriceFeedbackInvariants(): readonly ForbiddenPriceFeedbackInvariant[] {
  return Object.freeze([
    Object.freeze({
      loop: FORBIDDEN_PRICE_FEEDBACK_LOOPS[0],
      permitted: false,
    }),
    Object.freeze({
      loop: FORBIDDEN_PRICE_FEEDBACK_LOOPS[1],
      permitted: false,
    }),
  ]);
}

export type ForbiddenPriceFeedbackInvariant = {
  readonly loop: (typeof FORBIDDEN_PRICE_FEEDBACK_LOOPS)[number];
  readonly permitted: false;
};
