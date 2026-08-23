/**
 * Consumer BFF Personal Data Vault dispatch.
 * Orchestrates packages/personal-data-vault product. Privacy logic stays
 * in the Vault — Lovable only renders these resources.
 */

import type { PersonalDataVaultProduct, VaultPurpose } from '../../../../packages/personal-data-vault/src/product/index.ts';
import { VAULT_PURPOSES } from '../../../../packages/personal-data-vault/src/product/index.ts';
import { bffError, isBffError, type BffErrorEnvelope } from './errors.ts';
import type { BffPrincipal } from './ports.ts';

type VaultDispatchRequest = {
  readonly method: string;
  readonly path: string;
  readonly query: Readonly<Record<string, string>>;
  readonly body: unknown;
};

type VaultDispatchResponse = {
  readonly status: number;
  readonly body: unknown;
  readonly headers: Readonly<Record<string, string>>;
};

function json(status: number, body: unknown, headers: Record<string, string>): VaultDispatchResponse {
  return { status, body, headers };
}

function mapVaultFailure(
  outcome: { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } },
  requestId: string,
): unknown | BffErrorEnvelope {
  if (outcome.ok) {
    return outcome.value;
  }
  const code = outcome.error.code;
  const errorCode =
    code === 'CROSS_SUBJECT_DENIED' || code === 'SUBJECT_MISMATCH' || code === 'CAPABILITY_DENIED'
      ? 'RESOURCE_NOT_OWNED'
      : code === 'GET_ALL_FORBIDDEN' || code === 'AGENT_CATEGORY_DENIED' || code === 'PURPOSE_DENIED'
        ? 'FORBIDDEN'
        : code === 'EXPORT_NOT_FOUND'
          ? 'NOT_FOUND'
          : 'VALIDATION';
  return bffError({
    errorCode,
    category:
      errorCode === 'RESOURCE_NOT_OWNED' || errorCode === 'FORBIDDEN'
        ? 'AUTHORIZATION'
        : errorCode === 'NOT_FOUND'
          ? 'NOT_FOUND'
          : 'VALIDATION',
    message: outcome.error.message,
    retryable: false,
    requestId,
    detailsSafeForClient: { code },
  });
}

function result(body: unknown, headers: Record<string, string>, okStatus = 200): VaultDispatchResponse {
  if (isBffError(body)) {
    const status =
      body.errorCode === 'RESOURCE_NOT_OWNED' || body.errorCode === 'FORBIDDEN'
        ? 403
        : body.errorCode === 'NOT_FOUND'
          ? 404
          : 400;
    return json(status, body, headers);
  }
  return json(okStatus, body, headers);
}

function purposeOf(value: string | undefined, fallback: VaultPurpose): VaultPurpose {
  if (value && (VAULT_PURPOSES as readonly string[]).includes(value)) {
    return value as VaultPurpose;
  }
  return fallback;
}

function rec(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
}

