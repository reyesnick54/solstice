/**
 * Compatibility adapters. Chunk 119 will migrate consumers.
 * These maps do not rewrite oracle or productive APIs.
 */

import { UNIT_CODES, type UnitCode } from '../oracle/types.ts';
import { defaultUnitRegistry } from '../productive/units.ts';
import type { ProductiveCategory } from '../productive/types.ts';
import { lookupUnit } from './convert.ts';
import type { CanonicalUnitDefinition } from './types.ts';

export function resolveOracleUnit(unit: string): CanonicalUnitDefinition | undefined {
  return lookupUnit(unit);
}

export function isOracleSourceUnit(unit: string): unit is UnitCode {
  return (UNIT_CODES as readonly string[]).includes(unit);
}

export function resolveProductiveUnit(
  category: ProductiveCategory,
  unitId: string,
): CanonicalUnitDefinition | undefined {
  if (!defaultUnitRegistry.isAllowed(category, unitId)) {
    return lookupUnit(unitId);
  }
  return lookupUnit(unitId);
}

export function productiveFacadeRemainsCategoryScoped(): true {
  return true;
}
