/**
 * Consumer BFF Human Access Economy dispatch.
 * Orchestrates packages/human-access-economy product surface.
 * Not a second ledger, Kernel, or live provider connector.
 */

import type { HumanAccessEconomyProduct } from '../../../../packages/human-access-economy/src/service.ts';
import type { AccessActor } from '../../../../packages/human-access-economy/src/access.ts';
import type { AccessCategory } from '../../../../packages/human-access-economy/src/taxonomy.ts';
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
      body.errorCode === 'RESOURCE_NOT_OWNED'
        ? 403
        : body.errorCode === 'NOT_FOUND'
          ? 404
          : body.errorCode === 'FEATURE_UNAVAILABLE'
            ? 503
            : 400;
    return json(status, body, headers);
  }
  return json(okStatus, body, headers);
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function actorFrom(principal: BffPrincipal): AccessActor {
  return Object.freeze({
    actorId: principal.actorId,
    customerId: principal.customerId,
    verified: principal.verification === 'VERIFIED' && principal.customerStatus !== 'PENDING_VERIFICATION',
    restricted: principal.restricted || principal.customerStatus === 'SUSPENDED',
  });
}

export function mapAccessOutcome<T>(
  outcome: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } },
  requestId: string,
): T | BffErrorEnvelope {
  if (outcome.ok) {
    return outcome.value;
  }
  const errorCode =
    outcome.error.code === 'SUBJECT_MISMATCH'
      ? 'RESOURCE_NOT_OWNED'
      : outcome.error.code === 'NOT_FOUND'
        ? 'NOT_FOUND'
        : outcome.error.code === 'FEATURE_DISABLED'
          ? 'FEATURE_UNAVAILABLE'
          : 'VALIDATION';
  return bffError({
    errorCode,
    category:
      errorCode === 'RESOURCE_NOT_OWNED'
        ? 'AUTHORIZATION'
        : errorCode === 'NOT_FOUND'
          ? 'NOT_FOUND'
          : errorCode === 'FEATURE_UNAVAILABLE'
            ? 'TEMPORARY_UNAVAILABLE'
            : 'VALIDATION',
    message: outcome.error.message,
    retryable: errorCode === 'FEATURE_UNAVAILABLE',
    requestId,
    detailsSafeForClient: { code: outcome.error.code },
  });
}

function categoryOf(value: unknown): AccessCategory | undefined {
  return typeof value === 'string' ? (value as AccessCategory) : undefined;
}

export function dispatchAccess(
  product: HumanAccessEconomyProduct,
  request: DispatchRequest,
  principal: BffPrincipal,
  requestId: string,
  headers: Record<string, string>,
): DispatchResponse | null {
  const { method, path } = request;
  if (!path.startsWith('/api/v1/access')) {
    return null;
  }
  const rec = request.body && typeof request.body === 'object' ? (request.body as Record<string, unknown>) : {};
  const actor = actorFrom(principal);
  const idempotencyKey = str(rec.idempotencyKey) ?? `${method}:${path}:${principal.actorId}`;

  if (path === '/api/v1/access/overview' && method === 'GET') {
    return result(mapAccessOutcome(product.overview(actor), requestId), headers);
  }
  if (path === '/api/v1/access/categories' && method === 'GET') {
    return result(mapAccessOutcome(product.categories(), requestId), headers);
  }
  if (path === '/api/v1/access/entitlements' && method === 'GET') {
    return result(mapAccessOutcome(product.entitlements(actor), requestId), headers);
  }
  if (path === '/api/v1/access/reservations' && method === 'GET') {
    return result(mapAccessOutcome(product.reservations(actor), requestId), headers);
  }
  if (path === '/api/v1/access/activity' && method === 'GET') {
    return result(mapAccessOutcome(product.activity(actor), requestId), headers);
  }
  if (path === '/api/v1/access/intents' && method === 'POST') {
    return result(
      mapAccessOutcome(
        product.createIntent(actor, {
          category: categoryOf(rec.category) ?? 'MOBILITY',
          summary: str(rec.summary) ?? str(rec.description) ?? '',
          ...(str(rec.location) ? { location: str(rec.location) } : {}),
          idempotencyKey,
        }),
        requestId,
      ),
      headers,
      201,
    );
  }
  if (path === '/api/v1/access/availability' && method === 'POST') {
    return result(
      mapAccessOutcome(
        product.checkAvailability(actor, {
          category: categoryOf(rec.category) ?? 'MOBILITY',
          ...(str(rec.summary) ? { summary: str(rec.summary) } : {}),
          ...(str(rec.description) ? { summary: str(rec.description) } : {}),
          ...(str(rec.location) ? { location: str(rec.location) } : {}),
          ...(str(rec.intentId) ? { intentId: str(rec.intentId) } : {}),
        }),
        requestId,
      ),
      headers,
    );
  }
  if (path === '/api/v1/access/quotes' && method === 'POST') {
    return result(
      mapAccessOutcome(
        product.createQuote(actor, {
          category: categoryOf(rec.category) ?? 'MOBILITY',
          summary: str(rec.summary) ?? str(rec.description) ?? '',
          ...(str(rec.location) ? { location: str(rec.location) } : {}),
          ...(str(rec.intentId) ? { intentId: str(rec.intentId) } : {}),
          idempotencyKey,
        }),
        requestId,
      ),
      headers,
      201,
    );
  }
  if (path === '/api/v1/access/reservations' && method === 'POST') {
    return result(
      mapAccessOutcome(
        product.createReservation(actor, {
          quoteId: str(rec.quoteId) ?? '',
          ...(str(rec.startsAt) ? { startsAt: str(rec.startsAt) } : {}),
          ...(str(rec.endsAt) ? { endsAt: str(rec.endsAt) } : {}),
          idempotencyKey,
        }),
        requestId,
      ),
      headers,
      201,
    );
  }
  if (path.startsWith('/api/v1/access/reservations/') && path.endsWith('/confirm') && method === 'POST') {
    const id = path.slice('/api/v1/access/reservations/'.length, -'/confirm'.length);
    return result(mapAccessOutcome(product.confirmReservation(actor, decodeURIComponent(id)), requestId), headers);
  }
  if (path.startsWith('/api/v1/access/reservations/') && path.endsWith('/cancel') && method === 'POST') {
    const id = path.slice('/api/v1/access/reservations/'.length, -'/cancel'.length);
    return result(mapAccessOutcome(product.cancelReservation(actor, decodeURIComponent(id)), requestId), headers);
  }
  if (path === '/api/v1/access/experiences/quote' && method === 'POST') {
    return result(
      mapAccessOutcome(
        product.quoteExperience(actor, {
          destination: str(rec.destination) ?? '',
          durationDays: num(rec.durationDays) ?? num(rec.duration_days) ?? 0,
          ...(str(rec.title) ? { title: str(rec.title) } : {}),
          idempotencyKey,
        }),
        requestId,
      ),
      headers,
      201,
    );
  }
  if (path.startsWith('/api/v1/access/experiences/') && path.endsWith('/confirm') && method === 'POST') {
    const id = path.slice('/api/v1/access/experiences/'.length, -'/confirm'.length);
    return result(mapAccessOutcome(product.confirmExperience(actor, decodeURIComponent(id)), requestId), headers);
  }

  return json(
    404,
    bffError({
      errorCode: 'NOT_FOUND',
      category: 'NOT_FOUND',
      message: 'access resource not found',
      retryable: false,
      requestId,
    }),
    headers,
  );
}