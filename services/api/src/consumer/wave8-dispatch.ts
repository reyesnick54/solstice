// @ts-nocheck
/**
 * Wave 8 — SunRey / MoonRey / Action Center / realtime route dispatch.
 */

import { consumerContractManifest, deprecationForPath } from './api-contract.ts';
import { CONSUMER_API_DOMAINS } from './domains.ts';
import { listUnifiedActions, type ActionCenterSources } from './action-center-unified.ts';
import { createSunReyApiSurface } from './sunrey-api.ts';
import { createMoonReyApiSurface } from './moonrey-api.ts';
import {
  BLOCKCHAIN_TX_STATUSES,
  ECONOMIC_CLAIM_STATUSES,
} from './status-semantics.ts';
import {
  buildRealtimeSnapshot,
  formatRealtimeSse,
  heartbeatSse,
} from './realtime.ts';
import { bffError, isBffError, statusForError, type BffErrorEnvelope } from './errors.ts';
import type { BffPrincipal } from './ports.ts';
import type { ConsumerBffRuntime } from './handler.ts';

export type Wave8DispatchRequest = {
  readonly method: string;
  readonly path: string;
  readonly query: Readonly<Record<string, string>>;
  readonly accept?: string;
};

export type Wave8DispatchResponse = {
  readonly status: number;
  readonly body: unknown;
  readonly extraHeaders?: Readonly<Record<string, string>>;
  readonly eventStream?: string;
} | null;

export function dispatchWave8(
  runtime: ConsumerBffRuntime,
  request: Wave8DispatchRequest,
  principal: BffPrincipal,
  requestId: string,
): Wave8DispatchResponse {
  const { method, path, query } = request;

  if (!isWave8OwnedRoute(method, path)) {
    return null;
  }

  const deprecation = deprecationForPath(method, path);
  const deprecationHeaders = deprecation
    ? Object.freeze({
        deprecation: 'true',
        sunset: deprecation.sunsetAfter ?? 'unknown',
        link: `<${deprecation.replacement}>; rel="successor-version"`,
      })
    : undefined;

  if (path === '/api/v1/catalog/contract' && method === 'GET') {
    return respond(200, consumerContractManifest(), deprecationHeaders);
  }
  if (path === '/api/v1/catalog/domains' && method === 'GET') {
    return respond(200, Object.freeze({ schema: 'sunrey.consumer.domains.v1', items: CONSUMER_API_DOMAINS }), deprecationHeaders);
  }

  const sunrey = createSunReyApiSurface({
    nativeEconomy: runtime.nativeEconomy,
    hinContributions: runtime.hinContributions ?? (runtime.hin && isHin(runtime.hin) ? runtime.hin : undefined),
  });
  const moonrey = createMoonReyApiSurface({
    nativeEconomy: runtime.nativeEconomy,
    productiveEconomy: runtime.productiveEconomy,
  });

  if (path === '/api/v1/sunrey/balance' && method === 'GET') {
    return respond(200, sunrey.balance(principal, requestId), deprecationHeaders);
  }
  if (path === '/api/v1/sunrey/supply' && method === 'GET') {
    return respond(200, sunrey.supply(requestId), deprecationHeaders);
  }
  if (path === '/api/v1/sunrey/contributions/status' && method === 'GET') {
    return respond(200, sunrey.contributionStatus(principal, requestId), deprecationHeaders);
  }
  if (path === '/api/v1/sunrey/contributions/history' && method === 'GET') {
    return respond(200, sunrey.contributionHistory(principal, requestId), deprecationHeaders);
  }
  if (path === '/api/v1/sunrey/peve' && method === 'GET') {
    return respond(200, sunrey.peve(principal, requestId), deprecationHeaders);
  }
  if (path === '/api/v1/sunrey/receipts' && method === 'GET') {
    return respond(200, sunrey.issuanceReceipts(principal, requestId), deprecationHeaders);
  }
  if (path === '/api/v1/sunrey/network-status' && method === 'GET') {
    return respond(200, sunrey.networkStatus(requestId), deprecationHeaders);
  }

  if (path === '/api/v1/moonrey/balance' && method === 'GET') {
    return respond(200, moonrey.balance(principal, requestId), deprecationHeaders);
  }
  if (path === '/api/v1/moonrey/supply' && method === 'GET') {
    return respond(200, moonrey.supply(requestId), deprecationHeaders);
  }
  if (path === '/api/v1/moonrey/categories' && method === 'GET') {
    return respond(200, moonrey.categories(requestId), deprecationHeaders);
  }
  if (path === '/api/v1/moonrey/indicators' && method === 'GET') {
    const category = query.category ?? query.cat;
    return respond(200, moonrey.indicators(requestId, category), deprecationHeaders);
  }
  if (path === '/api/v1/moonrey/gpuv' && method === 'GET') {
    const category = query.category ?? query.cat;
    return respond(200, moonrey.gpuv(requestId, category), deprecationHeaders);
  }
  if (path === '/api/v1/moonrey/claims' && method === 'GET') {
    return respond(200, moonrey.claims(requestId), deprecationHeaders);
  }
  if (path === '/api/v1/moonrey/receipts' && method === 'GET') {
    return respond(200, moonrey.receipts(requestId), deprecationHeaders);
  }
  if (path === '/api/v1/moonrey/providers' && method === 'GET') {
    return respond(200, moonrey.providers(requestId), deprecationHeaders);
  }

  if (path === '/api/v1/actions' && method === 'GET') {
    const sources = actionCenterSources(runtime);
    const list = listUnifiedActions(sources, principal, requestId, query.view);
    return respond(200, list, deprecationHeaders);
  }
  if (path === '/api/v1/actions/stream' && method === 'GET') {
    const sources = actionCenterSources(runtime);
    const list = listUnifiedActions(sources, principal, requestId);
    const after = Number(query.after ?? '0');
    const snapshot = buildRealtimeSnapshot({
      requestId,
      subjectId: principal.customerId,
      after: Number.isFinite(after) ? after : 0,
      actionCenterCount: list.totalCount,
    });
    if ((request.accept ?? '').includes('text/event-stream')) {
      return {
        status: 200,
        body: formatRealtimeSse(snapshot.events) + heartbeatSse(),
        extraHeaders: Object.freeze({ 'content-type': 'text/event-stream; charset=utf-8' }),
        eventStream: formatRealtimeSse(snapshot.events),
      };
    }
    return respond(200, snapshot, deprecationHeaders);
  }
  if (path === '/api/v1/events/stream' && method === 'GET') {
    const after = Number(query.after ?? '0');
    const snapshot = buildRealtimeSnapshot({
      requestId,
      subjectId: principal.customerId,
      after: Number.isFinite(after) ? after : 0,
    });
    if ((request.accept ?? '').includes('text/event-stream')) {
      return {
        status: 200,
        body: formatRealtimeSse(snapshot.events) + heartbeatSse(),
        extraHeaders: Object.freeze({ 'content-type': 'text/event-stream; charset=utf-8' }),
        eventStream: formatRealtimeSse(snapshot.events),
      };
    }
    return respond(200, snapshot, deprecationHeaders);
  }

  if (path === '/api/v1/catalog/status-semantics' && method === 'GET') {
    return respond(
      200,
      Object.freeze({
        schema: 'sunrey.consumer.status-semantics.v1',
        blockchainTxStatus: BLOCKCHAIN_TX_STATUSES,
        economicClaimStatus: ECONOMIC_CLAIM_STATUSES,
      }),
      deprecationHeaders,
    );
  }

  if (!path.startsWith('/api/v1/sunrey') && !path.startsWith('/api/v1/moonrey') && path !== '/api/v1/actions' && path !== '/api/v1/actions/stream' && path !== '/api/v1/events/stream' && !path.startsWith('/api/v1/catalog/')) {
    return null;
  }

  return {
    status: 404,
    body: bffError({
      errorCode: 'NOT_FOUND',
      category: 'NOT_FOUND',
      message: 'wave8 route not found',
      retryable: false,
      requestId,
    }),
  };
}

