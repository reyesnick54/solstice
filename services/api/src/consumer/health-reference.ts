// @ts-nocheck
/**
 * Consumer BFF health reference dispatch — read-only public health reference resources.
 * Does NOT expose HIN private data or raw upstream payloads.
 */

import {
  createHealthReferenceSandbox,
  type HealthReferenceService,
} from '../../../../packages/sunrey-chain/src/health-reference/index.ts';
import { bffError, isBffError, type BffErrorEnvelope } from './errors.ts';

type HealthDispatchRequest = {
  readonly method: string;
  readonly path: string;
  readonly query?: Readonly<Record<string, string>>;
};

type HealthDispatchResponse = {
  readonly status: number;
  readonly body: unknown;
  readonly headers: Readonly<Record<string, string>>;
};

let defaultService: HealthReferenceService | undefined;

function resolveService(custom?: HealthReferenceService): HealthReferenceService {
  if (custom) return custom;
  if (!defaultService) defaultService = createHealthReferenceSandbox();
  return defaultService;
}

function json(status: number, body: unknown, headers: Record<string, string>): HealthDispatchResponse {
  return { status, body, headers };
}

function result(body: unknown, headers: Record<string, string>, okStatus = 200): HealthDispatchResponse {
  if (isBffError(body)) {
    return json(body.errorCode === 'NOT_FOUND' ? 404 : 400, body, headers);
  }
  return json(okStatus, body, headers);
}

function referenceEnvelope(data: unknown, providerId: string, stale: boolean, warnings: readonly string[] = []) {
  return Object.freeze({
    schema: 'sunrey.consumer.health.reference.v1',
    data,
    providerId,
    stale,
    readOnly: true,
    simulation: true,
    referenceOnly: true,
    notMedicalAdvice: true,
    notDiagnosis: true,
    hinLayer: 'HIN_REFERENCE_DATA',
    warnings: Object.freeze(warnings),
  });
}

export function dispatchHealthReference(
  request: HealthDispatchRequest,
  requestId: string,
  headers: Record<string, string>,
  health?: HealthReferenceService,
): HealthDispatchResponse | null {
  const { method, path, query = {} } = request;
  if (!path.startsWith('/api/v1/health/reference')) return null;

  const svc = resolveService(health);
  const limit = query.limit ? Number.parseInt(query.limit, 10) : undefined;

  try {
    if (path === '/api/v1/health/reference/foods' && method === 'GET') {
      const searchResult = svc.searchFoods(query.q ?? query.query ?? '', limit);
      return result(referenceEnvelope(searchResult.data, searchResult.providerId, searchResult.stale, searchResult.warnings), headers);
    }

    if (path.startsWith('/api/v1/health/reference/foods/') && method === 'GET') {
      const productId = path.slice('/api/v1/health/reference/foods/'.length);
      const productResult = svc.getFoodProduct(productId);
      if (!productResult.data) {
        return result(
          bffError({ errorCode: 'NOT_FOUND', category: 'VALIDATION', message: 'food product not found', retryable: false, requestId }),
          headers,
        );
      }
      return result(referenceEnvelope(productResult.data, productResult.providerId, productResult.stale), headers);
    }

    if (path === '/api/v1/health/reference/nutrition' && method === 'GET') {
      const searchResult = svc.searchFoods(query.q ?? query.query ?? '', limit);
      const nutrition = searchResult.data.map((f) =>
        Object.freeze({
          productId: f.productId,
          name: f.name,
          nutrients: f.nutrition,
          servingSize: f.servingSize,
          servingUnit: f.servingUnit,
          authorityClass: f.authorityClass,
          providerId: f.providerId,
        }),
      );
      return result(referenceEnvelope(nutrition, searchResult.providerId, searchResult.stale), headers);
    }

    if (path === '/api/v1/health/reference/drugs' && method === 'GET') {
      const searchResult = svc.searchDrugs(query.q ?? query.query ?? '', limit);
      return result(
        referenceEnvelope(searchResult.data, searchResult.providerId, searchResult.stale, [
          'reference only — not prescribing advice',
        ]),
        headers,
      );
    }

    if (path === '/api/v1/health/reference/devices' && method === 'GET') {
      const searchResult = svc.searchDevices(query.q ?? query.query ?? '', limit);
      return result(referenceEnvelope(searchResult.data, searchResult.providerId, searchResult.stale), headers);
    }

    if (path === '/api/v1/health/reference/genetics' && method === 'GET') {
      const searchResult = svc.searchGenetics(query.q ?? query.query ?? '', limit);
      return result(
        referenceEnvelope(searchResult.data, searchResult.providerId, searchResult.stale, [
          ...searchResult.warnings,
          'educational reference only — not personalized genetic interpretation',
        ]),
        headers,
      );
    }

    if (path === '/api/v1/health/reference/trials' && method === 'GET') {
      const searchResult = svc.searchClinicalTrials(query.q ?? query.query ?? '', limit);
      return result(referenceEnvelope(searchResult.data, searchResult.providerId, searchResult.stale, searchResult.warnings), headers);
    }

    if (path === '/api/v1/health/reference/providers' && method === 'GET') {
      const searchResult = svc.searchHealthcareProviders(query.q ?? query.query ?? '', limit);
      return result(referenceEnvelope(searchResult.data, searchResult.providerId, searchResult.stale, searchResult.warnings), headers);
    }

    if (path === '/api/v1/health/reference/public-health' && method === 'GET') {
      const searchResult = svc.searchPublicHealth(query.q ?? query.query ?? '', limit);
      return result(referenceEnvelope(searchResult.data, searchResult.providerId, searchResult.stale), headers);
    }

    if (path === '/api/v1/health/reference/wellness' && method === 'GET') {
      const searchResult = svc.searchWellness(query.q ?? query.query ?? '', limit);
      return result(referenceEnvelope(searchResult.data, searchResult.providerId, searchResult.stale, searchResult.warnings), headers);
    }

    if (path === '/api/v1/health/reference/providers/health' && method === 'GET') {
      return result(
        Object.freeze({
          schema: 'sunrey.consumer.health.providers.v1',
          providers: svc.allProviderHealth(),
          readOnly: true,
          simulation: true,
        }),
        headers,
      );
    }

    return result(
      bffError({ errorCode: 'NOT_FOUND', category: 'VALIDATION', message: 'health reference route not found', retryable: false, requestId }),
      headers,
    );
  } catch {
    return result(
      bffError({ errorCode: 'INTERNAL', category: 'SYSTEM', message: 'health reference dispatch failed', retryable: true, requestId }),
      headers,
      500,
    );
  }
}

export const HEALTH_REFERENCE_BFF_ROUTES = Object.freeze([
  'GET /api/v1/health/reference/foods',
  'GET /api/v1/health/reference/foods/{productId}',
  'GET /api/v1/health/reference/nutrition',
  'GET /api/v1/health/reference/drugs',
  'GET /api/v1/health/reference/devices',
  'GET /api/v1/health/reference/genetics',
  'GET /api/v1/health/reference/trials',
  'GET /api/v1/health/reference/providers',
  'GET /api/v1/health/reference/public-health',
  'GET /api/v1/health/reference/wellness',
  'GET /api/v1/health/reference/providers/health',
]);
