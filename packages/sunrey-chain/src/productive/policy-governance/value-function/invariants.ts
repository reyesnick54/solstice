/**
 * Productive Value Function policy and input invariants.
 *
 * Validation only. A successful check does not compute a value, mint
 * MoonRey, or activate production policy.
 */

import { isProductiveCategory, type ProductiveCategory } from '../../types.ts';
import {
  CAPACITY_ALONE_IS_NOT_REALIZED_OUTPUT,
  ORACLE_FACT_ALONE_CANNOT_CREATE_VALUE,
  PRODUCTIVE_VALUE_FUNCTION_CAN_MINT,
  PRODUCTIVE_VALUE_FUNCTION_DOES_NOT_MINT,
  PRODUCTIVE_VALUE_FUNCTION_ENGINE_IMPLEMENTED,
  PRODUCTION_VALUE_POLICY_ACTIVE,
  REFERENCE_PRICE_IS_CONTEXT_NOT_AUTOMATIC_VALUE,
} from './constitution.ts';
import { CANONICAL_FACTOR_ORDER, everyCategoryHasDeliberateFactorPolicy, factorEligibleForCategory } from './factors.ts';
import { assertExactInteger, assertExactRational, boundFactorValue, rejectUnboundedMultiplier } from './methods.ts';
import {
  FORBIDDEN_VALUE_FACTOR_TYPES,
  FORBIDDEN_VALUE_INPUTS,
  REALIZATION_ELIGIBILITY,
  VALUE_FACTOR_TYPES,
  valueFunctionOk,
  valueFunctionRefuse,
  type ForbiddenValueFactorType,
  type ForbiddenValueInput,
  type ProductiveAttributionDecision,
  type ProductiveValueFunctionPolicy,
  type ProductiveValueInput,
  type ProductiveValueReferenceFact,
  type RealizationState,
  type ValueFactorType,
  type ValueFunctionResult,
} from './types.ts';

const FORBIDDEN_INPUT_KEYS = new Set([
  'rawHttp',
  'rawHttpData',
  'httpBody',
  'httpPayload',
  'unverifiedProviderPrice',
  'aiJudgment',
  'aiValue',
  'modelScarcity',
  'modelOpinion',
  'socialMediaSentiment',
  'moonreyMarketPrice',
  'moonreyPrice',
  'secret',
  'credentials',
  'apiKey',
  'providerCredential',
  'rawProviderPayload',
]);

const FLOAT_KEYS = new Set(['float', 'NaN', 'nan', 'numberValue']);

export function isForbiddenFactorType(value: string): value is ForbiddenValueFactorType {
  return (FORBIDDEN_VALUE_FACTOR_TYPES as readonly string[]).includes(value);
}

export function isSupportedFactorType(value: string): value is ValueFactorType {
  return (VALUE_FACTOR_TYPES as readonly string[]).includes(value);
}

export function isForbiddenInputKind(value: string): value is ForbiddenValueInput {
  return (FORBIDDEN_VALUE_INPUTS as readonly string[]).includes(value);
}

export function realizationIsAutomaticallyEligible(state: RealizationState): boolean {
  return REALIZATION_ELIGIBILITY[state] === 'POLICY_ELIGIBLE' ||
    REALIZATION_ELIGIBILITY[state] === 'POLICY_ELIGIBLE_SUBJECT_TO_ATTRIBUTION';
}

export function capacityAloneIsRealizedOutput(): false {
  return CAPACITY_ALONE_IS_NOT_REALIZED_OUTPUT ? false : false;
}

export function referencePriceDeterminesValue(): false {
  return REFERENCE_PRICE_IS_CONTEXT_NOT_AUTOMATIC_VALUE ? false : false;
}

export function oracleFactAloneCreatesValue(): false {
  return ORACLE_FACT_ALONE_CANNOT_CREATE_VALUE ? false : false;
}

export function valueFunctionCanMint(): false {
  return PRODUCTIVE_VALUE_FUNCTION_CAN_MINT;
}

export function valueFunctionEngineImplemented(): false {
  return PRODUCTIVE_VALUE_FUNCTION_ENGINE_IMPLEMENTED;
}

export function productionValuePolicyActive(): false {
  return PRODUCTION_VALUE_POLICY_ACTIVE;
}

