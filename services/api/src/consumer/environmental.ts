/**
 * Consumer BFF environmental oracle dispatch — read-only environmental resources.
 */

import { bffError, isBffError, type BffErrorEnvelope } from './errors.ts';
import { createEnvironmentalOracleBff, type EnvironmentalOracleBff } from './environmental-adapter.ts';

type EnvironmentalDispatchRequest = {
  readonly method: string;
  readonly path: string;
  readonly query?: Readonly<Record<string, string | undefined>>;
};

type EnvironmentalDispatchResponse = {
  readonly status: number;
  readonly body: unknown;
  readonly headers: Readonly<Record<string, string>>;
};

let defaultBff: EnvironmentalOracleBff | undefined;

function resolveBff(custom?: EnvironmentalOracleBff): EnvironmentalOracleBff {
  if (custom) return custom;
  if (!defaultBff) defaultBff = createEnvironmentalOracleBff();
  return defaultBff;
}

function json(status: number, body: unknown, headers: Record<string, string>): EnvironmentalDispatchResponse {
  return { status, body, headers };
}

function result(body: unknown, headers: Record<string, string>, okStatus = 200): EnvironmentalDispatchResponse {
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

function parseCoords(query: Readonly<Record<string, string | undefined>> | undefined): { lat: number; lon: number } | null {
  const lat = Number(query?.lat);
  const lon = Number(query?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

export function dispatchEnvironmental(
  request: EnvironmentalDispatchRequest,
  requestId: string,
  headers: Record<string, string>,
  bff?: EnvironmentalOracleBff,
): EnvironmentalDispatchResponse | null {
  const { method, path } = request;
  if (!path.startsWith('/api/v1/world/environmental') && !path.startsWith('/api/v1/environmental')) {
    return null;
  }

  const svc = resolveBff(bff);
  const coords = parseCoords(request.query) ?? { lat: 37.7749, lon: -122.4194 };

  if (path === '/api/v1/world/environmental' && method === 'GET') {
    return result(
      Object.freeze({
        schema: 'sunrey.bff.environmental-snapshot.v1',
        data: svc.snapshot(coords.lat, coords.lon),
      }),
      headers,
    );
  }

  if (path === '/api/v1/world/environmental/weather' && method === 'GET') {
    return result(
      Object.freeze({
        schema: 'sunrey.bff.environmental-weather.v1',
        data: svc.weather(coords.lat, coords.lon),
      }),
      headers,
    );
  }

  if (path === '/api/v1/world/environmental/forecast' && method === 'GET') {
    return result(
      Object.freeze({
        schema: 'sunrey.bff.environmental-forecast.v1',
        data: svc.forecast(coords.lat, coords.lon),
      }),
      headers,
    );
  }

  if (path === '/api/v1/world/environmental/air-quality' && method === 'GET') {
    return result(
      Object.freeze({
        schema: 'sunrey.bff.environmental-air-quality.v1',
        data: svc.airQuality(coords.lat, coords.lon),
      }),
      headers,
    );
  }

  if (path === '/api/v1/world/environmental/water' && method === 'GET') {
    return result(
      Object.freeze({
        schema: 'sunrey.bff.environmental-water.v1',
        data: svc.water(coords.lat, coords.lon),
      }),
      headers,
    );
  }

  if (path === '/api/v1/environmental/separation-proof' && method === 'GET') {
    return result(svc.separationProof(), headers);
  }

  if (path === '/api/v1/environmental/agent-evidence' && method === 'GET') {
    return result(
      Object.freeze({
        schema: 'sunrey.bff.environmental-agent-evidence.v1',
        data: svc.agentEvidence(coords.lat, coords.lon),
      }),
      headers,
    );
  }

  if (path === '/api/v1/environmental/travel-context' && method === 'GET') {
    const q = request.query ?? {};
    const originLat = q.originLat != null ? Number(q.originLat) : null;
    const originLon = q.originLon != null ? Number(q.originLon) : null;
    const destLat = q.destLat != null ? Number(q.destLat) : coords.lat;
    const destLon = q.destLon != null ? Number(q.destLon) : coords.lon;
    return result(
      Object.freeze({
        schema: 'sunrey.bff.environmental-travel-context.v1',
        data: svc.travelContext(originLat, originLon, destLat, destLon),
      }),
      headers,
    );
  }

  return result(failure(requestId, `unknown environmental route: ${method} ${path}`), headers, 404);
}
