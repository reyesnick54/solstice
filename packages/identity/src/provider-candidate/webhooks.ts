import { createHash } from 'node:crypto';

import {
  ProviderWebhookGuard,
  WEBHOOK_SCHEMA_VERSION,
  type ProviderWebhookEnvelope,
  type WebhookValidationResult,
} from '../../../security/src/regulated/webhook.ts';
import { SecretValue } from '../../../security/src/redaction.ts';
import type { IdentityVerificationResult } from '../ports.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import { FIXTURE_IDENTITY_PROVIDER_ID } from './profile.ts';

export class IdentityProviderWebhookConformance {
  readonly #guard = new ProviderWebhookGuard();
  readonly #applied = new Set<string>();
  readonly #secret = new SecretValue('fixture-identity-webhook-secret');

  constructor() {
    this.#guard.registerProvider(FIXTURE_IDENTITY_PROVIDER_ID, this.#secret);
  }

  sign(input: {
    readonly eventType: string;
    readonly timestampUtc: string;
    readonly nonce: string;
    readonly idempotencyKey: string;
    readonly payload: unknown;
  }): ProviderWebhookEnvelope {
    const payloadHash = createHash('sha256').update(JSON.stringify(input.payload)).digest('hex');
    return this.#guard.sign(
      {
        schemaVersion: WEBHOOK_SCHEMA_VERSION,
        providerId: FIXTURE_IDENTITY_PROVIDER_ID,
        eventType: input.eventType,
        timestampUtc: input.timestampUtc,
        nonce: input.nonce,
        idempotencyKey: input.idempotencyKey,
        payloadHash,
      },
      this.#secret,
    );
  }

  ingest(
    envelope: ProviderWebhookEnvelope,
    nowMs: number,
    apply: () => IdentityVerificationResult,
  ):
    | { readonly ok: true; readonly duplicate: boolean; readonly result: IdentityVerificationResult | null }
    | { readonly ok: false; readonly code: WebhookValidationResult extends { ok: false } ? WebhookValidationResult['code'] : never } {
    const validated = this.#guard.validate(envelope, nowMs);
    if (!validated.ok) {
      return validated;
    }
    if (validated.duplicate || this.#applied.has(envelope.idempotencyKey)) {
      return { ok: true, duplicate: true, result: null };
    }
    this.#applied.add(envelope.idempotencyKey);
    return { ok: true, duplicate: false, result: apply() };
  }
}

export function identityWebhookNow(now: UtcInstant): number {
  return Date.parse(now);
}