export function validateFactorBounds(policy: ProductiveValueFunctionPolicy): ValueFunctionResult<true> {
  for (const definition of policy.factorDefinitions) {
    if (typeof definition.minimum !== 'bigint' || typeof definition.maximum !== 'bigint') {
      return valueFunctionRefuse('FLOAT_MATH_FORBIDDEN', `${definition.factorId} bounds must be bigint`);
    }
    if (definition.maximum < definition.minimum) {
      return valueFunctionRefuse('UNBOUNDED_FACTOR', `${definition.factorId} maximum is below minimum`);
    }
    const bounded = boundFactorValue(definition, definition.neutralValue);
    if (!bounded.ok) {
      return bounded;
    }
    const cap = policy.factorCaps[definition.factorType];
    if (!cap) {
      return valueFunctionRefuse('UNBOUNDED_FACTOR', `${definition.factorType} is missing an explicit cap`);
    }
    if (cap.max < cap.min) {
      return valueFunctionRefuse('UNBOUNDED_FACTOR', `${definition.factorType} cap is inverted`);
    }
    if (definition.minimum < cap.min || definition.maximum > cap.max) {
      return valueFunctionRefuse('FACTOR_OUT_OF_BOUNDS', `${definition.factorId} escapes its policy cap`);
    }
  }
  if (policy.aggregateFactorCeiling < policy.aggregateFactorFloor) {
    return valueFunctionRefuse('UNBOUNDED_FACTOR', 'aggregate factor ceiling is below the floor');
  }
  return valueFunctionOk(true);
}

export function validateFactorOrder(policy: ProductiveValueFunctionPolicy): ValueFunctionResult<true> {
  if (policy.factorOrder.length !== CANONICAL_FACTOR_ORDER.length) {
    return valueFunctionRefuse('FACTOR_ORDER_NONDETERMINISTIC', 'policy factor order is incomplete');
  }
  for (const [index, factorType] of policy.factorOrder.entries()) {
    if (factorType !== CANONICAL_FACTOR_ORDER[index]) {
      return valueFunctionRefuse('FACTOR_ORDER_NONDETERMINISTIC', `policy factor order diverges at ${String(index)}`);
    }
  }
  const unique = new Set(policy.factorOrder);
  if (unique.size !== policy.factorOrder.length) {
    return valueFunctionRefuse('FACTOR_ORDER_NONDETERMINISTIC', 'factor order contains duplicates');
  }
  return valueFunctionOk(true);
}

export function validateCategoryCoverage(policy: ProductiveValueFunctionPolicy): ValueFunctionResult<true> {
  if (!everyCategoryHasDeliberateFactorPolicy()) {
    return valueFunctionRefuse('UNSUPPORTED_CATEGORY', 'every ProductiveCategory must have a deliberate factor policy');
  }
  const categories = new Set(policy.perCategoryRules.map((rule) => rule.category));
  for (const category of policy.eligibleCategories) {
    if (!categories.has(category)) {
      return valueFunctionRefuse('UNSUPPORTED_CATEGORY', `missing per-category rule for ${category}`);
    }
    const rule = policy.perCategoryRules.find((item) => item.category === category);
    if (!rule?.requiredFactorTypes.includes('ATTRIBUTION_SHARE_FACTOR')) {
      return valueFunctionRefuse('ATTRIBUTION_REQUIRED', `${category} must require attribution`);
    }
  }
  return valueFunctionOk(true);
}

export function validateAttributionRequired(policy: ProductiveValueFunctionPolicy): ValueFunctionResult<true> {
  if (policy.attributionRequired !== true) {
    return valueFunctionRefuse('ATTRIBUTION_REQUIRED', 'value-function policy must set attributionRequired');
  }
  return valueFunctionOk(true);
}

export function validatePolicyDoesNotMint(policy: ProductiveValueFunctionPolicy): ValueFunctionResult<true> {
  if (policy.canMint !== false || PRODUCTIVE_VALUE_FUNCTION_DOES_NOT_MINT !== true) {
    return valueFunctionRefuse('VALUE_FUNCTION_DOES_NOT_MINT', 'value-function policy cannot mint');
  }
  if (policy.engineImplemented !== false) {
    return valueFunctionRefuse('ENGINE_NOT_IMPLEMENTED', 'Chunk 123 must not claim an implemented engine');
  }
  if (policy.productionActivated !== false || PRODUCTION_VALUE_POLICY_ACTIVE !== false) {
    return valueFunctionRefuse('PRODUCTION_POLICY_INACTIVE', 'production value policy must remain inactive');
  }
  return valueFunctionOk(true);
}

