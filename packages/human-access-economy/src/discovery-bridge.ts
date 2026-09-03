// @ts-nocheck
/**
 * ACCESS Wave 2 Prompt 31 — bridge canonical domain services to AccessDiscoveryPorts.
 */

import { createAccessDiscoveryService } from '../../access-economy/src/discovery/service.ts';
import type {
  AccessDiscoveryPorts,
  DiscoveryAvailabilityState,
  DiscoveryChargingLocationObservation,
  DiscoveryEnvironmentalContext,
  DiscoveryFreshness,
  DiscoveryGbfsStationObservation,
  DiscoveryGeography,
  DiscoveryParkObservation,
  DiscoveryRecreationObservation,
  DiscoveryReferencePrice,
  DiscoveryTransitRouteObservation,
} from '../../access-economy/src/discovery/ports.ts';
import type { AccessDiscoveryOutcome } from '../../access-economy/src/discovery/types.ts';
import {
  createAccessDiscoveryDataSandbox,
  type AccessDiscoveryDataService,
} from '../../sunrey-chain/src/access-discovery/service.ts';
import {
  createTravelIntelligenceSandbox,
  type TravelIntelligenceService,
} from '../../sunrey-chain/src/travel-intelligence/service.ts';

function toFreshness(input: {
  readonly retrievedAt: string;
  readonly sourceTimestamp?: string | null;
  readonly freshnessStatus?: string;
  readonly stale?: boolean;
}): DiscoveryFreshness {
  return Object.freeze({
    retrievedAt: input.retrievedAt,
    sourceTimestamp: input.sourceTimestamp ?? null,
    freshnessStatus:
      input.freshnessStatus === 'stale' || input.stale
        ? 'stale'
        : input.freshnessStatus === 'unknown'
          ? 'unknown'
          : 'fresh',
    stale: input.stale === true || input.freshnessStatus === 'stale',
  });
}

function mapAvailabilityStatus(value: string | null | undefined): DiscoveryAvailabilityState {
  if (!value) return 'UNKNOWN';
  const normalized = value.toUpperCase();
  if (normalized.includes('AVAILABLE') && !normalized.includes('UN')) return 'AVAILABLE';
  if (normalized.includes('LIMITED')) return 'LIMITED';
  if (normalized.includes('UNAVAILABLE')) return 'UNAVAILABLE';
  if (normalized.includes('STALE')) return 'STALE';
  return 'UNKNOWN';
}

function ok<T>(value: T): AccessDiscoveryOutcome<T> {
  return Object.freeze({ ok: true, value });
}

function fail(code: AccessDiscoveryOutcome<never> extends { ok: false; code: infer C } ? C : never, message: string) {
  return Object.freeze({ ok: false, code, message });
}

export type AccessDiscoveryBridgeOptions = {
  readonly travel?: TravelIntelligenceService;
  readonly accessDiscoveryData?: AccessDiscoveryDataService;
};

