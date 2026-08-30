/**
 * INTERNAL-only provider operations and health surfaces.
 *
 * Aggregate health is exposed internally. Individual provider details
 * require operator authentication. Not part of the Consumer BFF.
 */

import {
  catalogTotal,
  createProviderObservabilityPlane,
  type ProviderObservabilityPlane,
} from '../../../packages/sunrey-chain/src/provider-runtime/universal/observability/index.ts';
import {
  createUniversalProviderRuntime,
  seedSimulationProviders,
} from '../../../packages/sunrey-chain/src/provider-runtime/universal/index.ts';
import { PlatformApiError } from './errors.ts';
import type { RouteDefinition } from './http.ts';
import { assertInternalOperator } from './internal-production-gates.ts';

export type InternalProviderOpsOptions = {
  readonly operatorToken?: string | undefined;
  readonly plane?: ProviderObservabilityPlane;
};

export function createDefaultProviderOpsPlane(): ProviderObservabilityPlane {
  const runtime = createUniversalProviderRuntime();
  seedSimulationProviders(runtime);
  return createProviderObservabilityPlane(runtime, { catalogTotal: catalogTotal() });
}

export function createInternalProviderOpsRoutes(
  options: InternalProviderOpsOptions = {},
): readonly RouteDefinition[] {
  const plane = options.plane ?? createDefaultProviderOpsPlane();
  const guard = (headers: Readonly<Record<string, string>>): void => {
    assertInternalOperator(headers, options.operatorToken);
  };
  return Object.freeze([
    {
      method: 'GET',
      path: '/internal/v1/providers/health',
      endpointClass: 'internal',
      requiresIdempotency: false,
      handler: async ({ headers }) => {
        guard(headers);
        const aggregate = plane.aggregateHealth();
        return {
          status: 200,
          body: {
            surface: 'INTERNAL',
            consumerSafe: false,
            externalProviders: aggregate,
            dependencies: plane.dependencyStatus(),
          },
        };
      },
    },
    {
      method: 'GET',
      path: '/internal/v1/providers/status',
      endpointClass: 'internal',
      requiresIdempotency: false,
      handler: async ({ headers, query }) => {
        guard(headers);
        const providerId = query.providerId;
        if (!providerId) {
          throw new PlatformApiError({
            code: 'VALIDATION_FAILED',
            message: 'providerId query parameter is required',
            category: 'VALIDATION',
            retryable: false,
            httpStatus: 400,
          });
        }
        const status = plane.internalProviderDetails(providerId);
        if (!status) {
          throw new PlatformApiError({
            code: 'NOT_FOUND',
            message: 'provider is not registered',
            category: 'VALIDATION',
            retryable: false,
            httpStatus: 404,
          });
        }
        return {
          status: 200,
          body: {
            surface: 'INTERNAL',
            consumerSafe: false,
            provider: status,
            alerts: plane.evaluateAlerts(providerId),
          },
        };
      },
    },
    {
      method: 'POST',
      path: '/internal/v1/providers/cache/invalidate',
      endpointClass: 'internal',
      requiresIdempotency: true,
      handler: async ({ headers, body }) => {
        guard(headers);
        const payload = body as Record<string, unknown>;
        const providerId = typeof payload.providerId === 'string' ? payload.providerId : null;
        if (!providerId) {
          throw new PlatformApiError({
            code: 'VALIDATION_FAILED',
            message: 'providerId is required',
            category: 'VALIDATION',
            retryable: false,
            httpStatus: 400,
          });
        }
        const cacheKey = typeof payload.cacheKey === 'string' ? payload.cacheKey : undefined;
        plane.invalidateProviderCache(providerId, cacheKey);
        return {
          status: 200,
          body: {
            surface: 'INTERNAL',
            invalidated: true,
            providerId,
            ...(cacheKey ? { cacheKey } : {}),
          },
        };
      },
    },
  ]);
}
