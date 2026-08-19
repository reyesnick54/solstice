/**
 * Deterministic logistics / storage fixtures. Not commercial providers.
 */

import type { LogisticsIdentityBundle, LogisticsSourceObservation, TransportLegInput } from './types.ts';

const NOW = 1_700_000_000n;

function identity(overrides: Partial<LogisticsIdentityBundle> = {}): LogisticsIdentityBundle {
  return Object.freeze({
    shipmentRef: 'shp.B1.1',
    consignmentRef: 'con.B1.1',
    containerRef: 'ctr.B1.1',
    packageGroupRef: 'pkg.B1.1',
    legRef: 'leg.road.1',
    carrierRef: 'carrier.alpha',
    vehicleRef: 'veh.truck.1',
    originRegionRef: 'region.origin.a',
    destinationRegionRef: 'region.dest.b',
    goodsBatchRef: 'batch.B1',
    manufacturingEventRef: 'mfg.B1',
    ...overrides,
  });
}

function base(
  overrides: Partial<LogisticsSourceObservation> & Pick<LogisticsSourceObservation, 'observationId' | 'sourceFamily' | 'factType'>,
): LogisticsSourceObservation {
  return Object.freeze({
    sourceId: 'src.logistics.1',
    providerId: 'provider.logistics.sandbox',
    controllerId: 'controller.carrier.alpha',
    upstreamOrganizationId: 'org.carrier.alpha',
    sharedControlGroup: null,
    relatedSourceIds: Object.freeze([]),
    schemaId:
      overrides.factType === 'STORAGE_CAPACITY'
        ? 'storage.warehouse.v1'
        : overrides.factType === 'DELIVERY_COMPLETION'
          ? 'delivery.completion.v1'
          : overrides.factType === 'GOODS_DELIVERY'
            ? 'goods.delivery.v1'
            : 'logistics.resource.v1',
    schemaVersion: 1,
    sourceTimestampUnix: NOW,
    collectionTimestampUnix: NOW,
    identity: identity(),
    ...overrides,
  });
}

const roadLeg = (id: string, start: bigint, end: bigint, extras: Partial<TransportLegInput> = {}): TransportLegInput =>
  Object.freeze({
    legRef: id,
    mode: 'ROAD',
    independentlyRealized: true,
    mass: { mantissa: '2', scale: 0, unit: 'tonne' },
    distance: { mantissa: '100', scale: 0, unit: 'km' },
    originRegionRef: 'region.origin.a',
    destinationRegionRef: 'region.port.p',
    startUnix: start,
    endUnix: end,
    carrierRef: 'carrier.alpha',
    vehicleRef: 'veh.truck.1',
    ...extras,
  });

const oceanLeg: TransportLegInput = Object.freeze({
  legRef: 'leg.ocean.1',
  mode: 'OCEAN',
  independentlyRealized: true,
  mass: { mantissa: '2', scale: 0, unit: 'tonne' },
  distance: { mantissa: '400', scale: 0, unit: 'km' },
  originRegionRef: 'region.port.p',
  destinationRegionRef: 'region.dest.b',
  startUnix: NOW + 10_000n,
  endUnix: NOW + 20_000n,
  carrierRef: 'carrier.maritime',
  vehicleRef: 'veh.vessel.1',
});

export const VALID_TONNE_KM = base({
  observationId: 'obs.tonne-km.valid',
  sourceFamily: 'FREIGHT_CARRIER_SYSTEM',
  factType: 'LOGISTICS_CAPACITY',
  realizationState: 'REALIZED',
  mass: { mantissa: '2', scale: 0, unit: 'tonne' },
  distance: { mantissa: '250', scale: 0, unit: 'km' },
});

export const VALID_ATTESTED_TONNE_KM = base({
  observationId: 'obs.tonne-km.attested',
  sourceFamily: 'TMS',
  factType: 'LOGISTICS_CAPACITY',
  realizationState: 'REALIZED',
  numericValue: '500',
  unit: 'tonne_km',
});

export const MULTI_LEG_SHIPMENT = base({
  observationId: 'obs.multileg',
  sourceFamily: 'TMS',
  factType: 'LOGISTICS_CAPACITY',
  realizationState: 'REALIZED',
  legs: Object.freeze([roadLeg('leg.road.1', NOW, NOW + 9_000n), oceanLeg]),
});

export const COMPLETED_DELIVERY = base({
  observationId: 'obs.delivery.done',
  sourceFamily: 'PROOF_OF_DELIVERY_SYSTEM',
  factType: 'DELIVERY_COMPLETION',
  deliveryStatus: 'DELIVERED',
  numericValue: '1',
  unit: 'units_produced',
  proofOfDelivery: Object.freeze({
    kind: 'SIGNED_DELIVERY_ATTESTATION',
    evidenceCommitment: 'pod-commit-1',
    evidenceReference: 'pod.ref.1',
    completedState: 'DELIVERED',
    storeSignatureImage: false,
  }),
});

