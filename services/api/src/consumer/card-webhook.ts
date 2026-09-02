/**
 * Consumer BFF card webhook verification gate.
 * Unverified processor callbacks must not reach card ingestion.
 */

import {
  ProviderWebhookGuard,
  type ProviderWebhookEnvelope,
} from '../../../../packages/security/src/regulated/webhook.ts';
import { bffError, type BffErrorEnvelope } from './errors.ts';

export type CardWebhookBridge = {
  readonly guard: ProviderWebhookGuard;
  readonly ingest: (
    input: { readonly envelope: ProviderWebhookEnvelope; readonly payload: Readonly<Record<string, unknown>> },
    requestId: string,
  ) => unknown;
  readonly nowMs?: () => number;
};

function isEnvelope(value: unknown): value is ProviderWebhookEnvelope {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const rec = value as Record<string, unknown>;
  return (
    rec.schemaVersion === 1 &&
    typeof rec.providerId === 'string' &&
    typeof rec.eventType === 'string' &&
    typeof rec.timestampUtc === 'string' &&
    typeof rec.nonce === 'string' &&
    typeof rec.idempotencyKey === 'string' &&
    typeof rec.payloadHash === 'string' &&
    typeof rec.signatureHex === 'string'
  );
}

export function handleVerifiedCardWebhook(input: {
  readonly body: unknown;
  readonly requestId: string;
  readonly bridge: CardWebhookBridge;
}): { readonly status: number; readonly body: unknown } | BffErrorEnvelope {
  const rec = input.body && typeof input.body === 'object' && !Array.isArray(input.body)
    ? (input.body as Record<string, unknown>)
    : null;
  if (!rec || !isEnvelope(rec.envelope)) {
    return bffError({
      errorCode: 'VALIDATION',
      category: 'VALIDATION',
      message: 'card webhook requires a signed envelope and payload',
      retryable: false,
      requestId: input.requestId,
    });
  }
  const payload =
    rec.payload && typeof rec.payload === 'object' && !Array.isArray(rec.payload)
      ? (rec.payload as Record<string, unknown>)
      : {};
  const nowMs = input.bridge.nowMs?.() ?? Date.now();
  const validated = input.bridge.guard.validate(rec.envelope, nowMs);
  if (!validated.ok) {
    return bffError({
      errorCode: 'AUTH_REQUIRED',
      category: 'AUTHENTICATION',
      message: 'card webhook signature verification failed',
      retryable: false,
      requestId: input.requestId,
      detailsSafeForClient: { code: validated.code },
    });
  }
  return {
    status: 200,
    body: input.bridge.ingest({ envelope: rec.envelope, payload }, input.requestId),
  };
}
