/**
 * Energy quantity normalization through the Chunk 118/119 constitution.
 *
 * Accepted physical observations use Wh / kWh / MWh only. Floating point
 * is refused. Original source quantity and unit are preserved beside the
 * canonical measurement.
 *
 * Nameplate capacity in W / kW / MW is a power dimension that the current
 * unit constitution does not represent. That path returns
 * UNIT_EXTENSION_REQUIRED rather than storing MWh as MW.
 */

import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import { exactQuantity } from '../../../../units/quantity.ts';
import { measureCanonical } from '../../../../units/measurement.ts';
import type { CanonicalProductiveMeasurement } from '../../../../units/measurement.ts';
import type { ClaimType, ProductiveCategory } from '../../../../productive/types.ts';
import {
  energyRejection,
  isEnergyPowerUnitCandidate,
  isEnergyUnitCode,
  type EnergyIntegerQuantity,
  type EnergyRejection,
  type EnergySupportedFactType,
  type EnergyTimeWindow,
} from './types.ts';

const TO_WH: Readonly<Record<string, bigint>> = Object.freeze({
  Wh: 1n,
  kWh: 1_000n,
  MWh: 1_000_000n,
});

const INTEGER_RE = /^-?\d+$/;

export function parseEnergyIntegerQuantity(quantity: string, unit: string): Result<EnergyIntegerQuantity, EnergyRejection> {
  if (quantity.includes('.') || /e/i.test(quantity) || !INTEGER_RE.test(quantity)) {
    return err(energyRejection('FLOAT_FORBIDDEN', 'energy quantities must be integer minor-unit strings', false));
  }
  let mantissa: bigint;
  try {
    mantissa = BigInt(quantity);
  } catch {
    return err(energyRejection('FLOAT_FORBIDDEN', `unparseable quantity ${quantity}`, false));
  }
  if (mantissa < 0n) {
    return err(energyRejection('NEGATIVE_PRODUCTION_FORBIDDEN', 'negative energy quantities are refused', false));
  }
  if (isEnergyPowerUnitCandidate(unit)) {
    return err(
      energyRejection(
        'UNIT_EXTENSION_REQUIRED',
        `instantaneous power unit ${unit} is not in the energy UnitCode vocabulary; do not store MWh as MW`,
        false,
      ),
    );
  }
  if (unit === 'units_produced') {
    return ok(
      Object.freeze({
        mantissa,
        scale: 0,
        unit: 'units_produced',
        originalMantissa: mantissa,
        originalUnit: unit,
      }),
    );
  }
  if (!isEnergyUnitCode(unit)) {
    return err(energyRejection('WRONG_UNIT', `energy observations accept Wh, kWh, or MWh; received ${unit}`, false));
  }
  return ok(
    Object.freeze({
      mantissa,
      scale: 0,
      unit,
      originalMantissa: mantissa,
      originalUnit: unit,
    }),
  );
}

export function quantityToWh(quantity: EnergyIntegerQuantity): Result<bigint, EnergyRejection> {
  if (quantity.unit === 'units_produced') {
    return err(energyRejection('WRONG_UNIT', 'reference-price units are not energy', false));
  }
  const factor = TO_WH[quantity.unit];
  if (factor === undefined) {
    return err(energyRejection('WRONG_UNIT', `cannot convert ${quantity.unit} to Wh`, false));
  }
  return ok(quantity.mantissa * factor);
}

export function samePhysicalEnergy(left: EnergyIntegerQuantity, right: EnergyIntegerQuantity): boolean {
  const a = quantityToWh(left);
  const b = quantityToWh(right);
  return a.ok && b.ok && a.value === b.value;
}

export function normalizeEnergyMeasurement(input: {
  readonly quantity: EnergyIntegerQuantity;
  readonly factType: EnergySupportedFactType;
  readonly productiveCategory: ProductiveCategory;
  readonly claimType: ClaimType | null;
  readonly time: EnergyTimeWindow;
  readonly mappingId: string | null;
  readonly mappingVersion: number | null;
}): Result<CanonicalProductiveMeasurement, EnergyRejection> {
  if (input.quantity.unit === 'units_produced') {
    return err(energyRejection('WRONG_UNIT', 'reference price is not a physical energy quantity', false));
  }
  const source = exactQuantity({
    mantissa: input.quantity.mantissa,
    unitId: input.quantity.unit,
    scale: 0,
  });
  if (!source.ok) {
    return err(energyRejection('NORMALIZATION_FAILED', source.error.detail, false));
  }
  const measured = measureCanonical({
    sourceQuantity: source.value,
    productiveCategory: input.productiveCategory,
    factType: input.factType,
    claimType: input.claimType,
    targetUnit: 'Wh',
    context: {
      measurementStart: input.time.measurementStartUnix,
      measurementEnd: input.time.measurementEndUnix,
      factType: input.factType,
      productiveCategory: input.productiveCategory,
    },
    measurementPeriod: {
      startUnix: input.time.measurementStartUnix,
      endUnix: input.time.measurementEndUnix,
    },
    mappingId: input.mappingId,
    mappingVersion: input.mappingVersion,
  });
  if (!measured.ok) {
    return err(energyRejection('NORMALIZATION_FAILED', measured.error.detail, false));
  }
  return ok(measured.value);
}
