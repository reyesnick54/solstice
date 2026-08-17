import { mulDiv } from '../formula.ts';
import { WEIGHT_SCALE, type ProductiveCategory, type RoundingMode } from '../types.ts';
import { defaultUnitRegistry } from '../units.ts';
import { boundedFactor, developmentCategoryPolicy } from './categories.ts';
import {
  NORMALIZED_PRODUCTIVE_UNIT_ID,
  POLICY_GOVERNANCE_SCHEMA_VERSION,
  type NormalizedProductiveUnit,
  type PolicyFactor,
  type ProductiveNormalizationRule,
} from './types.ts';

export function developmentNormalizationRule(
  category: ProductiveCategory,
  sourceUnitId: string,
  activationHeight = 1,
  ruleVersion = 1,
): ProductiveNormalizationRule | undefined {
  const definition = defaultUnitRegistry.definitionOf(category, sourceUnitId);
  if (!definition) {
    return undefined;
  }
  const categoryPolicy = developmentCategoryPolicy(category, activationHeight, ruleVersion);
  return Object.freeze({
    schemaVersion: POLICY_GOVERNANCE_SCHEMA_VERSION,
    ruleId: `norm.${category}.${sourceUnitId}.v${ruleVersion}`,
    ruleVersion,
    category,
    sourceUnitId,
    targetUnitId: NORMALIZED_PRODUCTIVE_UNIT_ID,
    scaleToNpu: definition.scaleToBase,
    factors: Object.freeze([
      categoryPolicy.unitNormalization,
      categoryPolicy.quality,
      categoryPolicy.verifiedDeliveryState,
      categoryPolicy.economicCategory,
    ]),
    roundingMode: 'FLOOR',
    activationHeight,
    mixesIncompatibleUnits: false,
  });
}

export function developmentNormalizationRules(
  activationHeight = 1,
  ruleVersion = 1,
): readonly ProductiveNormalizationRule[] {
  const rules: ProductiveNormalizationRule[] = [];
  for (const category of (
    [
      'ENERGY',
      'FOOD_AGRICULTURE',
      'WATER',
      'MINERALS_RAW_MATERIALS',
      'REAL_ESTATE_USE',
      'COMPUTE',
      'AI_COMPUTE',
      'MANUFACTURING',
      'LOGISTICS_TRANSPORTATION',
      'STORAGE',
      'BANDWIDTH_COMMUNICATIONS',
      'INFRASTRUCTURE',
      'GOODS',
      'SERVICES',
      'AUTOMATED_MACHINE_OUTPUT',
    ] as const
  )) {
    for (const unit of defaultUnitRegistry.unitsFor(category)) {
      const rule = developmentNormalizationRule(category, unit.unitId, activationHeight, ruleVersion);
      if (rule) {
        rules.push(rule);
      }
    }
  }
  return Object.freeze(rules);
}

export function ruleFor(
  rules: readonly ProductiveNormalizationRule[],
  category: ProductiveCategory,
  sourceUnitId: string,
  height: number,
): ProductiveNormalizationRule | undefined {
  return [...rules]
    .filter(
      (rule) =>
        rule.category === category && rule.sourceUnitId === sourceUnitId && rule.activationHeight <= height,
    )
    .sort((left, right) => right.activationHeight - left.activationHeight || right.ruleVersion - left.ruleVersion)[0];
}

export function factorInBounds(factor: PolicyFactor): boolean {
  return factor.value >= factor.min && factor.value <= factor.max && factor.min >= 0n && factor.max > 0n;
}

export function applyFactors(
  quantity: bigint,
  factors: readonly PolicyFactor[],
  rounding: RoundingMode,
): bigint | { readonly ok: false; readonly code: 'MALFORMED_NORMALIZATION' } {
  let current = quantity;
  for (const factor of factors) {
    if (!factorInBounds(factor)) {
      return { ok: false, code: 'MALFORMED_NORMALIZATION' };
    }
    current = mulDiv(current, factor.value, WEIGHT_SCALE, rounding);
  }
  return current;
}

export function normalizeContribution(input: {
  readonly category: ProductiveCategory;
  readonly sourceUnitId: string;
  readonly sourceQuantity: bigint;
  readonly height: number;
  readonly rules: readonly ProductiveNormalizationRule[];
}):
  | { readonly ok: true; readonly npu: NormalizedProductiveUnit }
  | { readonly ok: false; readonly code: 'WRONG_UNIT' | 'MALFORMED_NORMALIZATION' } {
  if (input.sourceQuantity < 0n) {
    return { ok: false, code: 'MALFORMED_NORMALIZATION' };
  }
  const rule = ruleFor(input.rules, input.category, input.sourceUnitId, input.height);
  if (!rule) {
    return { ok: false, code: 'WRONG_UNIT' };
  }
  if (rule.category !== input.category || rule.sourceUnitId !== input.sourceUnitId) {
    return { ok: false, code: 'WRONG_UNIT' };
  }
  const scaled = input.sourceQuantity * rule.scaleToNpu;
  const factored = applyFactors(scaled, rule.factors, rule.roundingMode);
  if (typeof factored !== 'bigint') {
    return factored;
  }
  return {
    ok: true,
    npu: Object.freeze({
      unitId: NORMALIZED_PRODUCTIVE_UNIT_ID,
      category: input.category,
      quantity: factored,
      sourceUnitId: input.sourceUnitId,
      sourceQuantity: input.sourceQuantity,
      ruleId: rule.ruleId,
      ruleVersion: rule.ruleVersion,
      factorsApplied: rule.factors,
      notFiatValue: true,
      notMarketCapitalization: true,
      notLegalPropertyTitle: true,
      notGuaranteedEconomicValue: true,
    }),
  };
}

export function issuanceBasisFromNpu(npu: NormalizedProductiveUnit): bigint {
  return npu.quantity;
}

void boundedFactor;