function isWave8OwnedRoute(method: string, path: string): boolean {
  if (path.startsWith('/api/v1/catalog/')) {
    return method === 'GET';
  }
  if (path.startsWith('/api/v1/sunrey') || path.startsWith('/api/v1/moonrey')) {
    return method === 'GET';
  }
  if (path === '/api/v1/actions' || path === '/api/v1/actions/stream' || path === '/api/v1/events/stream') {
    return method === 'GET';
  }
  return false;
}

function respond(status: number, body: unknown, extraHeaders?: Readonly<Record<string, string>>): Wave8DispatchResponse {
  if (isBffError(body)) {
    return { status: statusForError(body), body, extraHeaders };
  }
  return { status, body, extraHeaders };
}

function actionCenterSources(runtime: ConsumerBffRuntime): ActionCenterSources {
  return Object.freeze({
    bff: runtime.bff,
    ...(runtime.conversation ? { conversation: runtime.conversation } : {}),
    ...(runtime.access
      ? {
          accessEvents: (customerId: string) => runtime.access!.actionCenterEvents(customerId),
        }
      : {}),
    ...(runtime.agentExternalEvidence
      ? {
          externalEvents: () => runtime.agentExternalEvidence!.externalEvents(),
        }
      : {}),
  });
}

function isHin(value: unknown): value is import('./hin-adapter.ts').HinContributionSurface {
  return Boolean(value && typeof value === 'object' && 'methodologies' in value);
}

export const WAVE8_BFF_ROUTES = [
  'GET /api/v1/catalog/contract',
  'GET /api/v1/catalog/domains',
  'GET /api/v1/catalog/status-semantics',
  'GET /api/v1/sunrey/balance',
  'GET /api/v1/sunrey/supply',
  'GET /api/v1/sunrey/contributions/status',
  'GET /api/v1/sunrey/contributions/history',
  'GET /api/v1/sunrey/peve',
  'GET /api/v1/sunrey/receipts',
  'GET /api/v1/sunrey/network-status',
  'GET /api/v1/moonrey/balance',
  'GET /api/v1/moonrey/supply',
  'GET /api/v1/moonrey/categories',
  'GET /api/v1/moonrey/indicators',
  'GET /api/v1/moonrey/gpuv',
  'GET /api/v1/moonrey/claims',
  'GET /api/v1/moonrey/receipts',
  'GET /api/v1/moonrey/providers',
  'GET /api/v1/actions',
  'GET /api/v1/actions/stream',
  'GET /api/v1/events/stream',
] as const;
