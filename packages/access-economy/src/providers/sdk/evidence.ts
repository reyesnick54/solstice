/**
 * ACCESS Wave 2 — Provider operation evidence references.
 *
 * Reuses evidence/provenance semantics. Does not store sensitive full payloads.
 */

import type { AccessProviderId } from '../types.ts';

export type AccessProviderEvidenceRecord = {
  readonly evidenceId: string;
  readonly providerId: AccessProviderId;
  readonly providerReference: string | null;
  readonly requestId: string;
  readonly responseHash: string | null;
  readonly timestamp: string;
  readonly status: string;
  readonly operation: string;
};

export function createProviderEvidence(input: {
  readonly evidenceId: string;
  readonly providerId: AccessProviderId;
  readonly providerReference?: string | null;
  readonly requestId: string;
  readonly responseHash?: string | null;
  readonly timestamp: string;
  readonly status: string;
  readonly operation: string;
}): AccessProviderEvidenceRecord {
  return Object.freeze({
    evidenceId: input.evidenceId,
    providerId: input.providerId,
    providerReference: input.providerReference ?? null,
    requestId: input.requestId,
    responseHash: input.responseHash ?? null,
    timestamp: input.timestamp,
    status: input.status,
    operation: input.operation,
  });
}
