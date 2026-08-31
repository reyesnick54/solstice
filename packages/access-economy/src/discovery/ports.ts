/**
 * ACCESS Wave 2 Prompt 31 — discovery ports for canonical domain services.
 *
 * Access discovery must not call vendor HTTP directly. Implementations live
 * outside access-economy and compose Travel/Geo/Environment services.
 */

import type {
  AccessDiscoveryOutcome,
  AccessDiscoveryProviderId,
  DiscoveryAvailabilityState,
  DiscoveryCapacityUnit,
  DiscoveryFreshness,
  DiscoveryGeography,
  DiscoveryReferencePrice,
} from './types.ts';

export type DiscoveryTransitRouteObservation = {
  readonly routeId: string;
  readonly routeName: string;
  readonly operator: string | null;
  readonly mode: string;
  readonly providerId: string;
  readonly stopCount: number;
  readonly freshness: DiscoveryFreshness;
  readonly sourceObservationId: string;
};

export type DiscoveryChargingLocationObservation = {
  readonly locationId: string;
  readonly name: string | null;
  readonly geography: DiscoveryGeography;
  readonly operator: string | null;
  readonly connectorTypes: readonly string[];
  readonly powerKw: number | null;
  readonly availabilityStatus: DiscoveryAvailabilityState;
  readonly accessType: string | null;
  readonly pricingReference: string | null;
  readonly providerId: string;
  readonly freshness: DiscoveryFreshness;
  readonly sourceObservationId: string;
};

export type DiscoveryGbfsStationObservation = {
  readonly stationId: string;
  readonly systemId: string;
  readonly name: string;
  readonly geography: DiscoveryGeography;
  readonly capacity: number | null;
  readonly vehiclesAvailable: number | null;
  readonly vehicleTypes: readonly string[];
  readonly pricingPlan: string | null;
  readonly availabilityStatus: DiscoveryAvailabilityState;
  readonly providerId: 'gbfs';
  readonly freshness: DiscoveryFreshness;
  readonly sourceObservationId: string;
};

export type DiscoveryParkObservation = {
  readonly parkCode: string;
  readonly name: string;
  readonly description: string | null;
  readonly geography: DiscoveryGeography;
  readonly alerts: readonly string[];
  readonly visitorInfo: string | null;
  readonly availabilityStatus: DiscoveryAvailabilityState;
  readonly providerId: 'national-park-service';
  readonly freshness: DiscoveryFreshness;
  readonly sourceObservationId: string;
};

export type DiscoveryRecreationObservation = {
  readonly facilityId: string;
  readonly name: string;
  readonly activityType: string | null;
  readonly geography: DiscoveryGeography;
  readonly permitMetadata: string | null;
  readonly referencePrice: DiscoveryReferencePrice | null;
  readonly availabilityStatus: DiscoveryAvailabilityState;
  readonly providerId: 'recreation-gov-ridb';
  readonly freshness: DiscoveryFreshness;
  readonly sourceObservationId: string;
};

export type DiscoveryEnvironmentalContext = {
  readonly destinationRegion: string;
  readonly severeWeather: boolean;
  readonly notes: readonly string[];
  readonly freshness: DiscoveryFreshness;
};

export type TravelDiscoveryPort = {
  readonly searchTransit: (
    query: string,
    limit: number,
  ) => AccessDiscoveryOutcome<readonly DiscoveryTransitRouteObservation[]>;
  readonly findChargingLocations: (
    geography: DiscoveryGeography,
    limit: number,
  ) => AccessDiscoveryOutcome<readonly DiscoveryChargingLocationObservation[]>;
};

export type MobilityDiscoveryPort = {
  readonly searchGbfsStations: (
    geography: DiscoveryGeography,
    limit: number,
  ) => AccessDiscoveryOutcome<readonly DiscoveryGbfsStationObservation[]>;
};

export type RecreationDiscoveryPort = {
  readonly searchParks: (
    query: string,
    limit: number,
  ) => AccessDiscoveryOutcome<readonly DiscoveryParkObservation[]>;
  readonly searchRecreationInventory: (
    query: string,
    geography: DiscoveryGeography | null,
    limit: number,
  ) => AccessDiscoveryOutcome<readonly DiscoveryRecreationObservation[]>;
};

export type EnvironmentalDiscoveryPort = {
  readonly getDestinationContext: (destinationRegion: string) => AccessDiscoveryOutcome<DiscoveryEnvironmentalContext>;
};

export type GeospatialDiscoveryPort = {
  readonly normalizeGeography: (input: DiscoveryGeography) => AccessDiscoveryOutcome<DiscoveryGeography>;
};

export type AccessDiscoveryPorts = {
  readonly travel: TravelDiscoveryPort;
  readonly mobility: MobilityDiscoveryPort;
  readonly recreation: RecreationDiscoveryPort;
  readonly environmental: EnvironmentalDiscoveryPort;
  readonly geospatial: GeospatialDiscoveryPort;
};

export type ProviderHealthObservation = {
  readonly providerId: AccessDiscoveryProviderId | string;
  readonly healthy: boolean;
  readonly degraded: boolean;
  readonly message: string;
};

export type ProviderHealthPort = {
  readonly allProviderHealth: () => readonly ProviderHealthObservation[];
};
