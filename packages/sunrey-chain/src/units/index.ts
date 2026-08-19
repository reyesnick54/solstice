export {
  CANONICAL_UNIT_REGISTRY_ID,
  CONTEXT_REQUIREMENTS,
  CONVERSION_ENGINE_ID,
  CONVERSION_OUTCOMES,
  CONVERSION_RULE_IDS,
  FAKE_UNIVERSAL_UNIT,
  FLOAT_MATH_USED,
  LOSSY_CONVERSION_ALLOWED,
  MEASUREMENT_DIMENSIONS,
  NORMALIZATION_CONSTITUTION_VERSION,
  PRODUCTION_ACTIVE,
  RESOURCE_CLASSES,
  SEMANTIC_QUALIFIERS,
  TOKEN_INFERENCE_ALIAS_VERSION,
  TOKEN_INFERENCE_QUALIFIER,
} from './constitution.ts';
export type {
  ContextRequirement,
  ConversionOutcome,
  ConversionRuleId,
  MeasurementDimension,
  ResourceClass,
  SemanticQualifier,
} from './constitution.ts';
export type {
  CanonicalUnitDefinition,
  ExactConversion,
  ExactQuantity,
  NormalizationClock,
  NormalizationContext,
  NormalizationReceipt,
  NormalizationRefusal,
} from './types.ts';
export {
  canonicalizeQuantity,
  exactQuantity,
  integerMantissaOf,
  integerQuantity,
  quantitiesEqual,
  quantityRational,
  reduceRational,
  scaleByRational,
} from './quantity.ts';
export { CANONICAL_UNIT_DEFINITIONS } from './catalog.ts';
export { convertExact, knownUnitId, lookupUnit, reproduceReceipt, resolveDurationSeconds, sanitizeContext } from './convert.ts';
export { CanonicalUnitRegistry, defaultCanonicalUnitRegistry, normalizeUnit } from './registry.ts';
export {
  isOracleSourceUnit,
  productiveFacadeRemainsCategoryScoped,
  resolveOracleUnit,
  resolveProductiveUnit,
} from './adapters.ts';