export const WAREHOUSE_VOLUME_TIME = base({
  observationId: 'obs.storage.realized',
  sourceFamily: 'WMS',
  factType: 'STORAGE_CAPACITY',
  realizationState: 'REALIZED',
  storageQualifier: 'PHYSICAL_WAREHOUSE_VOLUME',
  volume: { mantissa: '10', scale: 0, unit: 'm3' },
  measurementStartUnix: NOW,
  measurementEndUnix: NOW + 7_200n,
  durationSeconds: 7_200n,
});

export const COLD_STORAGE = base({
  observationId: 'obs.storage.cold',
  sourceFamily: 'COLD_STORAGE_METER',
  factType: 'STORAGE_CAPACITY',
  realizationState: 'REALIZED',
  storageQualifier: 'PHYSICAL_WAREHOUSE_VOLUME',
  volume: { mantissa: '4', scale: 0, unit: 'm3' },
  measurementStartUnix: NOW,
  measurementEndUnix: NOW + 3_600n,
  durationSeconds: 3_600n,
  temperatureReadings: Object.freeze([
    { observedAtUnix: NOW + 60n, milliCelsius: -18_000n },
    { observedAtUnix: NOW + 1_800n, milliCelsius: -17_500n },
  ]),
});

export const DISTANCE_WITHOUT_MASS = base({
  observationId: 'obs.distance-only',
  sourceFamily: 'FREIGHT_CARRIER_SYSTEM',
  factType: 'LOGISTICS_CAPACITY',
  realizationState: 'REALIZED',
  distance: { mantissa: '250', scale: 0, unit: 'km' },
});

export const MASS_WITHOUT_DISTANCE = base({
  observationId: 'obs.mass-only',
  sourceFamily: 'FREIGHT_CARRIER_SYSTEM',
  factType: 'LOGISTICS_CAPACITY',
  realizationState: 'REALIZED',
  mass: { mantissa: '2', scale: 0, unit: 'tonne' },
});

export const IN_TRANSIT_DELIVERY = base({
  observationId: 'obs.delivery.in-transit',
  sourceFamily: 'PROOF_OF_DELIVERY_SYSTEM',
  factType: 'DELIVERY_COMPLETION',
  deliveryStatus: 'IN_TRANSIT',
  numericValue: '1',
  unit: 'units_produced',
});

export const DUPLICATE_CARRIER_DELIVERY = base({
  observationId: 'obs.delivery.duplicate-tms',
  sourceFamily: 'TMS',
  factType: 'DELIVERY_COMPLETION',
  schemaId: 'delivery.completion.v1',
  deliveryStatus: 'ACCEPTED',
  numericValue: '1',
  unit: 'units_produced',
  proofOfDelivery: Object.freeze({
    kind: 'CARRIER_COMPLETION_RECORD',
    evidenceCommitment: 'pod-commit-2',
    evidenceReference: 'pod.ref.2',
    completedState: 'ACCEPTED',
    storeSignatureImage: false,
  }),
});

export const OVERLAPPING_LEGS = base({
  observationId: 'obs.overlap-legs',
  sourceFamily: 'TMS',
  factType: 'LOGISTICS_CAPACITY',
  realizationState: 'REALIZED',
  legs: Object.freeze([
    roadLeg('leg.road.1', NOW, NOW + 12_000n),
    roadLeg('leg.road.overlap', NOW + 4_000n, NOW + 16_000n, {
      mode: 'RAIL',
      carrierRef: 'carrier.rail',
    }),
  ]),
});

export const WHOLE_TRIP_PLUS_LEGS = base({
  observationId: 'obs.whole-plus-legs',
  sourceFamily: 'TMS',
  factType: 'LOGISTICS_CAPACITY',
  realizationState: 'REALIZED',
  countsWholeJourney: true,
  mass: { mantissa: '2', scale: 0, unit: 'tonne' },
  distance: { mantissa: '500', scale: 0, unit: 'km' },
  legs: Object.freeze([roadLeg('leg.road.1', NOW, NOW + 9_000n), oceanLeg]),
});

export const RAW_GPS_LEAK = base({
  observationId: 'obs.gps-leak',
  sourceFamily: 'VEHICLE_TELEMATICS_GATEWAY',
  factType: 'LOGISTICS_CAPACITY',
  realizationState: 'CAPACITY',
  numericValue: '250',
  unit: 'tonne_km',
  extras: Object.freeze({ rawGps: '37.77,-122.42' }),
});

