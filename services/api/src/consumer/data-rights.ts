/**
 * Consumer BFF data-rights dispatch. Orchestrates packages/consent product.
 * Not a second consent ledger, Vault, or HIN marketplace.
 */

import type { ConsentDataRightsEngine } from '../../../../packages/consent/src/product/engine.ts';
import type { DataRightsActor } from '../../../../packages/consent/src/product/types.ts';
import type { VerifiedActorContext } from '../../../../packages/identity/src/actor-context.ts';
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
      body.errorCode === 'STEP_UP_REQUIRED'
        ? 401
        : body.errorCode === 'RESOURCE_NOT_OWNED'
          ? 403
          : body.errorCode === 'NOT_FOUND'
            ? 404
            : 400;
    return json(status, body, headers);
  }
  return json(okStatus, body, headers);
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function mapDataRightsOutcome<T>(
  outcome: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } },
  requestId: string,
): T | BffErrorEnvelope {
  if (outcome.ok) {
    return outcome.value;
  }
  const errorCode =
    outcome.error.code === 'SUBJECT_MISMATCH'
      ? 'RESOURCE_NOT_OWNED'
      : outcome.error.code === 'ASSURANCE_INSUFFICIENT'
        ? 'STEP_UP_REQUIRED'
        : outcome.error.code === 'NO_ACTIVE_CONSENT'
          ? 'NOT_FOUND'
          : 'VALIDATION';
  return bffError({
    errorCode,
    category:
      errorCode === 'STEP_UP_REQUIRED'
        ? 'AUTHENTICATION'
        : errorCode === 'RESOURCE_NOT_OWNED'
          ? 'AUTHORIZATION'
          : 'VALIDATION',
    message: outcome.error.message,
    retryable: false,
    requestId,
    detailsSafeForClient: { code: outcome.error.code },
  });
}

function actorFrom(
  principal: BffPrincipal,
  identity?: { resolveActorContext(actorId: string): { ok: boolean; value?: unknown } },
): DataRightsActor {
  const resolved = identity?.resolveActorContext(principal.actorId);
  const verified = resolved?.ok === true ? (resolved.value as VerifiedActorContext) : undefined;
  return {
    actorId: principal.actorId,
    subjectId: verified?.subjectId ?? principal.identityId,
    jurisdiction: principal.jurisdiction,
    ...(verified ? { verified } : {}),
    capabilities: principal.capabilities,
    originatedFromAgent: false,
    stepUpSatisfied: principal.verification === 'VERIFIED',
  };
}

export function dispatchDataRights(
  engine: ConsentDataRightsEngine,
  request: DispatchRequest,
  principal: BffPrincipal,
  requestId: string,
  headers: Record<string, string>,
  identity?: { resolveActorContext(actorId: string): { ok: boolean; value?: unknown } },
): DispatchResponse | null {
  const path = request.path;
  const method = request.method;
  const rec = request.body && typeof request.body === 'object' ? (request.body as Record<string, unknown>) : {};
  const actor = actorFrom(principal, identity);
  const expiresAt = str(rec.expiresAt) ?? '2027-08-23T12:00:00.000Z';
  const idempotencyKey = str(rec.idempotencyKey) ?? `${method}:${path}:${principal.actorId}:${str(rec.purposeId) ?? str(rec.bundleId) ?? 'default'}`;

  if (path === '/api/v1/data/permissions' && method === 'GET') {
    return result(mapDataRightsOutcome(engine.listPermissions(actor), requestId), headers);
  }
  if (path === '/api/v1/data/consents' && method === 'GET') {
    const listed = engine.listConsents(actor);
    return result(
      mapDataRightsOutcome(
        listed.ok ? { ok: true, value: { schema: 'sunrey.consumer.data.consents.v1', items: listed.value } } : listed,
        requestId,
      ),
      headers,
    );
  }
  if (path === '/api/v1/data/consents' && method === 'POST') {
    const purposeId = str(rec.purposeId);
    const bundleId = str(rec.bundleId);
    const economicUseClass = str(rec.economicUseClass);
    const recipientClass = str(rec.recipientClass);
    const granted = engine.grantConsent(actor, {
      ...(purposeId ? { purposeId } : {}),
      ...(bundleId ? { bundleId } : {}),
      expiresAt,
      idempotencyKey,
      sessionId: principal.sessionId,
      ...(Array.isArray(rec.dataCategories) ? { dataCategories: rec.dataCategories as never } : {}),
      ...(economicUseClass ? { economicUseClass: economicUseClass as never } : {}),
      ...(recipientClass ? { recipientClass: recipientClass as never } : {}),
    });
    return result(mapDataRightsOutcome(granted, requestId), headers, 201);
  }
  const revoke = /^\/api\/v1\/data\/consents\/([^/]+)\/revoke$/.exec(path);
  if (revoke && method === 'POST') {
    const revoked = engine.revokeConsent(
      actor,
      decodeURIComponent(revoke[1] ?? ''),
      str(rec.reason) ?? 'user revoked',
      idempotencyKey,
    );
    return result(mapDataRightsOutcome(revoked, requestId), headers);
  }
  if (path === '/api/v1/data/access-history' && method === 'GET') {
    const listed = engine.listAccessHistory(actor);
    return result(
      mapDataRightsOutcome(
        listed.ok ? { ok: true, value: { schema: 'sunrey.consumer.data.access-history.v1', items: listed.value } } : listed,
        requestId,
      ),
      headers,
    );
  }
  if (path === '/api/v1/data/who' && method === 'GET') {
    return result(mapDataRightsOutcome(engine.whoCanUse(actor), requestId), headers);
  }
  if (path === '/api/v1/data/rights/requests' && method === 'GET') {
    const listed = engine.listRightsRequests(actor);
    return result(
      mapDataRightsOutcome(
        listed.ok ? { ok: true, value: { schema: 'sunrey.consumer.data.rights.v1', items: listed.value } } : listed,
        requestId,
      ),
      headers,
    );
  }
  if (path === '/api/v1/data/rights/requests' && method === 'POST') {
    const jurisdiction = str(rec.jurisdiction);
    const submitted = engine.submitRightsRequest(actor, {
      type: (str(rec.type) ?? 'ACCESS') as never,
      idempotencyKey,
      ...(jurisdiction ? { jurisdiction } : {}),
    });
    return result(mapDataRightsOutcome(submitted, requestId), headers, 201);
  }
  if (path === '/api/v1/hin/participation' && method === 'GET') {
    return result(mapDataRightsOutcome(engine.getHinParticipation(actor), requestId), headers);
  }
  if (path === '/api/v1/hin/participation/enroll' && method === 'POST') {
    return result(
      mapDataRightsOutcome(
        engine.enrollHin(actor, {
          expiresAt,
          idempotencyKey,
          ...(Array.isArray(rec.categories) ? { categories: rec.categories as never } : {}),
        }),
        requestId,
      ),
      headers,
      201,
    );
  }
  if (path === '/api/v1/hin/participation/pause' && method === 'POST') {
    return result(mapDataRightsOutcome(engine.pauseHin(actor), requestId), headers);
  }
  if (path === '/api/v1/hin/participation/withdraw' && method === 'POST') {
    return result(mapDataRightsOutcome(engine.withdrawHin(actor), requestId), headers);
  }
  return null;
}
