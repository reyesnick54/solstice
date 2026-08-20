import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import { exactQuantity } from '../../../../units/quantity.ts';
import type { ExactQuantity } from '../../../../units/types.ts';
import {
  INFRASTRUCTURE_FACILITY_TIME_V2,
  LEGACY_INFRASTRUCTURE_MACHINE_H_V1,
  LEGACY_MACHINE_H_REINTERPRETED,
  type InfrastructureRefusal,
  type InfrastructureUnitSemantics,
} from './types.ts';

const SECONDS_PER_HOUR = 3_600n;
const INTEGER_RE = /^-?\d+$/;

export function parseIntegerMantissa(
  numericValue: string,
  code: InfrastructureRefusal['code'] = 'FLOAT_QUANTITY_FORBIDDEN',
): Result<bigint, InfrastructureRefusal> {
  if (numericValue.includes('.') || numericValue.toLowerCase().includes('e')) {
    return err({ code, detail: 'floating-point infrastructure quantities are refused' });
  }
  if (!INTEGER_RE.test(numericValue)) {
    return err({ code, detail: 'infrastructure quantities must be integer strings' });
  }
  if (numericValue.startsWith('-')) {
    return err({ code: 'FLOAT_QUANTITY_FORBIDDEN', detail: 'negative infrastructure quantities are refused' });
  }
  return ok(BigInt(numericValue));
}

export function deriveFacilityTime(input: {
  readonly facilityUnits: bigint;
  readonly durationSeconds: bigint;
}): Result<ExactQuantity, InfrastructureRefusal> {
  if (input.durationSeconds <= 0n || input.facilityUnits <= 0n) {
    return err({
      code: 'FACILITY_TIME_INEXACT',
      detail: 'facility-time requires a positive facility count and duration',
    });
  }
  const product = input.facilityUnits * input.durationSeconds;
  if (product % SECONDS_PER_HOUR !== 0n) {
    return err({
      code: 'FACILITY_TIME_INEXACT',
      detail: 'facility × duration must convert to an exact integer facility-hour',
    });
  }
  const quantity = exactQuantity({
    mantissa: product / SECONDS_PER_HOUR,
    unitId: 'facility_hour',
  });
  if (!quantity.ok) {
    return err({ code: 'INCOMPATIBLE_UNIT', detail: quantity.error.detail });
  }
  return ok(quantity.value);
}

export function reproduceLegacyMachineH(mantissa: bigint): Result<ExactQuantity, InfrastructureRefusal> {
  const quantity = exactQuantity({ mantissa, unitId: 'machine_h' });
  if (!quantity.ok) {
    return err({ code: 'INCOMPATIBLE_UNIT', detail: quantity.error.detail });
  }
  return ok(quantity.value);
}

export function refuseSilentMachineHForFacilityHour(): Result<never, InfrastructureRefusal> {
  return err({
    code: 'MACHINE_H_USED_FOR_FACILITY_HOUR',
    detail: 'new infrastructure feeds must use facility_hour; machine_h is legacy only',
  });
}

export function unitSemanticsFor(unit: string, preferFacilityTime: boolean): Result<InfrastructureUnitSemantics, InfrastructureRefusal> {
  if (unit === 'facility_hour') {
    return ok(INFRASTRUCTURE_FACILITY_TIME_V2);
  }
  if (unit === 'machine_h' && !preferFacilityTime) {
    return ok(LEGACY_INFRASTRUCTURE_MACHINE_H_V1);
  }
  if (unit === 'machine_h') {
    return err({
      code: 'MACHINE_H_USED_FOR_FACILITY_HOUR',
      detail: 'new family feeds cannot silently use machine_h as facility-hour',
    });
  }
  return err({ code: 'WRONG_UNIT', detail: `unsupported infrastructure unit ${unit}` });
}

export function legacyMachineHReinterpreted(): false {
  return LEGACY_MACHINE_H_REINTERPRETED;
}
