/**
 * Consumer BFF HIN dispatch. Orchestrates packages/information-market
 * rights-marketplace. Licensee controls stay off this surface.
 */

import type { InformationRightsMarketplace } from '../../../../packages/information-market/src/rights-marketplace/index.ts';
import {
  projectLicenses,
  projectParticipation,
  projectPermissions,
  projectRights,
} from '../../../../packages/information-market/src/rights-marketplace/index.ts';
import { bffError, isBffError, type BffErrorEnvelope } from './errors.ts';
import type { BffPrincipal } from './ports.ts';

type HinDispatchRequest = {
  readonly method: string;
  readonly path: string;
  readonly body: unknown;
};

type HinDispatchResponse = {
  readonly status: number;
  readonly body: unknown;
  readonly headers: Readonly<Record<string, string>>;
};

function json(status: number, body: unknown, headers: Record<string, string>): HinDispatchResponse {
  return { status, body, headers };
}

function result(body: unknown, headers: Record<string, string>, okStatus = 200): HinDispatchResponse {
  if (isBffError(body)) {
    const status = body.errorCode === 'RESOURCE_NOT_OWNED' ? 403 : body.errorCode === 'NOT_FOUND' ? 404 : 400;
    return json(status, body, headers);
  }
  return json(okStatus, body, headers);
}

function mapOutcome<T>(
  outcome: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } },
  requestId: string,
): T | BffErrorEnvelope {
  if (outcome.ok) return outcome.value;
  const errorCode = outcome.error.code === 'CROSS_USER' ? 'RESOURCE_NOT_OWNED' : 'VALIDATION';
  return bffError({
    errorCode,
    category: errorCode === 'RESOURCE_NOT_OWNED' ? 'AUTHORIZATION' : 'VALIDATION',
    message: outcome.error.message,
    retryable: false,
    requestId,
    detailsSafeForClient: { code: outcome.error.code },
  });
}

export function dispatchHin(
  market: InformationRightsMarketplace,
  request: HinDispatchRequest,
  principal: BffPrincipal,
  requestId: string,
  headers: Record<string, string>,
): HinDispatchResponse | null {
  const { method, path } = request;
  if (!path.startsWith('/api/v1/hin')) {
    return null;
  }

  const holder = principal.customerId;

  if (path === '/api/v1/hin/rights' && method === 'GET') {
    return json(200, projectRights(market, holder), headers);
  }
  if (path === '/api/v1/hin/licenses' && method === 'GET') {
    return json(200, projectLicenses(market, holder), headers);
  }
  if (path === '/api/v1/hin/earnings' && method === 'GET') {
    return json(200, market.earningsFor(holder), headers);
  }
  if (path === '/api/v1/hin/earnings/activity' && method === 'GET') {
    return json(200, market.earningsActivity(holder), headers);
  }
  if (path === '/api/v1/hin/permissions' && method === 'GET') {
    return json(200, projectPermissions(market, holder), headers);
  }
  if (path === '/api/v1/hin/usage' && method === 'GET') {
    return json(200, { ...projectPermissions(market, holder), schema: 'sunrey.consumer.hin.usage.v1' }, headers);
  }
  if (path === '/api/v1/hin/participation' && method === 'GET') {
    return json(200, projectParticipation(market, holder), headers);
  }
  if (path === '/api/v1/hin/participation/pause' && method === 'POST') {
    return result(mapOutcome(market.pauseParticipation(holder), requestId), headers);
  }
  if (path === '/api/v1/hin/participation/withdraw' && method === 'POST') {
    return result(mapOutcome(market.withdrawParticipation(holder), requestId), headers);
  }
  if (path.startsWith('/api/v1/hin/licensee') || path.startsWith('/api/v1/hin/developer')) {
    return json(
      404,
      bffError({
        errorCode: 'NOT_FOUND',
        category: 'NOT_FOUND',
        message: 'licensee controls are not exposed through the consumer BFF',
        retryable: false,
        requestId,
      }),
      headers,
    );
  }
  return null;
}
