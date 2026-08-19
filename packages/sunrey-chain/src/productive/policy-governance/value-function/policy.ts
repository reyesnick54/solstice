/**
 * Productive Value Function policy builders.
 *
 * Development/simulation policies only. Production remains unconfigured
 * and inactive. AI cannot activate a policy.
 */

import { createHash } from 'node:crypto';

import { CLAIM_TYPES, PRODUCTIVE_CATEGORIES } from '../../types.ts';
import { PRODUCTIVE_VALUE_FUNCTION_CONSTITUTION_VERSION, PRODUCTIVE_VALUE_FUNCTION_DOMAIN } from './constitution.ts';
import {
  CANONICAL_FACTOR_ORDER,
  DEVELOPMENT_FACTOR_DEFINITIONS,
  RESERVED_FACTOR_DEFINITIONS,
  developmentCategoryRules,
  factorDefinition,
} from './factors.ts';
import { PRODUCTIVE_VALUE_FUNCTION_SCHEMA_VERSION } from './constitution.ts';
import {
  PRODUCTION_VALUE_FUNCTION_POLICY,
  VALUE_FACTOR_SCALE,
  VALUE_FACTOR_TYPES,
  VALUE_FUNCTION_PARAMETER_CLASS,
  type ProductiveValueFunctionPolicy,
  type ValueFactorType,
} from './types.ts';

export const DEVELOPMENT_VALUE_FUNCTION_POLICY_ID = 'moonrey.productive-value-function.simulation.v1' as const;

export function hashValueFunctionPolicy(
  policy: Omit<ProductiveValueFunctionPolicy, 'contentHash'> | ProductiveValueFunctionPolicy,
): string {
  const { contentHash: _ignored, ...rest } = policy as ProductiveValueFunctionPolicy;
  void _ignored;
  return createHash('sha256').update(`${PRODUCTIVE_VALUE_FUNCTION_DOMAIN}|${stable(rest)}`).digest('hex');
}

export function developmentValueFunctionPolicy(
  effectiveHeight = 1,
  policyVersion = 1,
): ProductiveValueFunctionPolicy {
  const factorCaps = Object.fromEntries(
    VALUE_FACTOR_TYPES.map((factorType) => {
      const definition = factorDefinition(factorType);
      return [factorType, Object.freeze({ min: definition.minimum, max: definition.maximum })];
    }),
  ) as ProductiveValueFunctionPolicy['factorCaps'];
  const draft: Omit<ProductiveValueFunctionPolicy, 'contentHash'> = {
    policyId: DEVELOPMENT_VALUE_FUNCTION_POLICY_ID,
    policyVersion,
    state: 'SIMULATION',
    eligibleCategories: PRODUCTIVE_CATEGORIES,
    eligibleClaimTypes: CLAIM_TYPES.filter((claim) => claim === 'OUTPUT' || claim === 'USAGE' || claim === 'DELIVERY'),
    factorDefinitions: DEVELOPMENT_FACTOR_DEFINITIONS,
    reservedFactors: RESERVED_FACTOR_DEFINITIONS,
    factorOrder: CANONICAL_FACTOR_ORDER,
    factorCaps,
    aggregateFactorFloor: 0n,
    aggregateFactorCeiling: VALUE_FACTOR_SCALE,
    perCategoryRules: developmentCategoryRules(),
    referenceFactRequirements: ['QUALITY', 'FRESHNESS'],
    attributionRequired: true,
    roundingPolicy: 'FLOOR',
    effectiveHeight,
    supersededAtHeight: null,
    governanceReference: 'chunk-123.simulation.value-function-policy.v1',
    parameterClass: VALUE_FUNCTION_PARAMETER_CLASS,
    productionActivated: false,
    schemaVersion: PRODUCTIVE_VALUE_FUNCTION_SCHEMA_VERSION,
    constitutionVersion: PRODUCTIVE_VALUE_FUNCTION_CONSTITUTION_VERSION,
    engineImplemented: false,
    canMint: false,
  };
  return Object.freeze({ ...draft, contentHash: hashValueFunctionPolicy(draft) });
}

export function productionValueFunctionUnconfigured(): typeof PRODUCTION_VALUE_FUNCTION_POLICY {
  return PRODUCTION_VALUE_FUNCTION_POLICY;
}

export function factorOrderOf(policy: ProductiveValueFunctionPolicy): readonly ValueFactorType[] {
  return policy.factorOrder;
}

export function policyFactorTypes(policy: ProductiveValueFunctionPolicy): readonly ValueFactorType[] {
  return policy.factorDefinitions.map((definition) => definition.factorType);
}

function stable(value: unknown): string {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stable(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${key}:${stable(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