export function rejectForbiddenFactor(factorType: string): ValueFunctionResult<true> {
  if (isForbiddenFactorType(factorType)) {
    return valueFunctionRefuse('FORBIDDEN_FACTOR', `${factorType} is an opaque forbidden factor`);
  }
  if (!isSupportedFactorType(factorType)) {
    return valueFunctionRefuse('UNSUPPORTED_FACTOR', `${factorType} is not a governed factor type`);
  }
  return valueFunctionOk(true);
}

export function rejectUnsupportedFactorForCategory(
  category: ProductiveCategory,
  factorType: ValueFactorType,
): ValueFunctionResult<true> {
  if (!isProductiveCategory(category)) {
    return valueFunctionRefuse('UNSUPPORTED_CATEGORY', `${category} is not a productive category`);
  }
  if (!factorEligibleForCategory(category, factorType)) {
    return valueFunctionRefuse(
      'UNSUPPORTED_FACTOR_FOR_CATEGORY',
      `${factorType} is not eligible for ${category}`,
    );
  }
  return valueFunctionOk(true);
}

export function rejectForbiddenInputPayload(value: unknown): ValueFunctionResult<true> {
  let refusal: ValueFunctionResult<true> | null = null;
  inspectForbidden(value, (code, detail) => {
    if (refusal === null) {
      refusal = valueFunctionRefuse(code, detail);
    }
  });
  return refusal ?? valueFunctionOk(true);
}

function inspectForbidden(
  value: unknown,
  reject: (code: ReturnType<typeof valueFunctionRefuse>['code'], detail: string) => void,
  depth = 0,
): void {
  if (value === null || value === undefined || depth > 4) {
    return;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      reject('FLOAT_MATH_FORBIDDEN', 'numeric float/NaN inputs are forbidden');
    }
    return;
  }
  if (typeof value !== 'object') {
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      inspectForbidden(item, reject, depth + 1);
    }
    return;
  }
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_INPUT_KEYS.has(key) && inner) {
      if (key === 'moonreyMarketPrice' || key === 'moonreyPrice') {
        reject('REFERENCE_PRICE_CANNOT_DETERMINE_VALUE', 'MoonRey market price cannot be a self-referential multiplier');
        return;
      }
      if (key === 'rawProviderPayload' || key === 'rawHttp' || key === 'rawHttpData' || key === 'httpBody' || key === 'httpPayload') {
        reject('RAW_PROVIDER_PAYLOAD_FORBIDDEN', 'raw HTTP/provider payloads are forbidden');
        return;
      }
      if (key === 'secret' || key === 'credentials' || key === 'apiKey' || key === 'providerCredential') {
        reject('FORBIDDEN_INPUT', 'secrets and provider credentials are forbidden');
        return;
      }
      reject('FORBIDDEN_INPUT', `forbidden input field '${key}'`);
      return;
    }
    if (FLOAT_KEYS.has(key) && inner !== undefined && inner !== false) {
      reject('FLOAT_MATH_FORBIDDEN', `float/NaN field '${key}' is forbidden`);
      return;
    }
    inspectForbidden(inner, reject, depth + 1);
  }
}

export function validateReferencePriceIsNotValue(
  facts: readonly ProductiveValueReferenceFact[],
): ValueFunctionResult<true> {
  for (const fact of facts) {
    if (fact.factType === 'REFERENCE_PRICE' && fact.moonreyMarketPrice) {
      return valueFunctionRefuse(
        'REFERENCE_PRICE_CANNOT_DETERMINE_VALUE',
        'MoonRey market price cannot enter the value function',
      );
    }
  }
  return valueFunctionOk(true);
}

