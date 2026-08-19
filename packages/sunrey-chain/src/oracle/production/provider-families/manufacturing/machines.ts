/**
 * Machine activity, automated-machine output, and counter semantics.
 *
 * Machine operating time is usage/capacity evidence. It is not product
 * count. A robot moving for three hours is not three hours of goods.
 * Cumulative lifetime counters are never treated as period production.
 */

import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import { convertExact } from '../../../../units/convert.ts';
import { exactQuantity } from '../../../../units/quantity.ts';
import type { MachineCounter, ManufacturingObservation, ManufacturingRejection } from './types.ts';

export function machineRuntimeIsNotOutput(observation: ManufacturingObservation): boolean {
  if (observation.machineActivityKind === null) {
    return false;
  }
  if (observation.factType === 'AUTOMATED_MACHINE_OUTPUT' && observation.realizedEvidenceKind !== null) {
    return false;
  }
  return observation.unit === 'machine_h' || observation.machineActivityKind !== null;
}

export function evaluateMachineOutput(
  observation: ManufacturingObservation,
): Result<{ readonly periodQuantity: bigint }, ManufacturingRejection> {
  if (observation.factType === 'AUTOMATED_MACHINE_OUTPUT') {
    if (observation.machineActivityKind === 'ONLINE' && observation.realizedEvidenceKind === null) {
      return err({
        code: 'MACHINE_ONLINE_IS_NOT_OUTPUT',
        detail: 'an online machine is not a realized productive output event',
      });
    }
    if (!observation.identities.machineRef && !observation.identities.robotRef) {
      return err({
        code: 'MISSING_MACHINE_IDENTITY',
        detail: 'AUTOMATED_MACHINE_OUTPUT requires machine or robot object identity',
      });
    }
    if (!observation.measurementPeriod) {
      return err({
        code: 'MISSING_MEASUREMENT_PERIOD',
        detail: 'AUTOMATED_MACHINE_OUTPUT requires a measurement period',
      });
    }
    if (observation.numericValue.length === 0) {
      return err({ code: 'MISSING_OUTPUT_QUANTITY', detail: 'AUTOMATED_MACHINE_OUTPUT requires an output quantity' });
    }
    if (observation.unit === 'machine_h') {
      return err({
        code: 'MACHINE_RUNTIME_IS_NOT_OUTPUT',
        detail: 'machine runtime may establish usage or capacity, not manufactured output',
      });
    }
  }
  if (
    observation.factType !== 'AUTOMATED_MACHINE_OUTPUT' &&
    observation.factType !== 'MANUFACTURING_CAPACITY' &&
    observation.machineActivityKind !== null &&
    observation.realizedEvidenceKind === null
  ) {
    return err({
      code: 'MACHINE_RUNTIME_IS_NOT_OUTPUT',
      detail: 'machine motion or runtime is supporting evidence, not automatic output',
    });
  }
  if (observation.counter) {
    return evaluateMachineCounter(observation.counter);
  }
  return ok({ periodQuantity: BigInt(observation.numericValue) });
}

export function evaluateMachineCounter(
  counter: MachineCounter,
): Result<{ readonly periodQuantity: bigint }, ManufacturingRejection> {
  if (counter.kind === 'INTERVAL_OUTPUT') {
    return ok({ periodQuantity: counter.reading });
  }
  if (counter.previousReading === undefined) {
    return err({
      code: 'COUNTER_LIFETIME_IS_NOT_PERIOD',
      detail: 'cumulative lifetime machine count is not period production',
    });
  }
  if (counter.reading >= counter.previousReading) {
    return ok({ periodQuantity: counter.reading - counter.previousReading });
  }
  if (counter.rolloverMax !== undefined && counter.rolloverMax > counter.previousReading) {
    const afterRollover = counter.rolloverMax - counter.previousReading + counter.reading;
    return ok({ periodQuantity: afterRollover });
  }
  return err({
    code: 'COUNTER_RESET',
    detail: 'undocumented cumulative-counter reset or rollover requires review and is not period output',
  });
}

export function refuseMachineHoursAsUnit(quantity: bigint): Result<never, ManufacturingRejection> {
  const source = exactQuantity({ mantissa: quantity, scale: 0, unitId: 'machine_h' });
  if (!source.ok) {
    return err({ code: 'MACHINE_TIME_CANNOT_BECOME_UNIT', detail: source.error.detail });
  }
  const converted = convertExact({ source: source.value, targetUnitId: 'UNIT' });
  if (converted.ok) {
    return err({
      code: 'MACHINE_TIME_CANNOT_BECOME_UNIT',
      detail: 'unit catalog must refuse machine_h → UNIT; machine time is not product count',
    });
  }
  return err({
    code: 'MACHINE_TIME_CANNOT_BECOME_UNIT',
    detail: converted.error.detail,
  });
}

export function machineHoursAreNotProductCount(): true {
  const refused = refuseMachineHoursAsUnit(3n);
  return !refused.ok && refused.error.code === 'MACHINE_TIME_CANNOT_BECOME_UNIT';
}
