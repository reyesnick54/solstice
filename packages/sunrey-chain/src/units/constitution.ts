/**
 * Chunk 118 — Canonical SunRey/MoonRey economic unit constitution.
 *
 * One normalization authority inside packages/sunrey-chain. This extends
 * the Chunk 43 protocol UnitRegistry contract. Productive and machine
 * UnitRegistry imports remain compatibility facades.
 *
 * Historical receipts keep this version. A later conversion change must
 * not silently reinterpret MoonRey evidence.
 */

export const NORMALIZATION_CONSTITUTION_VERSION = 'sunrey.economic-unit.normalization.v1' as const;
export const CANONICAL_UNIT_REGISTRY_ID = 'sunrey.unit-registry.canonical.v1' as const;
export const CONVERSION_ENGINE_ID = 'sunrey.unit-conversion.v1' as const;

export const FLOAT_MATH_USED = false;
export const LOSSY_CONVERSION_ALLOWED = false;
export const FAKE_UNIVERSAL_UNIT = false;
export const PRODUCTION_ACTIVE = false;

export const MEASUREMENT_DIMENSIONS = [
  'ENERGY',
  'MASS',
  'VOLUME',
  'AREA',
  'TIME',
  'AREA_TIME',
  'VOLUME_TIME',
  'GPU_TIME',
  'CPU_TIME',
  'GENERIC_COMPUTE_TIME',
  'AI_TOKEN_COUNT',
  'MACHINE_TIME',
  'ITEM_COUNT',
  'MASS_DISTANCE',
  'DATA_VOLUME',
  'DATA_RATE',
  'FACILITY_TIME',
  'SERVICE_TIME',
] as const;
export type MeasurementDimension = (typeof MEASUREMENT_DIMENSIONS)[number];

export const CONVERSION_OUTCOMES = [
  'SUCCEED_EXACTLY',
  'REQUIRE_CONTEXT',
  'INCOMPATIBLE_DIMENSION',
  'LOSSY_CONVERSION_FORBIDDEN',
  'UNKNOWN_UNIT',
] as const;
export type ConversionOutcome = (typeof CONVERSION_OUTCOMES)[number];

export const CONVERSION_RULE_IDS = [
  'identity.v1',
  'scale.same-dimension.v1',
  'alias.equivalent.v1',
  'item-count.alias.v1',
  'token.inference.alias.v1',
  'context.area-duration.v1',
  'context.volume-duration.v1',
  'context.rate-duration.v1',
  'context.compute-classify.v1',
] as const;
export type ConversionRuleId = (typeof CONVERSION_RULE_IDS)[number];

export const CONTEXT_REQUIREMENTS = [
  'DURATION',
  'RESOURCE_CLASS',
  'RESOURCE_COUNT',
  'SEMANTIC_QUALIFIER',
  'FACT_TYPE',
  'PRODUCTIVE_CATEGORY',
] as const;
export type ContextRequirement = (typeof CONTEXT_REQUIREMENTS)[number];

export const RESOURCE_CLASSES = ['CPU', 'GPU'] as const;
export type ResourceClass = (typeof RESOURCE_CLASSES)[number];

export const SEMANTIC_QUALIFIERS = [
  'INFERENCE_PROCESSED_TOKENS',
  'INFERENCE_GENERATED_TOKENS',
  'TRAINING_TOKENS',
  'ITEM_OUTPUT',
  'MACHINE_USAGE',
  'UNQUALIFIED',
] as const;
export type SemanticQualifier = (typeof SEMANTIC_QUALIFIERS)[number];

export const TOKEN_INFERENCE_QUALIFIER = 'INFERENCE_PROCESSED_TOKENS' as const;
export const TOKEN_INFERENCE_ALIAS_VERSION = 'token.inference.alias.v1' as const;
