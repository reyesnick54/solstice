/**
 * INTERNAL-only production-gate readiness.
 *
 * Not mounted on /api/v1 and not part of the Consumer BFF catalog.
 * Confidential legal/regulatory status must not leak to Lovable or
 * ordinary consumer clients.
 */

import {
  currentRepositoryGateSnapshot,
  formatProductionGateReport,
  prepareLaunchCeremonyChecklist,
  serializeExternalInputRegistry,
} from '../../../packages/sunrey-chain/src/production-handoff/production-gates/index.ts';
import { PlatformApiError } from './errors.ts';
import type { RouteDefinition } from './http.ts';

const INTERNAL_OPERATOR_ROLES = new Set(['GOVERNANCE_OPERATOR', 'GOVERNANCE_ADMIN', 'HUMAN_GOVERNANCE']);
const CONSUMER_CLIENTS = new Set(['lovable', 'consumer', 'bff', 'agent']);

export type InternalGateRouteOptions = {
  readonly operatorToken?: string | undefined;
};

export function createInternalProductionGateRoutes(options: InternalGateRouteOptions = {}): readonly RouteDefinition[] {
  const guard = (headers: Readonly<Record<string, string>>): void => {
    assertInternalOperator(headers, options.operatorToken);
  };
  return Object.freeze([
    {
      method: 'GET',
      path: '/internal/v1/production-gates',
      endpointClass: 'internal',
      requiresIdempotency: false,
      handler: async ({ headers }) => {
        guard(headers);
        const snapshot = currentRepositoryGateSnapshot();
        return {
          status: 200,
          body: {
            surface: 'INTERNAL',
            consumerSafe: false,
            productionActive: false,
            productionReady: false,
            releaseDecision: snapshot.releaseDecision,
            backendSoftwareReady: snapshot.backendSoftwareReady,
            externalGatesMissing: snapshot.externalGatesMissing,
            totalGates: snapshot.inputs.length,
            satisfiedInternalGateIds: snapshot.satisfiedInternalGateIds,
            missingExternalGateIds: snapshot.missingExternalGateIds,
            registryHash: snapshot.registryHash,
            decisionHash: snapshot.decisionHash,
            registry: serializeExternalInputRegistry(snapshot),
          },
        };
      },
    },
    {
      method: 'GET',
      path: '/internal/v1/production-gates/decision',
      endpointClass: 'internal',
      requiresIdempotency: false,
      handler: async ({ headers }) => {
        guard(headers);
        const snapshot = currentRepositoryGateSnapshot();
        return {
          status: 200,
          body: {
            surface: 'INTERNAL',
            releaseDecision: snapshot.releaseDecision,
            productionActive: snapshot.productionActive,
            blockers: snapshot.blockers,
            limitedLiveBlockers: snapshot.limitedLiveBlockers,
          },
        };
      },
    },
    {
      method: 'GET',
      path: '/internal/v1/production-gates/report',
      endpointClass: 'internal',
      requiresIdempotency: false,
      handler: async ({ headers }) => {
        guard(headers);
        const snapshot = currentRepositoryGateSnapshot();
        return {
          status: 200,
          body: {
            surface: 'INTERNAL',
            text: formatProductionGateReport(snapshot),
            ceremony: prepareLaunchCeremonyChecklist(snapshot),
          },
        };
      },
    },
  ]);
}

export function assertInternalOperator(
  headers: Readonly<Record<string, string>>,
  configuredToken: string | undefined,
): void {
  const client = (headers['x-sunrey-client'] ?? '').toLowerCase();
  if (CONSUMER_CLIENTS.has(client)) {
    throw new PlatformApiError({
      code: 'AUTHORIZATION_DENIED',
      message: 'consumer clients cannot read production-gate status',
      category: 'AUTHORIZATION',
      retryable: false,
      httpStatus: 403,
    });
  }
  const role = headers['x-sunrey-operator-role'] ?? '';
  if (!INTERNAL_OPERATOR_ROLES.has(role)) {
    throw new PlatformApiError({
      code: 'AUTHORIZATION_DENIED',
      message: 'internal operator role required',
      category: 'AUTHORIZATION',
      retryable: false,
      httpStatus: 403,
    });
  }
  if (!configuredToken || configuredToken.length === 0) {
    throw new PlatformApiError({
      code: 'AUTHORIZATION_DENIED',
      message: 'internal operator token is not configured; fail closed',
      category: 'AUTHORIZATION',
      retryable: false,
      httpStatus: 403,
    });
  }
  const presented = headers['x-sunrey-internal-token'] ?? '';
  if (presented !== configuredToken) {
    throw new PlatformApiError({
      code: 'AUTHENTICATION_REQUIRED',
      message: 'internal operator token required',
      category: 'AUTHENTICATION',
      retryable: false,
      httpStatus: 401,
    });
  }
}
