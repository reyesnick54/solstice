/**
 * ACCESS-19 productive access bridge fixtures.
 */

import type { VerifiedAvailableCapacity } from './types.ts';

const NOW = '2026-08-30T00:00:00.000Z' as const;
const UNTIL = '2026-12-31T23:59:59.000Z' as const;
const GEO = Object.freeze({ geographyId: 'geo.sim.us.fl', jurisdiction: 'US-FL' });

function baseCapacity(input: {
  readonly capacityId: string;
  readonly providerRef: string;
  readonly productiveObjectRef: string;
  readonly category: string;
  readonly canonicalUnit: string;
  readonly verifiedQuantity: bigint;
}): VerifiedAvailableCapacity {
  return Object.freeze({
    ...input,
    alreadyCommittedQuantity: 0n,
    availabilityWindow: Object.freeze({ validFrom: NOW, validUntil: UNTIL }),
    geography: GEO,
    qualityClass: 'STANDARD',
    evidenceRefs: Object.freeze([`evidence.${input.capacityId}`]),
    oracleRefs: Object.freeze([`oracle.${input.capacityId}`]),
    contributionFingerprint: `fp.${input.capacityId}`,
    observedAt: NOW,
  });
}

export const FIXTURE_SOLAR_KWH = baseCapacity({
  capacityId: 'solar.kwh',
  providerRef: 'provider.solar.farm',
  productiveObjectRef: 'object.solar.farm.001',
  category: 'ENERGY',
  canonicalUnit: 'kWh',
  verifiedQuantity: 50_000n,
});

export const FIXTURE_GPU_CLUSTER_HOUR = baseCapacity({
  capacityId: 'gpu.cluster',
  providerRef: 'provider.gpu.hyperscale',
  productiveObjectRef: 'object.gpu.cluster.001',
  category: 'AI_COMPUTE',
  canonicalUnit: 'GPU_HOUR',
  verifiedQuantity: 8_640n,
});

export const FIXTURE_ROBOT_FLEET_HOUR = baseCapacity({
  capacityId: 'robot.fleet',
  providerRef: 'provider.robotics.ops',
  productiveObjectRef: 'object.robot.fleet.001',
  category: 'AUTOMATED_MACHINE_OUTPUT',
  canonicalUnit: 'robot_hour',
  verifiedQuantity: 12_000n,
});

export const FIXTURE_AUTONOMOUS_VEHICLE_FLEET = baseCapacity({
  capacityId: 'vehicle.fleet',
  providerRef: 'provider.mobility.autonomous',
  productiveObjectRef: 'object.vehicle.fleet.001',
  category: 'LOGISTICS_TRANSPORTATION',
  canonicalUnit: 'vehicle_hour',
  verifiedQuantity: 100_000n,
});

export const FIXTURE_HOTEL_ROOM_NIGHT = baseCapacity({
  capacityId: 'hotel.rooms',
  providerRef: 'provider.hospitality.chain',
  productiveObjectRef: 'object.hotel.property.001',
  category: 'REAL_ESTATE_USE',
  canonicalUnit: 'room_night',
  verifiedQuantity: 3_650n,
});

export const FIXTURE_FACTORY_PRODUCTION = baseCapacity({
  capacityId: 'factory.capacity',
  providerRef: 'provider.manufacturing.plant',
  productiveObjectRef: 'object.factory.line.001',
  category: 'MANUFACTURING',
  canonicalUnit: 'production_unit',
  verifiedQuantity: 25_000n,
});

export const FIXTURE_FOOD_DELIVERABLE = baseCapacity({
  capacityId: 'food.producer',
  providerRef: 'provider.food.regional',
  productiveObjectRef: 'object.food.producer.001',
  category: 'FOOD_AGRICULTURE',
  canonicalUnit: 'deliverable_food_unit',
  verifiedQuantity: 18_000n,
});

export const PRODUCTIVE_ACCESS_FIXTURES = Object.freeze([
  FIXTURE_SOLAR_KWH,
  FIXTURE_GPU_CLUSTER_HOUR,
  FIXTURE_ROBOT_FLEET_HOUR,
  FIXTURE_AUTONOMOUS_VEHICLE_FLEET,
  FIXTURE_HOTEL_ROOM_NIGHT,
  FIXTURE_FACTORY_PRODUCTION,
  FIXTURE_FOOD_DELIVERABLE,
]);