export const IMPOSSIBLE_MOVEMENT = base({
  observationId: 'obs.impossible',
  sourceFamily: 'VEHICLE_TELEMATICS_GATEWAY',
  factType: 'LOGISTICS_CAPACITY',
  realizationState: 'CAPACITY',
  numericValue: '10',
  unit: 'tonne_km',
  restrictedTelematics: Object.freeze({
    publicExposureForbidden: true,
    reportedDistanceMeters: 1_000n,
    samples: Object.freeze([
      {
        vehicleRef: 'veh.truck.1',
        observedAtUnix: NOW,
        latitudeMilliArcsec: 0n,
        longitudeMilliArcsec: 0n,
      },
      {
        vehicleRef: 'veh.truck.1',
        observedAtUnix: NOW + 1n,
        latitudeMilliArcsec: 90_000_000n,
        longitudeMilliArcsec: 90_000_000n,
      },
    ]),
  }),
});

export const WAREHOUSE_CAPACITY = base({
  observationId: 'obs.storage.capacity',
  sourceFamily: 'WAREHOUSE_METER',
  factType: 'STORAGE_CAPACITY',
  realizationState: 'CAPACITY',
  storageQualifier: 'PHYSICAL_WAREHOUSE_VOLUME',
  numericValue: '10000',
  unit: 'm3',
  volume: { mantissa: '10000', scale: 0, unit: 'm3' },
});

export const STORAGE_MISSING_DURATION = base({
  observationId: 'obs.storage.no-duration',
  sourceFamily: 'WMS',
  factType: 'STORAGE_CAPACITY',
  realizationState: 'REALIZED',
  storageQualifier: 'PHYSICAL_WAREHOUSE_VOLUME',
  volume: { mantissa: '10', scale: 0, unit: 'm3' },
});

export const SAME_CONTROLLER_QUORUM = base({
  observationId: 'obs.same-controller',
  sourceFamily: 'FREIGHT_CARRIER_SYSTEM',
  factType: 'LOGISTICS_CAPACITY',
  realizationState: 'REALIZED',
  mass: { mantissa: '2', scale: 0, unit: 'tonne' },
  distance: { mantissa: '100', scale: 0, unit: 'km' },
  sharedControlGroup: 'carrier.alpha.apis',
  relatedSourceIds: Object.freeze(['src.logistics.1', 'src.logistics.api-b']),
});

export const FLOAT_MASS_DISTANCE = base({
  observationId: 'obs.float',
  sourceFamily: 'FREIGHT_CARRIER_SYSTEM',
  factType: 'LOGISTICS_CAPACITY',
  realizationState: 'REALIZED',
  mass: { mantissa: '2.5', scale: 0, unit: 'tonne' },
  distance: { mantissa: '100', scale: 0, unit: 'km' },
});

export const SCHEMA_DRIFT = base({
  observationId: 'obs.schema-drift',
  sourceFamily: 'FREIGHT_CARRIER_SYSTEM',
  factType: 'LOGISTICS_CAPACITY',
  realizationState: 'REALIZED',
  schemaId: 'logistics.resource.v1.changed',
  schemaVersion: 2,
  mass: { mantissa: '2', scale: 0, unit: 'tonne' },
  distance: { mantissa: '100', scale: 0, unit: 'km' },
});

export const GOODS_REPLAYED_AS_LOGISTICS = base({
  observationId: 'obs.goods-replay',
  sourceFamily: 'FREIGHT_CARRIER_SYSTEM',
  factType: 'LOGISTICS_CAPACITY',
  realizationState: 'REALIZED',
  numericValue: '40',
  unit: 'units_produced',
});

export const DIGITAL_PHYSICAL_MERGE = base({
  observationId: 'obs.storage.merge',
  sourceFamily: 'WMS',
  factType: 'STORAGE_CAPACITY',
  realizationState: 'REALIZED',
  storageQualifier: 'DIGITAL_BYTE_STORAGE',
  volume: { mantissa: '10', scale: 0, unit: 'm3' },
  durationSeconds: 3_600n,
});

export const NETWORK_ATTEMPT = base({
  observationId: 'obs.network',
  sourceFamily: 'FREIGHT_CARRIER_SYSTEM',
  factType: 'LOGISTICS_CAPACITY',
  realizationState: 'REALIZED',
  mass: { mantissa: '2', scale: 0, unit: 'tonne' },
  distance: { mantissa: '100', scale: 0, unit: 'km' },
  networkCallAttempted: true,
});

export const MANUFACTURING_BATCH = Object.freeze({
  batchRef: 'batch.B1',
  eventRef: 'mfg.B1',
  quantity: 40n,
  unit: 'units_produced',
});
