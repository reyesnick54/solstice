/**
 * Productive economy safety for Wave 5 preparation.
 *
 * Supports independent source classes for direct sensor, operator,
 * government, satellite, enterprise system, and derived model inputs.
 * Does not implement full production MoonRey oracle networks.
 */

import type { NormalizedEconomicObservation } from '../types.ts';
import type { ExplanationCode } from './types.ts';

export const PRODUCTIVE_SOURCE_CLASSES = [
  'DIRECT_SENSOR',
  'PRIMARY_OPERATOR',
  'GOVERNMENT_REFERENCE',
  'SATELLITE_REMOTE',
  'ENTERPRISE_SYSTEM',
  'DERIVED_MODEL',
] as const;

export type ProductiveSourceClass = (typeof PRODUCTIVE_SOURCE_CLASSES)[number];

export function isProductiveSourceClass(value: string): value is ProductiveSourceClass {
  return (PRODUCTIVE_SOURCE_CLASSES as readonly string[]).includes(value);
}

export function assessProductiveSourceClasses(
  observations: readonly NormalizedEconomicObservation[],
): { readonly satisfied: boolean; readonly presentClasses: readonly string[]; readonly codes: readonly ExplanationCode[] } {
  const present = [...new Set(observations.map((row) => row.sourceClass))].sort();
  const productive = present.filter((row) => isProductiveSourceClass(row));
  const codes: ExplanationCode[] = [];
  if (productive.length === 0) {
    codes.push('PRODUCTIVE_SOURCE_CLASS_REQUIRED');
    return Object.freeze({ satisfied: false, presentClasses: Object.freeze(present), codes: Object.freeze(codes) });
  }
  return Object.freeze({ satisfied: true, presentClasses: Object.freeze(productive), codes: Object.freeze(codes) });
}

export const PRODUCTIVE_CONSENSUS_EXTENSIONS = Object.freeze({
  moonreyOracleNetworkImplemented: false,
  supportsDirectSensor: true,
  supportsOperator: true,
  supportsGovernmentReference: true,
  supportsSatellite: true,
  supportsEnterpriseSystem: true,
  supportsDerivedModel: true,
});