export function validateScarcityEvidence(
  category: ProductiveCategory,
  factorRequested: boolean,
  facts: readonly ProductiveValueReferenceFact[],
  priceAlone: boolean,
): ValueFunctionResult<true> {
  if (!factorRequested) {
    return valueFunctionOk(true);
  }
  if (!factorEligibleForCategory(category, 'SCARCITY_FACTOR')) {
    return valueFunctionRefuse('UNSUPPORTED_FACTOR_FOR_CATEGORY', `SCARCITY_FACTOR is not eligible for ${category}`);
  }
  if (priceAlone) {
    return valueFunctionRefuse('SCARCITY_PRICE_ALONE_FORBIDDEN', 'price alone cannot define scarcity');
  }
  const evidenced = facts.some(
    (fact) =>
      fact.verified &&
      (fact.factType === 'REGIONAL_SUPPLY' ||
        fact.factType === 'REGIONAL_DEMAND_PROXY' ||
        fact.factType === 'CAPACITY' ||
        fact.factType === 'AVAILABILITY') &&
      fact.sourceQuorumEvidence.length > 0 &&
      !fact.socialMediaSentiment,
  );
  if (!evidenced) {
    return valueFunctionRefuse('SCARCITY_REFERENCE_REQUIRED', 'scarcity requires verified reference facts');
  }
  return valueFunctionOk(true);
}

export function validateUtilizationEvidence(
  category: ProductiveCategory,
  factorRequested: boolean,
  facts: readonly ProductiveValueReferenceFact[],
  providerSelfReportAlone: boolean,
): ValueFunctionResult<true> {
  if (!factorRequested) {
    return valueFunctionOk(true);
  }
  if (!factorEligibleForCategory(category, 'UTILIZATION_FACTOR')) {
    return valueFunctionRefuse('UNSUPPORTED_FACTOR_FOR_CATEGORY', `UTILIZATION_FACTOR is not eligible for ${category}`);
  }
  if (providerSelfReportAlone) {
    return valueFunctionRefuse('PROVIDER_SELF_REPORT_INSUFFICIENT', 'utilization cannot be provider self-report alone');
  }
  const evidenced = facts.some(
    (fact) =>
      fact.verified &&
      !fact.providerSelfReportedAlone &&
      (fact.factType === 'UTILIZATION' || fact.factType === 'CAPACITY' || fact.factType === 'AVAILABILITY'),
  );
  if (!evidenced) {
    return valueFunctionRefuse('UTILIZATION_EVIDENCE_REQUIRED', 'utilization requires independent verified evidence');
  }
  return valueFunctionOk(true);
}

export function validateGeographyEvidence(
  category: ProductiveCategory,
  factorRequested: boolean,
  facts: readonly ProductiveValueReferenceFact[],
  countryPreference: boolean,
): ValueFunctionResult<true> {
  if (!factorRequested) {
    return valueFunctionOk(true);
  }
  if (!factorEligibleForCategory(category, 'GEOGRAPHIC_CONTEXT_FACTOR')) {
    return valueFunctionRefuse(
      'UNSUPPORTED_FACTOR_FOR_CATEGORY',
      `GEOGRAPHIC_CONTEXT_FACTOR is not eligible for ${category}`,
    );
  }
  if (countryPreference) {
    return valueFunctionRefuse('ARBITRARY_COUNTRY_PREFERENCE_FORBIDDEN', 'geography cannot be a country-preference multiplier');
  }
  const evidenced = facts.some(
    (fact) =>
      fact.verified &&
      fact.policyCompatible &&
      fact.geography.jurisdiction.length > 0 &&
      (fact.factType === 'REGIONAL_SUPPLY' || fact.factType === 'REGIONAL_DEMAND_PROXY'),
  );
  if (!evidenced) {
    return valueFunctionRefuse('GEOGRAPHY_EVIDENCE_REQUIRED', 'geography requires versioned reference evidence and jurisdiction');
  }
  return valueFunctionOk(true);
}

export function validateAttributionDecision(
  policy: ProductiveValueFunctionPolicy,
  decision: ProductiveAttributionDecision | undefined,
): ValueFunctionResult<true> {
  if (policy.attributionRequired && !decision) {
    return valueFunctionRefuse('ATTRIBUTION_REQUIRED', 'the value function cannot ignore attribution');
  }
  if (!decision) {
    return valueFunctionRefuse('ATTRIBUTION_REQUIRED', 'attribution decision missing');
  }
  if (decision.authoritative !== true) {
    return valueFunctionRefuse('ATTRIBUTION_REQUIRED', 'attribution decision must be the Chunk 121-122 authority');
  }
  const share = assertExactRational(decision.share, 'attribution.share');
  if (!share.ok) {
    return share;
  }
  const available = assertExactRational(decision.availableShare, 'attribution.availableShare');
  if (!available.ok) {
    return available;
  }
  if (decision.share.numerator * decision.availableShare.denominator >
    decision.availableShare.numerator * decision.share.denominator) {
    return valueFunctionRefuse('ATTRIBUTION_SHARE_UNBOUNDED', 'claim share cannot exceed the available attribution share');
  }
  return valueFunctionOk(true);
}

