/**
 * Inbound provider webhook dispatch.
 *
 * HTTP callback → identify provider → verification adapter → signature
 * → timestamp/replay → persist evidence → normalize → idempotency →
 * async workflow token. Domain authority is never bypassed.
 */

import {
  ProviderWebhookGuard,
  type ProviderWebhookEnvelope,
} from '../../../../security/src/regulated/webhook.ts';
import { digestJson } from '../core.ts';
import { assertWebhookEnvironment } from './environment.ts';
import {
  universalErr,
  universalOk,
  type NormalizedWebhookEvent,
  type ProviderEvidenceRecord,
  type ProviderRegistration,
  type UniversalResult,
} from './types.ts';

export type WebhookDispatchResult = {
  readonly event: NormalizedWebhookEvent;
  readonly evidence: ProviderEvidenceRecord;
  readonly workflowToken: string;
};

export function dispatchProviderWebhook(input: {
  readonly registrations: readonly ProviderRegistration[];
  readonly guard: ProviderWebhookGuard;
  readonly envelope: ProviderWebhookEnvelope;
  readonly nowUtc: string;
  readonly nowMs: number;
  readonly correlationId: string;
}): UniversalResult<WebhookDispatchResult> {
  const registration = input.registrations.find((row) => row.providerId === input.envelope.providerId);
  if (!registration) {
    return universalErr('PROVIDER_NOT_REGISTERED', 'webhook provider is not registered', {
      providerId: input.envelope.providerId,
    });
  }
  if (!registration.webhookConfiguration) {
    return universalErr('PROVIDER_CONFIGURATION_ERROR', 'provider has no webhook configuration', {
      providerId: registration.providerId,
    });
  }
  const env = assertWebhookEnvironment(registration.webhookConfiguration, registration.environment);
  if (!env.ok) {
    return env;
  }
  const verified = input.guard.validate(input.envelope, input.nowMs);
  if (!verified.ok) {
    const code =
      verified.code === 'INVALID_SIGNATURE'
        ? 'PROVIDER_AUTH_FAILED'
        : verified.code === 'STALE_TIMESTAMP' || verified.code === 'REPLAYED'
          ? 'PROVIDER_REJECTED'
          : 'PROVIDER_VALIDATION_FAILED';
    return universalErr(code, `webhook ${verified.code}`, { providerId: registration.providerId });
  }

  const event: NormalizedWebhookEvent = Object.freeze({
    providerId: registration.providerId,
    eventType: input.envelope.eventType,
    idempotencyKey: input.envelope.idempotencyKey,
    correlationId: input.correlationId,
    payloadDigest: input.envelope.payloadHash,
    environment: registration.environment,
    duplicate: verified.duplicate,
    domainAuthorityBypassed: false as const,
  });

  const evidence: ProviderEvidenceRecord = Object.freeze({
    evidenceId: `pev_${digestJson(event).slice(0, 24)}`,
    providerId: registration.providerId,
    operation: `webhook.${input.envelope.eventType}`,
    requestRef: input.envelope.payloadHash,
    responseRef: digestJson({ accepted: true, duplicate: verified.duplicate }),
    timestamps: Object.freeze({ startedAt: input.envelope.timestampUtc, endedAt: input.nowUtc }),
    environment: registration.environment,
    routingDecision: null,
    result: verified.duplicate ? 'DUPLICATE' : 'ACCEPTED',
    correlationId: input.correlationId,
    providerTransactionId: input.envelope.idempotencyKey,
    secretPresent: false as const,
    panPresent: false as const,
    privateKeyPresent: false as const,
    prohibitedKycPresent: false as const,
  });

  return universalOk(
    Object.freeze({
      event,
      evidence,
      workflowToken: `wf_${registration.providerId}_${input.envelope.idempotencyKey}`,
    }),
  );
}
