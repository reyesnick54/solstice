import { businessIntentFingerprint, computeRequestDigest, providerIdempotencyKeyFor } from './digest.ts';
import type { OperationStore } from './store.ts';
import { isIdempotencyConflict } from './store.ts';
import {
  FAILOVER_REQUIRES_NEW_LINEAGE,
  freezeOperation,
  type OperationExecutionRecord,
  type RequestDigestFields,
} from './types.ts';

export type FailoverRequest = {
  readonly from: OperationExecutionRecord;
  readonly originalDigest: RequestDigestFields;
  readonly newProviderId: string;
  readonly newCredentialRef: string;
  readonly digest: RequestDigestFields;
  readonly now: string;
  readonly newOperationId: string;
};

export type FailoverResult =
  | { readonly ok: true; readonly abandoned: OperationExecutionRecord; readonly successor: OperationExecutionRecord }
  | { readonly ok: false; readonly code: string };

/**
 * Moving an unresolved operation from provider A to provider B is not an
 * ordinary retry. It requires a new attempt lineage, new provider
 * credential, and new provider idempotency key for the same immutable
 * business intent. Provider A remaining able to finalize later is detected
 * because the abandoned lineage stays queryable.
 */
export async function startProviderFailover(
  store: OperationStore,
  request: FailoverRequest,
): Promise<FailoverResult> {
  if (request.originalDigest.nativeAssetId !== request.digest.nativeAssetId) {
    return { ok: false, code: 'FAILOVER_CANNOT_CHANGE_ASSET' };
  }
  const originalIntent = businessIntentFingerprint(request.originalDigest);
  const requestedIntent = businessIntentFingerprint(request.digest);
  if (
    originalIntent !== requestedIntent ||
    request.originalDigest.beneficiary !== request.digest.beneficiary
  ) {
    return { ok: false, code: 'FAILOVER_CANNOT_CHANGE_BENEFICIARY' };
  }
  if (request.newProviderId === request.from.providerId) {
    return { ok: false, code: FAILOVER_REQUIRES_NEW_LINEAGE };
  }
  if (!request.newCredentialRef) {
    return { ok: false, code: 'FAILOVER_REQUIRES_NEW_CREDENTIAL' };
  }
  const abandoned = await store.update(
    freezeOperation({
      ...request.from,
      state: 'RECONCILIATION_REQUIRED',
      lastObservedAt: request.now,
      lastSafeErrorCode: 'PROVIDER_FAILOVER',
      lastSafeErrorMessage: `abandoned_for_${request.newProviderId}`,
    }),
  );
  const lineage = `${request.from.attemptLineage}->${request.newProviderId}`;
  const successorDraft = await store.prepare({
    operationId: request.newOperationId,
    operationKind: request.from.operationKind,
    businessKey: request.from.businessKey,
    idempotencyKey: providerIdempotencyKeyFor({
      businessKey: request.from.businessKey,
      providerId: request.newProviderId,
      attemptLineage: lineage,
    }),
    digest: {
      ...request.digest,
      providerId: request.newProviderId,
    },
    correlationId: request.from.correlationId,
    causationId: request.from.operationId,
    intentId: request.from.intentId,
    evidenceId: request.from.evidenceId,
    attemptLineage: lineage,
    supersedesOperationId: request.from.operationId,
    now: request.now,
  });
  if (isIdempotencyConflict(successorDraft)) {
    return { ok: false, code: successorDraft.code };
  }
  return { ok: true, abandoned, successor: successorDraft };
}

export function unexpectedFinalizeFromAbandonedProvider(
  abandoned: OperationExecutionRecord,
  successor: OperationExecutionRecord,
): boolean {
  return (
    abandoned.state === 'RECONCILIATION_REQUIRED' &&
    abandoned.providerId !== successor.providerId &&
    computeRequestDigest({
      operationKind: abandoned.operationKind,
      amountMinor: 'ignored-for-provider-id-compare',
      assetId: abandoned.nativeAssetId ?? '',
      currency: null,
      beneficiary: null,
      destination: null,
      providerId: abandoned.providerId,
      network: null,
      nativeAssetId: abandoned.nativeAssetId,
    }).length > 0
  );
}
