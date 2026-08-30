/**
 * ACCESS-18 Consumer BFF dispatch for human information to access surfaces.
 * Orchestration only — no raw PDV exposure.
 */

import { createHinAccessBffSurface, subjectRefFor } from '../../../../packages/human-access-economy/src/hin-access.ts';
import type { HumanInformationAccessBridge } from '../../../../packages/human-access-economy/src/hin-access.ts';
import { bffError, isBffError, type BffErrorEnvelope } from './errors.ts';
import type { BffPrincipal } from './ports.ts';

type DispatchRequest = {
  readonly method: string;
  readonly path: string;
  readonly body: unknown;
};

type DispatchResponse = {
  readonly status: number;
  readonly body: unknown;
  readonly headers: Readonly<Record<string, string>>;
};

function json(status: number, body: unknown, headers: Record<string, string>): DispatchResponse {
  return { status, body, headers };
}

function result(body: unknown, headers: Record<string, string>, okStatus = 200): DispatchResponse {
  if (isBffError(body)) {
    const status =
      body.errorCode === 'NOT_FOUND'
        ? 404
        : body.errorCode === 'RESOURCE_NOT_OWNED'
          ? 403
          : 400;
    return json(status, body, headers);
  }
  return json(okStatus, body, headers);
}

function subjectFor(principal: BffPrincipal) {
  return subjectRefFor(principal.identityId);
}

export function dispatchHinAccess(
  bridge: HumanInformationAccessBridge,
  request: DispatchRequest,
  principal: BffPrincipal,
  requestId: string,
  headers: Record<string, string>,
): DispatchResponse | null {
  const surface = createHinAccessBffSurface(bridge);
  const { method, path } = request;

  if (path === '/api/v1/data/opportunities' && method === 'GET') {
    return result(surface.listOpportunities(), headers);
  }

  const opportunityMatch = path.match(/^\/api\/v1\/data\/opportunities\/([^/]+)$/);
  if (opportunityMatch && method === 'GET') {
    const row = surface.getOpportunity(opportunityMatch[1]!);
    if ('error' in row) {
      return result(
        bffError({
          errorCode: 'NOT_FOUND',
          category: 'VALIDATION',
          message: 'opportunity not found',
          retryable: false,
          requestId,
        }),
        headers,
      );
    }
    return result(row, headers);
  }

  const optInMatch = path.match(/^\/api\/v1\/data\/opportunities\/([^/]+)\/opt-in$/);
  if (optInMatch && method === 'POST') {
    const outcome = bridge.optIn({
      opportunityId: optInMatch[1] as never,
      subjectRef: subjectFor(principal),
      subjectId: principal.identityId,
    });
    if (!outcome.ok) {
      return result(
        bffError({
          errorCode: 'VALIDATION',
          category: 'VALIDATION',
          message: outcome.error.message,
          retryable: false,
          requestId,
          detailsSafeForClient: { code: outcome.error.code },
        }),
        headers,
      );
    }
    return result(surface.participationHistory(subjectFor(principal)), headers, 201);
  }

  const declineMatch = path.match(/^\/api\/v1\/data\/opportunities\/([^/]+)\/decline$/);
  if (declineMatch && method === 'POST') {
    const outcome = bridge.decline({
      opportunityId: declineMatch[1] as never,
      subjectRef: subjectFor(principal),
      subjectId: principal.identityId,
    });
    if (!outcome.ok) {
      return result(
        bffError({
          errorCode: 'VALIDATION',
          category: 'VALIDATION',
          message: outcome.error.message,
          retryable: false,
          requestId,
        }),
        headers,
      );
    }
    return result(surface.participationHistory(subjectFor(principal)), headers);
  }

  if (path === '/api/v1/data/participation/history' && method === 'GET') {
    return result(surface.participationHistory(subjectFor(principal)), headers);
  }

  if (path === '/api/v1/data/compensation/history' && method === 'GET') {
    return result(surface.compensationHistory(subjectFor(principal)), headers);
  }

  if (path === '/api/v1/data/consent/status' && method === 'GET') {
    return result(surface.consentStatus(subjectFor(principal)), headers);
  }

  return null;
}

export type HinAccessDispatchOutcome = DispatchResponse | BffErrorEnvelope | null;
