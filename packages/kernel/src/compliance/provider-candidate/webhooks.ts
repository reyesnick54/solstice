import { createHash } from 'node:crypto';

import {
  ProviderWebhookGuard,
  WEBHOOK_SCHEMA_VERSION,
  type ProviderWebhookEnvelope,
} from '../../../../security/src/regulated/webhook.ts';
import { SecretValue } from '../../../../security/src/redaction.ts';
import type { ProviderScreenResponse } from '../ports.ts';
import { FIXTURE_AML_PROVIDER_ID } from './profile.ts';

export class ComplianceProviderWebhookConformance {
  readonly #guard = new ProviderWebhookGuard();
  readonly #applied = new Set<string>();
  readonly #secret = new SecretValue('fixture-aml-webhook-secret');

  constructor() {
    this.#guard.registerProvider(FIXTURE_AML_PROVIDER_ID, this.#secret);
  }

  sign(input: {
    readonly eventType: string;
    readonly timestampUtc: string;
    readonly nonce: string;
    readonly idempotencyKey: string;
    readonly payload: unknown;
  }): ProviderWebhookEnvelope {
    return this.#guard.sign(
      {
        schemaVersion: WEBHOOK_SCHEMA_VERSION,
        providerId: FIXTURE_AML_PROVIDER_ID,
        eventType: input.eventType,
        timestampUtc: input.timestampUtc,
        nonce: input.nonce,
        idempotencyKey: input.idempotencyKey,
        payloadHash: createHash('sha256').update(JSON.stringify(input.payload)).digest('hex'),
      },
      this.#secret,
    );
  }

  ingest(
    envelope: ProviderWebhookEnvelope,
    nowMs: number,
    apply: () => ProviderScreenResponse,
  ):
    | { readonly ok: true; readonly duplicate: boolean; readonly result: ProviderScreenResponse | null }
    | { readonly ok: false; readonly code: string } {
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
