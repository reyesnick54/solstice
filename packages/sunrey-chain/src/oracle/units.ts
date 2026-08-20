/**
 * Oracle fixed-quantity helpers. Cross-vocabulary conversion lives in
 * the Chunk 118 canonical registry at packages/sunrey-chain/src/units.
 * This module keeps the existing oracle FixedQuantity API.
 */

import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { FixedQuantity, OracleRejection, UnitCode } from './types.ts';
import { UNIT_CODES } from './types.ts';

export const UNIT_FAMILIES = Object.freeze({
  ENERGY: ['Wh', 'kWh', 'MWh'],
  MASS: ['kg', 'tonne'],
  VOLUME: ['L', 'm3'],
  AREA: ['m2'],
  AREA_TIME: ['m2_hour'],
  COMPUTE_TIME: ['compute_s', 'gpu_s', 'machine_h'],
  INFERENCE: ['token_inference'],
  COUNT: ['units_produced'],
  FREIGHT: ['tonne_km'],
  STORAGE: ['GB', 'TB'],
  BANDWIDTH: ['GB_s', 'B_s'],
  FACILITY_TIME: ['facility_hour'],
  SERVICE_TIME: ['service_hour'],
} as const);

const FAMILY_SCALE: Readonly<Record<UnitCode, { readonly family: string; readonly toBase: bigint }>> =
  Object.freeze({
    Wh: { family: 'ENERGY', toBase: 1n },
    kWh: { family: 'ENERGY', toBase: 1_000n },
    MWh: { family: 'ENERGY', toBase: 1_000_000n },
    kg: { family: 'MASS', toBase: 1n },
    tonne: { family: 'MASS', toBase: 1_000n },
    L: { family: 'VOLUME', toBase: 1n },
    m3: { family: 'VOLUME', toBase: 1_000n },
    m2: { family: 'AREA', toBase: 1n },
    m2_hour: { family: 'AREA_TIME', toBase: 3_600n },
    compute_s: { family: 'COMPUTE_TIME', toBase: 1n },
    gpu_s: { family: 'COMPUTE_TIME', toBase: 1n },
    machine_h: { family: 'COMPUTE_TIME', toBase: 3_600n },
    token_inference: { family: 'INFERENCE', toBase: 1n },
    units_produced: { family: 'COUNT', toBase: 1n },
    tonne_km: { family: 'FREIGHT', toBase: 1n },
    GB: { family: 'STORAGE', toBase: 1n },
    TB: { family: 'STORAGE', toBase: 1_000n },
    GB_s: { family: 'BANDWIDTH', toBase: 1_000_000_000n },
    B_s: { family: 'BANDWIDTH', toBase: 1n },
    facility_hour: { family: 'FACILITY_TIME', toBase: 1n },
    service_hour: { family: 'SERVICE_TIME', toBase: 1n },
  });

export const MAX_QUANTITY_MANTISSA = 10n ** 38n - 1n;
export const MAX_SCALE = 12;

export function isRegisteredUnit(code: string): code is UnitCode {
  return (UNIT_CODES as readonly string[]).includes(code);
}

export function unitFamily(code: UnitCode): string {
  return FAMILY_SCALE[code].family;
}

export function unitsCompatible(left: UnitCode, right: UnitCode): boolean {
  return FAMILY_SCALE[left].family === FAMILY_SCALE[right].family && left === right;
}

export function assertIntegerScale(scale: number): Result<true, OracleRejection> {
  if (!Number.isInteger(scale) || scale < 0 || scale > MAX_SCALE) {
    return err({ code: 'ORACLE_SCHEMA_INVALID', detail: 'quantity scale must be an integer 0..12' });
  }
  return ok(true);
}

export function quantity(
  mantissa: bigint,
  scale: number,
  unit: UnitCode,
): Result<FixedQuantity, OracleRejection> {
  const scaleOk = assertIntegerScale(scale);
  if (!scaleOk.ok) {
    return scaleOk;
  }
  if (mantissa < 0n || mantissa > MAX_QUANTITY_MANTISSA) {
    return err({ code: 'ORACLE_OUT_OF_BOUNDS', detail: 'quantity mantissa outside integer bounds' });
  }
  if (!isRegisteredUnit(unit)) {
    return err({ code: 'ORACLE_WRONG_UNIT', detail: `unknown unit ${unit}` });
  }
  return ok(
    Object.freeze({
      schemaVersion: 1 as const,
      mantissa,
      scale,
      unit,
    }),
  );
}

export function sameUnitAndScale(left: FixedQuantity, right: FixedQuantity): boolean {
  return left.unit === right.unit && left.scale === right.scale;
}

export function rejectIncompatibleUnits(
  expected: UnitCode,
  actual: UnitCode,
): Result<true, OracleRejection> {
  if (expected !== actual) {
    return err({
      code: 'ORACLE_INCOMPATIBLE_UNITS',
      detail: `cannot mix ${actual} with ${expected}`,
    });
  }
  return ok(true);
}

export function normalizeToScale(
  value: FixedQuantity,
  targetScale: number,
): Result<FixedQuantity, OracleRejection> {
  const scaleOk = assertIntegerScale(targetScale);
  if (!scaleOk.ok) {
    return scaleOk;
  }
  if (value.scale === targetScale) {
    return ok(value);
  }
  if (value.scale < targetScale) {
    const factor = 10n ** BigInt(targetScale - value.scale);
    const next = value.mantissa * factor;
    if (next > MAX_QUANTITY_MANTISSA) {
      return err({ code: 'ORACLE_OUT_OF_BOUNDS', detail: 'normalized quantity exceeds bound' });
    }
    return quantity(next, targetScale, value.unit);
  }
  return err({
    code: 'ORACLE_INCOMPATIBLE_UNITS',
    detail: 'refusing lossy scale reduction during aggregation',
  });
}
