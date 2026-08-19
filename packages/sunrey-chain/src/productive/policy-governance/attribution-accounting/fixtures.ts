import { ATTRIBUTION_SHARE_SCALE, type AttributionEventObservation } from './types.ts';

export const DEMO_HOUR_START = 1_800_000_000n;
export const DEMO_HOUR_MID = 1_800_001_800n;
export const DEMO_HOUR_END = 1_800_003_600n;

export function manufacturingObservation(
  overrides: Partial<AttributionEventObservation> = {},
): AttributionEventObservation {
  return Object.freeze({
    economicEventId: 'event.factory.hour-1',
    claimId: 'claim.mfg.1',
    contributionId: 'contrib.mfg.1',
    category: 'MANUFACTURING',
    claimType: 'OUTPUT',
    objectId: 'object.line-a',
    controllerId: 'controller.plant',
    providerId: 'oracle.mes.1',
    geographyId: 'geo.plant-1',
    sourceUnitId: 'units_produced',
    sourceQuantity: 100n,
    validFromUnixSeconds: DEMO_HOUR_START,
    validUntilUnixSeconds: DEMO_HOUR_END,
    oracleFactIds: ['fact.mes.output.1'],
    batchId: 'batch.A',
    independentlyEvidenced: false,
    ...overrides,
  });
}

export function goodsObservation(
  overrides: Partial<AttributionEventObservation> = {},
): AttributionEventObservation {
  return manufacturingObservation({
    economicEventId: 'event.goods.hour-1',
    claimId: 'claim.goods.1',
    contributionId: 'contrib.goods.1',
    category: 'GOODS',
    objectId: 'object.sku-a',
    oracleFactIds: ['fact.mes.output.1'],
    ...overrides,
  });
}

export function machineObservation(
  overrides: Partial<AttributionEventObservation> = {},
): AttributionEventObservation {
  return manufacturingObservation({
    economicEventId: 'event.machine.hour-1',
    claimId: 'claim.machine.1',
    contributionId: 'contrib.machine.1',
    category: 'AUTOMATED_MACHINE_OUTPUT',
    objectId: 'object.robot-1',
    oracleFactIds: ['fact.mes.output.1'],
    ...overrides,
  });
}

export function logisticsObservation(
  overrides: Partial<AttributionEventObservation> = {},
): AttributionEventObservation {
  return Object.freeze({
    economicEventId: 'event.logistics.haul-1',
    claimId: 'claim.logistics.1',
    contributionId: 'contrib.logistics.1',
    category: 'LOGISTICS_TRANSPORTATION',
    claimType: 'DELIVERY',
    objectId: 'object.truck-1',
    controllerId: 'controller.carrier',
    providerId: 'oracle.tms.1',
    geographyId: 'geo.corridor-9',
    sourceUnitId: 't_km',
    sourceQuantity: 250n,
    validFromUnixSeconds: DEMO_HOUR_END,
    validUntilUnixSeconds: DEMO_HOUR_END + 3_600n,
    oracleFactIds: ['fact.tms.haul.1'],
    independentlyEvidenced: true,
    ...overrides,
  });
}

export function storageObservation(
  overrides: Partial<AttributionEventObservation> = {},
): AttributionEventObservation {
  return Object.freeze({
    economicEventId: 'event.storage.hold-1',
    claimId: 'claim.storage.1',
    contributionId: 'contrib.storage.1',
    category: 'STORAGE',
    claimType: 'USAGE',
    objectId: 'object.warehouse-1',
    controllerId: 'controller.warehouse',
    providerId: 'oracle.wms.1',
    geographyId: 'geo.warehouse-1',
    sourceUnitId: 'm3',
    sourceQuantity: 40n,
    validFromUnixSeconds: DEMO_HOUR_END,
    validUntilUnixSeconds: DEMO_HOUR_END + 86_400n,
    oracleFactIds: ['fact.wms.hold.1'],
    independentlyEvidenced: true,
    ...overrides,
  });
}

export { ATTRIBUTION_SHARE_SCALE };
