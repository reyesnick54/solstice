/**
 * Productive oracle source class taxonomy and guards.
 *
 * MARKET_REFERENCE is reference data — it is never proof of physical production.
 */

import {
  MARKET_REFERENCE_IS_NOT_PRODUCTION_PROOF,
  PRODUCTIVE_ORACLE_SOURCE_CLASSES,
  type ProductiveOracleSourceClass,
} from './types.ts';

export { PRODUCTIVE_ORACLE_SOURCE_CLASSES };

/** Source classes that can attest to direct physical production. */
export const DIRECT_PRODUCTION_SOURCE_CLASSES: readonly ProductiveOracleSourceClass[] = Object.freeze([
  'DIRECT_SENSOR',
  'PRIMARY_OPERATOR',
  'UTILITY_OR_GRID',
  'ENTERPRISE_SYSTEM',
  'GOVERNMENT',
  'SATELLITE',
  'GEOSPATIAL',
  'LOGISTICS_OPERATOR',
  'NETWORK_OPERATOR',
]);

/** Source classes that provide corroboration but not standalone production proof. */
export const CORROBORATIVE_SOURCE_CLASSES: readonly ProductiveOracleSourceClass[] = Object.freeze([
  'SATELLITE',
  'GEOSPATIAL',
  'GOVERNMENT',
  'ACADEMIC',
  'UTILITY_OR_GRID',
]);

/** Source classes that must never substitute for production evidence. */
export const REFERENCE_ONLY_SOURCE_CLASSES: readonly ProductiveOracleSourceClass[] = Object.freeze([
  'MARKET_REFERENCE',
  'DERIVED_MODEL',
  'AGGREGATOR',
]);

export function isProductiveOracleSourceClass(value: string): value is ProductiveOracleSourceClass {
  return (PRODUCTIVE_ORACLE_SOURCE_CLASSES as readonly string[]).includes(value);
}

export function isDirectProductionEvidence(sourceClass: ProductiveOracleSourceClass): boolean {
  return (DIRECT_PRODUCTION_SOURCE_CLASSES as readonly string[]).includes(sourceClass);
}

export function isReferenceOnlySource(sourceClass: ProductiveOracleSourceClass): boolean {
  return (REFERENCE_ONLY_SOURCE_CLASSES as readonly string[]).includes(sourceClass);
}

export function marketReferenceCannotSubstituteForProduction(
  sourceClass: ProductiveOracleSourceClass,
): boolean {
  return MARKET_REFERENCE_IS_NOT_PRODUCTION_PROOF && sourceClass === 'MARKET_REFERENCE';
}

export function rejectWrongSourceClass(
  sourceClass: ProductiveOracleSourceClass,
  permitted: readonly ProductiveOracleSourceClass[],
): boolean {
  return !(permitted as readonly string[]).includes(sourceClass);
}
