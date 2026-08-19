/**
 * Time-based and unitized service measurement.
 *
 * Time-based services require an explicit integer duration and use
 * canonical service_hour. Hours are never inferred from invoice amount.
 * machine_h is not a human service hour. Historical machine_h records
 * are preserved without reinterpretation.
 *
 * Unitized services may use an item count when the service definition
 * is explicit. Unitized services are not economically equivalent.
 */

import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import { exactQuantity } from '../../../../units/quantity.ts';
import type { ServiceRefusal, ServiceSourceObservation } from './types.ts';
import { SERVICE_VALUE_FROM_INVOICE } from './types.ts';

export type ServiceQuantity = {
  readonly mantissa: bigint;
  readonly unit: string;
  readonly durationSeconds: bigint | null;
  readonly historicalMachineHourRecord: boolean;
};

export function evaluateServiceQuantity(
  observation: ServiceSourceObservation,
): Result<ServiceQuantity, ServiceRefusal> {
  if (observation.invoiceAmountMinorUnits !== null && observation.serviceKind === 'TIME_BASED' && observation.durationSeconds === null) {
    return err({
      code: 'HOURS_INFERRED_FROM_INVOICE',
      detail: 'do not infer hours solely from invoice amount',
    });
  }
  if (SERVICE_VALUE_FROM_INVOICE) {
    return err({
      code: 'HOURS_INFERRED_FROM_INVOICE',
      detail: 'service value is not derived directly from invoice amount',
    });
  }
  if (observation.serviceKind === 'TIME_BASED') {
    return evaluateTimeBased(observation);
  }
  if (observation.serviceKind === 'UNITIZED' || observation.serviceKind === 'DIGITAL_METER') {
    return evaluateUnitized(observation);
  }
  return evaluateMixed(observation);
}

function evaluateTimeBased(observation: ServiceSourceObservation): Result<ServiceQuantity, ServiceRefusal> {
  if (observation.unit === 'machine_h' && !observation.historicalMachineHourRecord) {
    return err({
      code: 'MACHINE_H_IS_NOT_SERVICE_HOUR',
      detail: 'machine_h is not a human or canonical service hour; use service_hour',
    });
  }
  if (observation.unit !== 'service_hour' && !(observation.unit === 'machine_h' && observation.historicalMachineHourRecord)) {
    return err({
      code: 'WRONG_UNIT',
      detail: 'time-based services use service_hour (historical machine_h records are preserved separately)',
    });
  }
  if (observation.durationSeconds === null || observation.durationSeconds <= 0n) {
    return err({
      code: 'DURATION_REQUIRED',
      detail: 'time-based services require an explicit integer duration',
    });
  }
  const built = exactQuantity({ mantissa: BigInt(observation.numericValue), scale: 0, unitId: observation.unit });
  if (!built.ok) {
    return err({ code: 'FLOAT_QUANTITY_FORBIDDEN', detail: built.error.detail });
  }
  return ok(
    Object.freeze({
      mantissa: built.value.mantissa,
      unit: observation.unit,
      durationSeconds: observation.durationSeconds,
      historicalMachineHourRecord: observation.historicalMachineHourRecord,
    }),
  );
}

function evaluateUnitized(observation: ServiceSourceObservation): Result<ServiceQuantity, ServiceRefusal> {
  if (observation.unit !== 'units_produced' && observation.unit !== 'UNIT') {
    return err({
      code: 'WRONG_UNIT',
      detail: 'unitized services use an explicit item/unit count, not a time alias',
    });
  }
  if (!observation.identity.serviceDefinitionRef) {
    return err({
      code: 'UNITIZED_EQUIVALENCE_FORBIDDEN',
      detail: 'a canonical item count requires an explicit service definition',
    });
  }
  return ok(
    Object.freeze({
      mantissa: BigInt(observation.numericValue),
      unit: observation.unit,
      durationSeconds: observation.durationSeconds,
      historicalMachineHourRecord: false,
    }),
  );
}

function evaluateMixed(observation: ServiceSourceObservation): Result<ServiceQuantity, ServiceRefusal> {
  if (observation.contribution.dualCoinAllocatedByGuesswork) {
    return err({
      code: 'DUAL_COIN_GUESSWORK_FORBIDDEN',
      detail: 'do not allocate SunRey and MoonRey for the same event by guesswork',
    });
  }
  return evaluateUnitized({ ...observation, serviceKind: 'UNITIZED' });
}

export function serviceValueFromInvoice(): false {
  return SERVICE_VALUE_FROM_INVOICE;
}

export function historicalMachineHourPreserved(observation: ServiceSourceObservation): boolean {
  return observation.historicalMachineHourRecord && observation.unit === 'machine_h';
}
