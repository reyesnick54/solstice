import { createHash } from 'node:crypto';

import {
  ProviderWebhookGuard,
  WEBHOOK_SCHEMA_VERSION,
  type ProviderWebhookEnvelope,
} from '../../../../security/src/regulated/webhook.ts';
import { SecretValue } from '../../../../security/src/redaction.ts';
import type { ComplianceAdapterStore } from './store.ts';
import type { ComplianceAdapterProfile, NormalizedComplianceFinding } from './types.ts';

export class ComplianceAdapterWebhook {
  readonly #guard = new ProviderWebhookGuard();
  readonly #secret: SecretValue;

  constructor(
    private readonly store: ComplianceAdapterStore,
    private readonly profile: ComplianceAdapterProfile,
    secret = 'fixture-compliance-adapter-webhook',
  ) {
    this.#secret = new SecretValue(secret);
    this.#guard.registerProvider(profile.providerId, this.#secret);
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
        providerId: this.profile.providerId,
        eventType: input.eventType,
        timestampUtc: input.timestampUtc,
        nonce: input.nonce,
        idempotencyKey: input.idempotencyKey,
        payloadHash,
      },
      this.#secret,
    );
  }

  receiveWebhook(
    envelope: ProviderWebhookEnvelope,
    apply: () => NormalizedComplianceFinding,
    nowMs: number,
  ):
    | { readonly ok: true; readonly duplicate: boolean; readonly finding: NormalizedComplianceFinding | null }
    | {
        readonly ok: false;
        readonly code: 'SCHEMA_INVALID' | 'UNKNOWN_PROVIDER' | 'INVALID_SIGNATURE' | 'STALE_TIMESTAMP' | 'REPLAYED';
        readonly stateUnchanged: true;
      } {
    const validated = this.#guard.validate(envelope, nowMs);
    if (!validated.ok) {
      return { ok: false, code: validated.code, stateUnchanged: true };
    }
    const key = `${envelope.providerId}:${envelope.idempotencyKey}`;
    if (validated.duplicate || this.store.webhookKeys.has(key)) {
      return { ok: true, duplicate: true, finding: null };
    }
    this.store.webhookKeys.add(key);
    return { ok: true, duplicate: false, finding: apply() };
  }
}

export function unverifiedComplianceWebhookMayChangeState(): false {
  return false;
}
