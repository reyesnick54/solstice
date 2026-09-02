/**
 * Wave 8 — internal operations HTTP routes.
 *
 * Protected operational interfaces. Not consumer authorization.
 */

import type { PlatformApiConfig } from '../config.ts';
import type { ReadinessReport } from '../readiness.ts';
import { PlatformApiError } from '../errors.ts';
import type { RouteDefinition } from '../http.ts';
import { assertInternalOperator } from '../internal-production-gates.ts';
import { createInternalGovernanceRoutes } from './governance-routes.ts';
import { createSandboxOperationsPlane, type SandboxOperationsPlane } from './plane.ts';

export type InternalOperationsRouteOptions = {
  readonly operatorToken?: string | undefined;
  readonly plane?: SandboxOperationsPlane;
  readonly config: PlatformApiConfig;
  readonly readiness: () => Promise<ReadinessReport>;
  readonly persistenceConfigured?: boolean;
};

export function createInternalOperationsRoutes(options: InternalOperationsRouteOptions): readonly RouteDefinition[] {
  const plane = options.plane ?? createSandboxOperationsPlane();
  const guard = (headers: Readonly<Record<string, string>>): void => {
    assertInternalOperator(headers, options.operatorToken);
  };
  const readiness = options.readiness;

  const opsRoutes: RouteDefinition[] = [
    {
      method: 'GET',
      path: '/internal/v1/ops/health',
      endpointClass: 'internal',
      requiresIdempotency: false,
      handler: async ({ headers }) => {
        guard(headers);
        const report = await readiness();
        return {
          status: 200,
          body: {
            surface: 'INTERNAL',
            consumerSafe: false,
            productHealth: plane.productHealth(options.config, report, options.persistenceConfigured ?? false),
          },
        };
      },
    },
    {
      method: 'GET',
      path: '/internal/v1/ops/dashboard',
      endpointClass: 'internal',
      requiresIdempotency: false,
      handler: async ({ headers }) => {
        guard(headers);
        return { status: 200, body: { surface: 'INTERNAL', consumerSafe: false, dashboard: plane.dashboard() } };
      },
    },
    {
      method: 'GET',
      path: '/internal/v1/ops/chain',
      endpointClass: 'internal',
      requiresIdempotency: false,
      handler: async ({ headers }) => {
        guard(headers);
        return { status: 200, body: { surface: 'INTERNAL', consumerSafe: false, chain: plane.chainStatus() } };
      },
    },
    {
      method: 'GET',
      path: '/internal/v1/ops/economic-awareness',
      endpointClass: 'internal',
      requiresIdempotency: false,
      handler: async ({ headers }) => {
        guard(headers);
        return { status: 200, body: plane.economicAwarenessHealth() };
      },
    },
    {
      method: 'GET',
      path: '/internal/v1/ops/claims/queues',
      endpointClass: 'internal',
      requiresIdempotency: false,
      handler: async ({ headers }) => {
        guard(headers);
        return { status: 200, body: { surface: 'INTERNAL', consumerSafe: false, queues: plane.claimQueues() } };
      },
    },
    {
      method: 'GET',
      path: '/internal/v1/ops/challenges/queues',
      endpointClass: 'internal',
      requiresIdempotency: false,
      handler: async ({ headers }) => {
        guard(headers);
        return { status: 200, body: { surface: 'INTERNAL', consumerSafe: false, queues: plane.challengeQueues() } };
      },
    },
    {
      method: 'GET',
      path: '/internal/v1/ops/identity/review',
      endpointClass: 'internal',
      requiresIdempotency: false,
      handler: async ({ headers }) => {
        guard(headers);
        return { status: 200, body: { surface: 'INTERNAL', consumerSafe: false, review: plane.identityReviewQueue() } };
      },
    },
    {
      method: 'GET',
      path: '/internal/v1/ops/policy/status',
      endpointClass: 'internal',
      requiresIdempotency: false,
      handler: async ({ headers }) => {
        guard(headers);
        return { status: 200, body: { surface: 'INTERNAL', consumerSafe: false, policy: plane.policyStatus() } };
      },
    },
    {
      method: 'GET',
      path: '/internal/v1/ops/circuit-breakers',
      endpointClass: 'internal',
      requiresIdempotency: false,
      handler: async ({ headers }) => {
        guard(headers);
        return { status: 200, body: { surface: 'INTERNAL', consumerSafe: false, circuitBreakers: plane.circuitBreakers() } };
      },
    },
    {
      method: 'GET',
      path: '/internal/v1/ops/reconciliation',
      endpointClass: 'internal',
      requiresIdempotency: false,
      handler: async ({ headers }) => {
        guard(headers);
        return { status: 200, body: { surface: 'INTERNAL', consumerSafe: false, reconciliation: plane.reconciliation() } };
      },
    },
    {
      method: 'GET',
      path: '/internal/v1/ops/agents',
      endpointClass: 'internal',
      requiresIdempotency: false,
      handler: async ({ headers }) => {
        guard(headers);
        return { status: 200, body: { surface: 'INTERNAL', consumerSafe: false, agents: plane.agentOperations() } };
      },
    },
    {
      method: 'GET',
      path: '/internal/v1/ops/feature-gates',
      endpointClass: 'internal',
      requiresIdempotency: false,
      handler: async ({ headers }) => {
        guard(headers);
        return { status: 200, body: { surface: 'INTERNAL', consumerSafe: false, featureGates: plane.featureGates() } };
      },
    },
    {
      method: 'GET',
      path: '/internal/v1/ops/alerts',
      endpointClass: 'internal',
      requiresIdempotency: false,
      handler: async ({ headers }) => {
        guard(headers);
        return { status: 200, body: { surface: 'INTERNAL', consumerSafe: false, alerts: plane.alerts() } };
      },
    },
    {
      method: 'GET',
      path: '/internal/v1/ops/control-room',
      endpointClass: 'internal',
      requiresIdempotency: false,
      handler: async ({ headers }) => {
        guard(headers);
        return { status: 200, body: { surface: 'INTERNAL', consumerSafe: false, controlRoom: plane.controlRoom() } };
      },
    },
    {
      method: 'GET',
      path: '/internal/v1/ops/sandbox/seed',
      endpointClass: 'internal',
      requiresIdempotency: false,
      handler: async ({ headers }) => {
        guard(headers);
        return { status: 200, body: { surface: 'INTERNAL', consumerSafe: false, seed: plane.seedCatalog() } };
      },
    },
  ];

  return Object.freeze([...opsRoutes, ...createInternalGovernanceRoutes({ operatorToken: options.operatorToken })]);
}

export function rejectConsumerOpsAccess(headers: Readonly<Record<string, string>>): void {
  const client = (headers['x-sunrey-client'] ?? '').toLowerCase();
  if (client === 'lovable' || client === 'consumer' || client === 'bff') {
    throw new PlatformApiError({
      code: 'AUTHORIZATION_DENIED',
      message: 'consumer clients cannot access internal operations',
      category: 'AUTHORIZATION',
      retryable: false,
      httpStatus: 403,
    });
  }
}
