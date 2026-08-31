/**
 * Wave 5 travel intelligence canonical types.
 * Information / discovery infrastructure only — not booking execution.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';

/** Travel provider capabilities — informational only unless explicitly booking-authorized. */
export const TRAVEL_CAPABILITIES = Object.freeze({
  AIRCRAFT_POSITION: 'aircraft_position',
  AIRPORT_INFORMATION: 'airport_information',
  AVIATION_WEATHER: 'aviation_weather',
  FLIGHT_REFERENCE: 'flight_reference',
  AIRCRAFT_REGISTRY: 'aircraft_registry',
  ENTRY_REQUIREMENTS: 'entry_requirements',
  PUBLIC_TRANSIT: 'public_transit',
  TRANSIT_ROUTE: 'transit_route',
  TRANSIT_DEPARTURE: 'transit_departure',
  EV_CHARGING: 'ev_charging',
  MOBILITY_STATUS: 'mobility_status',
} as const);

export type TravelCapability = (typeof TRAVEL_CAPABILITIES)[keyof typeof TRAVEL_CAPABILITIES];

export const TRANSIT_MODES = ['RAIL', 'BUS', 'METRO', 'TRAM', 'FERRY'] as const;
export type TransitMode = (typeof TRANSIT_MODES)[number];

export type FreshnessInfo = {
  readonly freshnessStatus: 'fresh' | 'stale' | 'expired' | 'unknown';
  readonly retrievedAt: UtcInstant;
  readonly sourceEffectiveAt: UtcInstant | null;
  readonly sourceUrl: string | null;
};

export type ProvenanceInfo = {
  readonly providerId: string;
  readonly capability: string;
  readonly simulation: true;
  readonly rawPayloadHash: string;
};

export type GeoCoordinate = {
  readonly latitude: number;
  readonly longitude: number;
};

/** Canonical airport identity — reuses location coordinates, not a duplicate global DB. */
export type Airport = {
  readonly airportId: string;
  readonly iata: string | null;
  readonly icao: string | null;
  readonly name: string;
  readonly country: string;
  readonly city: string | null;
  readonly region: string | null;
  readonly location: GeoCoordinate;
  readonly timezone: string | null;
};

export type AircraftIdentity = {
  readonly icao24: string | null;
  readonly tailNumber: string | null;
  readonly registration: string | null;
  readonly callsign: string | null;
  readonly aircraftModel: string | null;
  readonly providerNativeId: string | null;
};

export type AviationObservation = {
  readonly flightId: string | null;
  readonly callsign: string | null;
  readonly aircraft: AircraftIdentity;
  readonly origin: string | null;
  readonly destination: string | null;
  readonly location: GeoCoordinate | null;
  readonly altitudeMeters: number | null;
  readonly groundSpeedKnots: number | null;
  readonly headingDegrees: number | null;
  readonly verticalRateFpm: number | null;
  readonly departureTime: UtcInstant | null;
  readonly arrivalTime: UtcInstant | null;
  readonly status: string | null;
  readonly observedAt: UtcInstant;
  readonly providerId: string;
  readonly freshness: FreshnessInfo;
  readonly provenance: ProvenanceInfo;
};

export type EntryRequirementObservation = {
  readonly travelerNationality: string;
  readonly destination: string;
  readonly entryRequirementType: string;
  readonly visaRequired: boolean | null;
  readonly restrictionStatus: string | null;
  readonly notes: string | null;
  readonly sourceEffectiveAt: UtcInstant | null;
  readonly retrievedAt: UtcInstant;
  readonly providerId: string;
  readonly freshness: FreshnessInfo;
  readonly sourceUrl: string | null;
  readonly provenance: ProvenanceInfo;
  /** Reference only — not an admissibility guarantee. */
  readonly referenceOnly: true;
};

export type TransitStop = {
  readonly stopId: string;
  readonly name: string;
  readonly location: GeoCoordinate | null;
  readonly mode: TransitMode | null;
};

export type TransitRoute = {
  readonly routeId: string;
  readonly operator: string | null;
  readonly routeName: string;
  readonly mode: TransitMode;
  readonly stops: readonly TransitStop[];
  readonly providerId: string;
  readonly freshness: FreshnessInfo;
};

export type TransitDeparture = {
  readonly departureId: string;
  readonly routeId: string;
  readonly stop: TransitStop;
  readonly scheduledTime: UtcInstant;
  readonly estimatedTime: UtcInstant | null;
  readonly delayMinutes: number | null;
  readonly destination: string | null;
  readonly mode: TransitMode;
  readonly operator: string | null;
  readonly providerId: string;
  readonly freshness: FreshnessInfo;
};

export type TransitJourney = {
  readonly journeyId: string;
  readonly origin: TransitStop;
  readonly destination: TransitStop;
  readonly departures: readonly TransitDeparture[];
  readonly mode: TransitMode;
  readonly providerId: string;
};

export type ChargingLocation = {
  readonly locationId: string;
  readonly name: string | null;
  readonly location: GeoCoordinate;
  readonly operator: string | null;
  readonly connectorTypes: readonly string[];
  readonly powerKw: number | null;
  /** Only set when provider actually supplies availability data. */
  readonly availabilityStatus: string | null;
  readonly accessType: string | null;
  readonly pricingReference: string | null;
  readonly providerId: string;
  readonly freshness: FreshnessInfo;
};

export type ProviderObservationEnvelope<T> = {
  readonly providerId: string;
  readonly capability: string;
  readonly collectedAtUtc: UtcInstant;
  readonly sourceTimestampUtc: UtcInstant | null;
  readonly stale: boolean;
  readonly simulation: true;
  readonly data: T;
};

export type TravelProviderHealth = {
  readonly providerId: string;
  readonly healthy: boolean;
  readonly degraded: boolean;
  readonly message: string;
  readonly capabilities: readonly string[];
};

export type TravelPlanningContext = {
  readonly destination: string;
  readonly destinationAirport: Airport | null;
  readonly entryRequirements: readonly EntryRequirementObservation[];
  readonly environmentalContext: Record<string, unknown> | null;
  readonly nearbyTransit: readonly TransitRoute[];
  readonly nearbyCharging: readonly ChargingLocation[];
  /** Planning reference only — no booking confirmed. */
  readonly bookingConfirmed: false;
  readonly referenceOnly: true;
};

export type TravelServiceResult<T> = {
  readonly data: T;
  readonly providerId: string;
  readonly stale: boolean;
  readonly degraded: boolean;
  readonly warnings: readonly string[];
};

export const TRAVEL_ADAPTER_IDS = [
  'opensky',
  'faa-registry',
  'aviationapi',
  'can-i-enter',
  'transport-rest',
  'transitland',
  'open-charge-map',
  'bc-ferries',
  'entur',
] as const;

export type TravelAdapterId = (typeof TRAVEL_ADAPTER_IDS)[number];
