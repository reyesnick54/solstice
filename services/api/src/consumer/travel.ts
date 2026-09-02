/**
 * Consumer BFF travel intelligence dispatch — read-only travel reference resources.
 */

import {
  createTravelIntelligenceSandbox,
  type TravelIntelligenceService,
} from '../../../../packages/sunrey-chain/src/travel-intelligence/index.ts';
import { bffError, isBffError, type BffErrorEnvelope } from './errors.ts';

type TravelDispatchRequest = {
  readonly method: string;
  readonly path: string;
  readonly query?: Readonly<Record<string, string>>;
};

type TravelDispatchResponse = {
  readonly status: number;
  readonly body: unknown;
  readonly headers: Readonly<Record<string, string>>;
};

let defaultService: TravelIntelligenceService | undefined;

function resolveService(custom?: TravelIntelligenceService): TravelIntelligenceService {
  if (custom) return custom;
  if (!defaultService) defaultService = createTravelIntelligenceSandbox();
  return defaultService;
}

function json(status: number, body: unknown, headers: Record<string, string>): TravelDispatchResponse {
  return { status, body, headers };
}

function result(body: unknown, headers: Record<string, string>, okStatus = 200): TravelDispatchResponse {
  if (isBffError(body)) {
    return json(body.errorCode === 'NOT_FOUND' ? 404 : 400, body, headers);
  }
  return json(okStatus, body, headers);
}

function failure(requestId: string, message: string): BffErrorEnvelope {
  return bffError({
    errorCode: 'VALIDATION',
    category: 'VALIDATION',
    message,
    retryable: false,
    requestId,
  });
}

function parseFloatParam(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : undefined;
}

export function dispatchTravel(
  request: TravelDispatchRequest,
  requestId: string,
  headers: Record<string, string>,
  travel?: TravelIntelligenceService,
): TravelDispatchResponse | null {
  const { method, path, query = {} } = request;
  if (!path.startsWith('/api/v1/travel')) return null;
  if (path === '/api/v1/travel/overview' || path === '/api/v1/travel/context') {
    return null;
  }

  const svc = resolveService(travel);

  try {
    if (path === '/api/v1/travel/airports' && method === 'GET') {
      const searchResult = svc.searchAirports(query.q ?? query.query ?? '', parseFloatParam(query.limit));
      return result(
        Object.freeze({
          airports: searchResult.data,
          providerId: searchResult.providerId,
          stale: searchResult.stale,
          readOnly: true,
          simulation: true,
          referenceOnly: true,
        }),
        headers,
      );
    }

    if (path.startsWith('/api/v1/travel/airports/') && method === 'GET') {
      const airportId = path.slice('/api/v1/travel/airports/'.length);
      const airportResult = svc.getAirport(airportId);
      return result(
        Object.freeze({
          airport: airportResult.data,
          providerId: airportResult.providerId,
          stale: airportResult.stale,
          readOnly: true,
          simulation: true,
        }),
        headers,
      );
    }

    if (path === '/api/v1/travel/entry-requirements' && method === 'GET') {
      const nationality = query.nationality ?? query.from;
      const destination = query.destination ?? query.to;
      if (!nationality || !destination) {
        return result(failure(requestId, 'nationality and destination are required'), headers);
      }
      const entryResult = svc.getEntryRequirements(nationality, destination);
      return result(
        Object.freeze({
          requirements: entryResult.data,
          providerId: entryResult.providerId,
          stale: entryResult.stale,
          warnings: entryResult.warnings,
          readOnly: true,
          simulation: true,
          referenceOnly: true,
          notAdmissibilityGuarantee: true,
        }),
        headers,
      );
    }

    if (path === '/api/v1/travel/transit' && method === 'GET') {
      const transitResult = svc.searchTransit(query.q ?? query.query ?? '', parseFloatParam(query.limit));
      const departures =
        query.stopId !== undefined
          ? svc.getTransitDepartures(query.stopId, parseFloatParam(query.limit)).data
          : undefined;
      return result(
        Object.freeze({
          routes: transitResult.data,
          departures,
          providerId: transitResult.providerId,
          readOnly: true,
          simulation: true,
        }),
        headers,
      );
    }

    if (path === '/api/v1/travel/charging' && method === 'GET') {
      const lat = parseFloatParam(query.lat ?? query.latitude);
      const lon = parseFloatParam(query.lon ?? query.longitude);
      if (lat === undefined || lon === undefined) {
        return result(failure(requestId, 'lat and lon are required'), headers);
      }
      const chargingResult = svc.findChargingLocations(
        lat,
        lon,
        parseFloatParam(query.radiusKm) ?? 10,
        parseFloatParam(query.limit),
      );
      return result(
        Object.freeze({
          locations: chargingResult.data,
          providerId: chargingResult.providerId,
          readOnly: true,
          simulation: true,
          availabilityNotGuaranteed: true,
        }),
        headers,
      );
    }

    if (path === '/api/v1/travel/aviation' && method === 'GET') {
      const minLat = parseFloatParam(query.minLat);
      const maxLat = parseFloatParam(query.maxLat);
      const minLon = parseFloatParam(query.minLon);
      const maxLon = parseFloatParam(query.maxLon);
      if (minLat === undefined || maxLat === undefined || minLon === undefined || maxLon === undefined) {
        return result(failure(requestId, 'bounding box (minLat, maxLat, minLon, maxLon) is required'), headers);
      }
      const aviationResult = svc.getAircraftPositions(
        Object.freeze({ minLat, maxLat, minLon, maxLon }),
        parseFloatParam(query.limit),
      );
      return result(
        Object.freeze({
          observations: aviationResult.data,
          providerId: aviationResult.providerId,
          stale: aviationResult.stale,
          warnings: aviationResult.warnings,
          readOnly: true,
          simulation: true,
          boundedQuery: true,
        }),
        headers,
      );
    }

    if (path === '/api/v1/travel/planning-context' && method === 'GET') {
      const destination = query.destination;
      if (!destination) {
        return result(failure(requestId, 'destination is required'), headers);
      }
      const context = svc.buildTravelPlanningContext({
        destination,
        ...(query.nationality !== undefined ? { travelerNationality: query.nationality } : {}),
        ...(query.airportId !== undefined ? { airportId: query.airportId } : {}),
      });
      return result(
        Object.freeze({
          context,
          readOnly: true,
          simulation: true,
          bookingConfirmed: false,
          referenceOnly: true,
        }),
        headers,
      );
    }

    if (path === '/api/v1/travel/providers' && method === 'GET') {
      return result(
        Object.freeze({
          providers: svc.listProviders(),
          health: svc.allProviderHealth(),
          readOnly: true,
          simulation: true,
        }),
        headers,
      );
    }

    return result(
      bffError({
        errorCode: 'NOT_FOUND',
        category: 'NOT_FOUND',
        message: 'travel route not found',
        retryable: false,
        requestId,
      }),
      headers,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'travel request failed';
    return result(failure(requestId, message), headers);
  }
}