export function dispatchVault(
  product: PersonalDataVaultProduct,
  request: VaultDispatchRequest,
  principal: BffPrincipal,
  requestId: string,
  headers: Record<string, string>,
  identity: { resolveActorContext(actorId: string): { ok: boolean; value?: unknown } },
): VaultDispatchResponse | null {
  const { method, path, query, body } = request;
  if (path !== '/api/v1/data' && !path.startsWith('/api/v1/data/')) {
    return null;
  }

  const resolved = identity.resolveActorContext(principal.actorId);
  if (!resolved.ok || !resolved.value) {
    return json(
      403,
      bffError({
        errorCode: 'RESOURCE_NOT_OWNED',
        category: 'AUTHORIZATION',
        message: 'verified actor context is required for vault access',
        retryable: false,
        requestId,
      }),
      headers,
    );
  }
  const actor = resolved.value;
  const subjectId = (actor as { subjectId: string }).subjectId;
  const input = rec(body);

  if ((path === '/api/v1/data' || path === '/api/v1/data/vault') && method === 'GET') {
    return result(
      mapVaultFailure(product.home(actor, subjectId, purposeOf(query.purpose, 'VAULT_SELF_VIEW')), requestId),
      headers,
    );
  }

  if (path === '/api/v1/data/vault/categories' && method === 'GET') {
    return json(
      200,
      {
        schema: 'sunrey.consumer.vault.categories.v1',
        version: product.listCategories()[0]?.version ?? 'sunrey.vault.category-registry.v1',
        productionActive: false,
        liveMonetizationEnabled: false,
        items: product.clientCategories(),
      },
      headers,
    );
  }

  if (path === '/api/v1/data/vault/records' && method === 'GET') {
    const listed = product.listRecords(actor, subjectId, purposeOf(query.purpose, 'VAULT_SELF_VIEW'), {
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.kind ? { kind: query.kind as never } : {}),
      ...(query.status ? { status: query.status } : {}),
    });
    const mapped = mapVaultFailure(listed, requestId);
    if (isBffError(mapped)) {
      return result(mapped, headers);
    }
    return json(
      200,
      {
        schema: 'sunrey.consumer.vault.records.v1',
        items: mapped,
        productionActive: false,
      },
      headers,
    );
  }

  if (path === '/api/v1/data/vault/sources' && method === 'GET') {
    return result(
      mapVaultFailure(product.listSources(actor, subjectId, purposeOf(query.purpose, 'VAULT_SELF_VIEW')), requestId),
      headers,
    );
  }

  if (path === '/api/v1/data/vault/access' && method === 'GET') {
    const listed = product.listAccess(actor, subjectId, purposeOf(query.purpose, 'CONSENT_REVIEW'));
    const mapped = mapVaultFailure(listed, requestId);
    if (isBffError(mapped)) {
      return result(mapped, headers);
    }
    return json(200, { schema: 'sunrey.consumer.vault.access.v1', items: mapped }, headers);
  }

  if (path === '/api/v1/data/vault/corrections' && method === 'GET') {
    return result(
      mapVaultFailure(product.listCorrections(actor, subjectId, purposeOf(query.purpose, 'VAULT_CORRECTION')), requestId),
      headers,
    );
  }

  if (path === '/api/v1/data/vault/export' && method === 'POST') {
    return result(
      mapVaultFailure(product.requestExport(actor, subjectId, purposeOf(query.purpose, 'VAULT_EXPORT')), requestId),
      headers,
      202,
    );
  }

  if (path === '/api/v1/data/vault/export/status' && method === 'GET') {
    return result(
      mapVaultFailure(product.exportStatus(actor, subjectId, purposeOf(query.purpose, 'VAULT_EXPORT')), requestId),
      headers,
    );
  }

  if (path.startsWith('/api/v1/data/vault/export/') && method === 'GET') {
    const exportId = path.slice('/api/v1/data/vault/export/'.length);
    if (!exportId || exportId.includes('/')) {
      return null;
    }
    const exported = product.getExport(actor, subjectId, exportId, purposeOf(query.purpose, 'VAULT_EXPORT'));
    const mapped = mapVaultFailure(exported, requestId);
    if (isBffError(mapped)) {
      return result(mapped, headers);
    }
    const value = mapped as { job: unknown; bundle: { assets?: readonly { payloadJson?: unknown }[] } | null };
    return json(
      200,
      {
        schema: 'sunrey.consumer.vault.export.v1',
        job: value.job,
        bundle: value.bundle
          ? {
              ...value.bundle,
              assets: value.bundle.assets?.map((row) => ({
                ...row,
                payloadJson: row.payloadJson ?? null,
              })),
            }
          : null,
        omitsInternalSecurityMetadata: true,
        omitsOtherUsers: true,
        productionActive: false,
      },
      headers,
    );
  }

  if (path.startsWith('/api/v1/data/vault/records/')) {
    const rest = path.slice('/api/v1/data/vault/records/'.length);
    const parts = rest.split('/');
    const recordId = parts[0] ?? '';
    if (!recordId) {
      return null;
    }
    if (parts.length === 1 && method === 'GET') {
      return result(
        mapVaultFailure(
          product.getRecord(
            actor,
            subjectId,
            recordId,
            purposeOf(query.purpose, 'VAULT_SELF_VIEW'),
            query.includePayload === 'true',
          ),
          requestId,
        ),
        headers,
      );
    }
    if (parts.length === 2 && parts[1] === 'history' && method === 'GET') {
      return result(
        mapVaultFailure(
          product.listHistory(actor, subjectId, recordId, purposeOf(query.purpose, 'VAULT_SELF_VIEW')),
          requestId,
        ),
        headers,
      );
    }
    if (parts.length === 2 && parts[1] === 'corrections' && method === 'POST') {
      return result(
        mapVaultFailure(
          product.correctOrDispute(actor, {
            subjectId,
            recordId,
            purpose: purposeOf(typeof input.purpose === 'string' ? input.purpose : query.purpose, 'VAULT_CORRECTION'),
            reason: typeof input.reason === 'string' ? input.reason : 'customer correction',
            ...(input.proposedPayload !== undefined ? { proposedPayload: input.proposedPayload } : {}),
          }),
          requestId,
        ),
        headers,
      );
    }
    if (parts.length === 1 && method === 'PATCH') {
      return result(
        mapVaultFailure(
          product.correctOrDispute(actor, {
            subjectId,
            recordId,
            purpose: 'VAULT_CORRECTION',
            reason: typeof input.reason === 'string' ? input.reason : 'user declared correction',
            ...(input.payload !== undefined
              ? { proposedPayload: input.payload }
              : input.proposedPayload !== undefined
                ? { proposedPayload: input.proposedPayload }
                : {}),
          }),
          requestId,
        ),
        headers,
      );
    }
  }

  return null;
}