export function validateValueInput(policy: ProductiveValueFunctionPolicy, input: ProductiveValueInput): ValueFunctionResult<true> {
  const poisoned = rejectForbiddenInputPayload(input);
  if (!poisoned.ok) {
    return poisoned;
  }
  if (input.rawProviderPayload !== undefined) {
    return valueFunctionRefuse('RAW_PROVIDER_PAYLOAD_FORBIDDEN', 'raw provider payloads are forbidden');
  }
  if (!input.normalizationReceipt?.receiptId || !input.normalizationReceipt.conversionVersion) {
    return valueFunctionRefuse('NORMALIZATION_RECEIPT_REQUIRED', 'canonical normalization receipt/version is required');
  }
  if (!input.measurementReference?.unitId || !input.measurementReference.constitutionVersion) {
    return valueFunctionRefuse('MEASUREMENT_REFERENCE_REQUIRED', 'canonical measurement reference is required');
  }
  if (input.realizationState === 'INSTALLED_CAPACITY' ||
    input.realizationState === 'AVAILABLE_CAPACITY' ||
    input.realizationState === 'RESERVED_CAPACITY') {
    return valueFunctionRefuse('CAPACITY_IS_NOT_REALIZED_OUTPUT', 'capacity/reserve states are describable but not eligible');
  }
  const attribution = validateAttributionDecision(policy, input.attributionDecision);
  if (!attribution.ok) {
    return attribution;
  }
  if (
    input.availableAttributionShare.numerator !== input.attributionDecision.availableShare.numerator ||
    input.availableAttributionShare.denominator !== input.attributionDecision.availableShare.denominator
  ) {
    return valueFunctionRefuse('ATTRIBUTION_REQUIRED', 'available attribution share must match the attribution decision');
  }
  const price = validateReferencePriceIsNotValue(input.referenceFacts);
  if (!price.ok) {
    return price;
  }
  if (policy.canMint) {
    return valueFunctionRefuse('VALUE_FUNCTION_DOES_NOT_MINT', 'validated input still cannot mint');
  }
  return valueFunctionOk(true);
}

export function validatePolicy(policy: ProductiveValueFunctionPolicy): ValueFunctionResult<true> {
  const coverage = validateCategoryCoverage(policy);
  if (!coverage.ok) {
    return coverage;
  }
  const order = validateFactorOrder(policy);
  if (!order.ok) {
    return order;
  }
  const bounds = validateFactorBounds(policy);
  if (!bounds.ok) {
    return bounds;
  }
  const attribution = validateAttributionRequired(policy);
  if (!attribution.ok) {
    return attribution;
  }
  const mint = validatePolicyDoesNotMint(policy);
  if (!mint.ok) {
    return mint;
  }
  if (policy.parameterClass !== 'ENGINEERING_SIMULATION_PARAMETERS') {
    return valueFunctionRefuse('POLICY_STATE_INVALID', 'parameter class must remain ENGINEERING_SIMULATION_PARAMETERS');
  }
  for (const reserved of policy.reservedFactors) {
    if (reserved.enabled) {
      return valueFunctionRefuse('UNSUPPORTED_FACTOR', `${reserved.factorType} is reserved and must stay disabled`);
    }
  }
  return valueFunctionOk(true);
}

export function rejectAiActivation(actorKind: string): ValueFunctionResult<true> {
  if (actorKind === 'AI_PROPOSAL' || actorKind === 'AI' || actorKind === 'MODEL') {
    return valueFunctionRefuse('AI_CANNOT_ACTIVATE_POLICY', 'AI may propose a value-function policy but cannot activate it');
  }
  return valueFunctionOk(true);
}

export function rejectUnboundedFactorAttempt(numerator: bigint, denominator: bigint): ValueFunctionResult<true> {
  const exactNum = assertExactInteger(numerator, 'unbounded.numerator');
  if (!exactNum.ok) {
    return exactNum;
  }
  const exactDen = assertExactInteger(denominator, 'unbounded.denominator');
  if (!exactDen.ok) {
    return exactDen;
  }
  return rejectUnboundedMultiplier(numerator, denominator, VALUE_FACTOR_TYPES.length > 0 ? 1_500_000n : 0n);
}
