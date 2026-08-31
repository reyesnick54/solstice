/**
 * Travel provider adapter contract — informational observations only.
 */

import type {
  Airport,
  AviationObservation,
  ChargingLocation,
  EntryRequirementObservation,
  ProviderObservationEnvelope,
  TransitDeparture,
  TransitRoute,
  TravelAdapterId,
  TravelProviderHealth,
} from '../types.ts';
import type { BoundingBox } from '../limits.ts';

export type TravelProvider = {
  readonly providerId: TravelAdapterId;
  readonly capabilities: readonly string[];
  health(): TravelProviderHealth;
  searchAirports?(query: string, limit: number): ProviderObservationEnvelope<readonly Airport[]>;
  getAirport?(airportId: string): ProviderObservationEnvelope<Airport | null>;
  getAircraftPositions?(
    bounds: BoundingBox,
    limit: number,
  ): ProviderObservationEnvelope<readonly AviationObservation[]>;
  getAircraftRegistry?(identifier: string): ProviderObservationEnvelope<Record<string, unknown> | null>;
  getEntryRequirements?(
    nationality: string,
    destination: string,
  ): ProviderObservationEnvelope<readonly EntryRequirementObservation[]>;
  searchTransit?(query: string, limit: number): ProviderObservationEnvelope<readonly TransitRoute[]>;
  getTransitDepartures?(
    stopId: string,
    limit: number,
  ): ProviderObservationEnvelope<readonly TransitDeparture[]>;
  findChargingLocations?(
    latitude: number,
    longitude: number,
    radiusKm: number,
    limit: number,
  ): ProviderObservationEnvelope<readonly ChargingLocation[]>;
};

export type TravelProviderFactory = () => TravelProvider;
