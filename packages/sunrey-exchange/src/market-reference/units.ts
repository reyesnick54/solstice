/**
 * Commodity unit handling for market reference observations.
 *
 * Preserves source units. Conversions are explicit and provenance-bearing.
 * Never silently normalizes USD/oz into USD/kg.
 */

import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { CommodityCode, CommodityUnit, UnitTransformation } from './types.ts';

export const TROY_OZ: CommodityUnit = Object.freeze({
  unitId: 'troy_oz',
  symbol: 'troy oz',
  dimension: 'MASS',
});

export const KILOGRAM: CommodityUnit = Object.freeze({
  unitId: 'kg',
  symbol: 'kg',
  dimension: 'MASS',
});

export const POUND: CommodityUnit = Object.freeze({
  unitId: 'lb',
  symbol: 'lb',
  dimension: 'MASS',
});

export const GRAM: CommodityUnit = Object.freeze({
  unitId: 'g',
  symbol: 'g',
  dimension: 'MASS',
});

const COMMODITY_DEFAULT_UNITS: Readonly<Record<CommodityCode, CommodityUnit>> = Object.freeze({
  gold: TROY_OZ,
  silver: TROY_OZ,
  copper: POUND,
});

export function defaultCommodityUnit(commodity: CommodityCode): CommodityUnit {
  return COMMODITY_DEFAULT_UNITS[commodity];
}

export function lookupCommodityUnit(unitId: string): CommodityUnit | undefined {
  const known = [TROY_OZ, KILOGRAM, POUND, GRAM];
  return known.find((unit) => unit.unitId === unitId || unit.symbol === unitId);
}

export function convertMassPrice(input: {
  readonly priceMinorUnits: bigint;
  readonly sourceUnit: CommodityUnit;
  readonly targetUnit: CommodityUnit;
}): Result<{ readonly priceMinorUnits: bigint; readonly transformation: UnitTransformation }, string> {
  if (input.sourceUnit.dimension !== 'MASS' || input.targetUnit.dimension !== 'MASS') {
    return err('incompatible unit dimensions');
  }
  if (input.sourceUnit.unitId === input.targetUnit.unitId) {
    return ok({
      priceMinorUnits: input.priceMinorUnits,
      transformation: Object.freeze({
        performed: true,
        sourceUnit: input.sourceUnit,
        targetUnit: input.targetUnit,
        methodology: 'identity',
        factorNumerator: 1n,
        factorDenominator: 1n,
      }),
    });
  }
  const factor = massFactor(input.sourceUnit.unitId, input.targetUnit.unitId);
  if (!factor) {
    return err(`unsupported mass conversion ${input.sourceUnit.unitId} -> ${input.targetUnit.unitId}`);
  }
  const converted = (input.priceMinorUnits * factor.numerator) / factor.denominator;
  return ok({
    priceMinorUnits: converted,
    transformation: Object.freeze({
      performed: true,
      sourceUnit: input.sourceUnit,
      targetUnit: input.targetUnit,
      methodology: 'rational_mass_factor',
      factorNumerator: factor.numerator,
      factorDenominator: factor.denominator,
    }),
  });
}

function massFactor(from: string, to: string): { readonly numerator: bigint; readonly denominator: bigint } | null {
  const toGrams: Record<string, bigint> = {
    g: 1n,
    kg: 1_000n,
    lb: 453_592n,
    troy_oz: 31_103_476n,
  };
  const fromGrams = toGrams[from];
  const toGramsFactor = toGrams[to];
  if (fromGrams === undefined || toGramsFactor === undefined) {
    return null;
  }
  return { numerator: fromGrams, denominator: toGramsFactor };
}

export function validatePriceMinorUnits(priceMinorUnits: bigint): Result<bigint, string> {
  if (priceMinorUnits < 0n) {
    return err('negative price');
  }
  return ok(priceMinorUnits);
}