export function createAccessDiscoveryPorts(options: AccessDiscoveryBridgeOptions = {}): AccessDiscoveryPorts {
  const travel = options.travel ?? createTravelIntelligenceSandbox();
  const discoveryData = options.accessDiscoveryData ?? createAccessDiscoveryDataSandbox();

  const travelPort: AccessDiscoveryPorts['travel'] = {
    searchTransit(query, limit) {
      const result = travel.searchTransit(query, limit);
      if (result.degraded && result.data.length === 0) {
        return fail('PROVIDER_FAILURE', result.warnings[0] ?? 'transit provider failure');
      }
      const mapped: DiscoveryTransitRouteObservation[] = result.data.map((route) =>
        Object.freeze({
          routeId: route.routeId,
          routeName: route.routeName,
          operator: route.operator,
          mode: route.mode,
          providerId: route.providerId,
          stopCount: route.stops.length,
          freshness: toFreshness({
            retrievedAt: route.freshness.retrievedAt,
            sourceTimestamp: route.freshness.sourceEffectiveAt,
            freshnessStatus: route.freshness.freshnessStatus,
            stale: route.freshness.freshnessStatus === 'stale',
          }),
          sourceObservationId: `obs_transit_${route.providerId}_${route.routeId}`,
        }),
      );
      return ok(Object.freeze(mapped));
    },
    findChargingLocations(geography, limit) {
      const result = travel.findChargingLocations(
        geography.latitude,
        geography.longitude,
        geography.radiusKm ?? 10,
        limit,
      );
      if (result.degraded && result.data.length === 0) {
        return fail('PROVIDER_FAILURE', 'charging provider failure');
      }
      const mapped: DiscoveryChargingLocationObservation[] = result.data.map((location) =>
        Object.freeze({
          locationId: location.locationId,
          name: location.name,
          geography: Object.freeze({
            latitude: location.location.latitude,
            longitude: location.location.longitude,
            radiusKm: geography.radiusKm,
            countryCode: geography.countryCode,
            regionCode: geography.regionCode,
          }),
          operator: location.operator,
          connectorTypes: location.connectorTypes,
          powerKw: location.powerKw,
          availabilityStatus: mapAvailabilityStatus(location.availabilityStatus),
          accessType: location.accessType,
          pricingReference: location.pricingReference,
          providerId: location.providerId,
          freshness: toFreshness({
            retrievedAt: location.freshness.retrievedAt,
            sourceTimestamp: location.freshness.sourceEffectiveAt,
            freshnessStatus: location.freshness.freshnessStatus,
            stale: location.freshness.freshnessStatus === 'stale',
          }),
          sourceObservationId: `obs_charge_${location.locationId}`,
        }),
      );
      return ok(Object.freeze(mapped));
    },
  };

  const mobilityPort: AccessDiscoveryPorts['mobility'] = {
    searchGbfsStations(geography, limit) {
      const result = discoveryData.searchGbfsStations(
        geography.latitude,
        geography.longitude,
        geography.radiusKm ?? 10,
        limit,
      );
      if (result.degraded && result.data.length === 0) {
        return fail('PROVIDER_FAILURE', 'gbfs provider failure');
      }
      const mapped: DiscoveryGbfsStationObservation[] = result.data.map((row) => {
        const vehicles = row.status.vehiclesAvailable;
        let availability: DiscoveryAvailabilityState = 'UNKNOWN';
        if (vehicles !== null) {
          availability = vehicles > 5 ? 'AVAILABLE' : vehicles > 0 ? 'LIMITED' : 'UNAVAILABLE';
        }
        if (result.stale) availability = 'STALE';
        return Object.freeze({
          stationId: row.station.stationId,
          systemId: row.station.systemId,
          name: row.station.name,
          geography: Object.freeze({
            latitude: row.station.location.latitude,
            longitude: row.station.location.longitude,
            radiusKm: geography.radiusKm,
            countryCode: geography.countryCode,
            regionCode: geography.regionCode,
          }),
          capacity: row.station.capacity,
          vehiclesAvailable: vehicles,
          vehicleTypes: row.station.vehicleTypes,
          pricingPlan: row.pricingPlan?.name ?? null,
          availabilityStatus: availability,
          providerId: 'gbfs',
          freshness: toFreshness({
            retrievedAt: row.freshness.retrievedAt,
            sourceTimestamp: row.freshness.sourceTimestamp,
            freshnessStatus: row.freshness.freshnessStatus,
            stale: result.stale,
          }),
          sourceObservationId: row.sourceObservationId,
        });
      });
      return ok(Object.freeze(mapped));
    },
  };

  const recreationPort: AccessDiscoveryPorts['recreation'] = {
    searchParks(query, limit) {
      const result = discoveryData.searchParks(query, limit);
      const mapped: DiscoveryParkObservation[] = result.data.map((park) =>
        Object.freeze({
          parkCode: park.parkCode,
          name: park.fullName,
          description: park.description,
          geography: Object.freeze({
            latitude: park.location.latitude,
            longitude: park.location.longitude,
            radiusKm: null,
            countryCode: 'US',
            regionCode: park.states[0] ?? null,
          }),
          alerts: park.alerts,
          visitorInfo: park.visitorInfo,
          availabilityStatus: result.stale ? 'STALE' : park.alerts.length > 0 ? 'LIMITED' : 'AVAILABLE',
          providerId: 'national-park-service',
          freshness: toFreshness({
            retrievedAt: park.freshness.retrievedAt,
            sourceTimestamp: park.freshness.sourceTimestamp,
            freshnessStatus: park.freshness.freshnessStatus,
            stale: result.stale,
          }),
          sourceObservationId: park.sourceObservationId,
        }),
      );
      return ok(Object.freeze(mapped));
    },
    searchRecreationInventory(query, geography, limit) {
      const result = discoveryData.searchRecreationFacilities(query, limit);
      const mapped: DiscoveryRecreationObservation[] = result.data.map((facility) => {
        const referencePrice: DiscoveryReferencePrice | null =
          facility.referencePriceMinorUnits !== null && facility.currency
            ? Object.freeze({
                kind: 'REFERENCE_PRICE',
                amountMinorUnits: facility.referencePriceMinorUnits,
                currency: facility.currency,
                sourceTimestamp: facility.freshness.sourceTimestamp,
                providerId: facility.providerId,
                freshness: toFreshness({
                  retrievedAt: facility.freshness.retrievedAt,
                  sourceTimestamp: facility.freshness.sourceTimestamp,
                  freshnessStatus: facility.freshness.freshnessStatus,
                  stale: result.stale,
                }),
                notes: facility.reservable ? 'reservable inventory reference' : 'reference inventory only',
              })
            : null;
        return Object.freeze({
          facilityId: facility.facilityId,
          name: facility.facilityName,
          activityType: facility.activityDescription,
          geography: Object.freeze({
            latitude: facility.location.latitude,
            longitude: facility.location.longitude,
            radiusKm: geography?.radiusKm ?? null,
            countryCode: 'US',
            regionCode: geography?.regionCode ?? null,
          }),
          permitMetadata: facility.permitRequired ? 'permit metadata present — not a booking' : null,
          referencePrice,
          availabilityStatus:
            facility.freshness.freshnessStatus === 'unknown'
              ? 'UNKNOWN'
              : result.stale
                ? 'STALE'
                : 'AVAILABLE',
          providerId: 'recreation-gov-ridb',
          freshness: toFreshness({
            retrievedAt: facility.freshness.retrievedAt,
            sourceTimestamp: facility.freshness.sourceTimestamp,
            freshnessStatus: facility.freshness.freshnessStatus,
            stale: result.stale,
          }),
          sourceObservationId: facility.sourceObservationId,
        });
      });
      return ok(Object.freeze(mapped));
    },
  };

  const environmentalPort: AccessDiscoveryPorts['environmental'] = {
    getDestinationContext(destinationRegion) {
      const context = travel.environmentalOracle().getSevereWeatherContext(destinationRegion);
      const observation: DiscoveryEnvironmentalContext = Object.freeze({
        destinationRegion,
        severeWeather: context !== null && Object.keys(context).length > 0,
        notes: context ? Object.freeze(['environmental context attached from EnvironmentalOracleService']) : Object.freeze([]),
        freshness: toFreshness({ retrievedAt: new Date().toISOString(), stale: false }),
      });
      return ok(observation);
    },
  };

  const geospatialPort: AccessDiscoveryPorts['geospatial'] = {
    normalizeGeography(input) {
      return ok(
        Object.freeze({
          latitude: Math.round(input.latitude * 10000) / 10000,
          longitude: Math.round(input.longitude * 10000) / 10000,
          radiusKm: input.radiusKm,
          countryCode: input.countryCode,
          regionCode: input.regionCode,
        }),
      );
    },
  };

  return Object.freeze({
    travel: travelPort,
    mobility: mobilityPort,
    recreation: recreationPort,
    environmental: environmentalPort,
    geospatial: geospatialPort,
  });
}

export function createAccessDiscoveryBridge(options: AccessDiscoveryBridgeOptions = {}) {
  const ports = createAccessDiscoveryPorts(options);
  return createAccessDiscoveryService({ ports });
}
