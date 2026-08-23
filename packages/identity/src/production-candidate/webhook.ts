import { createHash } from 'node:crypto';

import {
  ProviderWebhookGuard,
  WEBHOOK_SCHEMA_VERSION,
  type ProviderWebhookEnvelope,
} from '../../../security/src/regulated/webhook.ts';
import { SecretValue } from '../../../security/src/redaction.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import type { IdentityAdapterStore } from './store.ts';
import type { IdentityAdapterProfile, IdentityVerificationRecord, IdentityVerificationState } from './types.ts';

export type IdentityWebhookPayload = {
  readonly verificationId: string;
  readonly state: IdentityVerificationState;
  readonly now: UtcInstant;
};

export class IdentityAdapterWebhook {
  readonly #guard = new ProviderWebhookGuard();
  readonly #secret: SecretValue;

  readonly #store: IdentityAdapterStore;
  readonly #profile: IdentityAdapterProfile;

  constructor(
    store: IdentityAdapterStore,
    profile: IdentityAdapterProfile,
    secret = 'fixture-identity-adapter-webhook',
  ) {
    this.#store = store;
    this.#profile = profile;
    this.#secret = new SecretValue(secret);
    this.#guard.registerProvider(profile.providerId, this.#secret);
  }

  sign(input: {
    readonly eventType: string;
    readonly timestampUtc: string;
    readonly nonce: string;
    readonly idempotencyKey: string;
    readonly payload: IdentityWebhookPayload;
  }): ProviderWebhookEnvelope {
    const payloadHash = createHash('sha256').update(JSON.stringify(input.payload)).digest('hex');
    return this.#guard.sign(
      {
        schemaVersion: WEBHOOK_SCHEMA_VERSION,
        providerId: this.#profile.providerId,
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
    payload: IdentityWebhookPayload,
    nowMs: number,
  ):
    | { readonly ok: true; readonly duplicate: boolean; readonly record: IdentityVerificationRecord | null }
    | {
        readonly ok: false;
        readonly code: 'SCHEMA_INVALID' | 'UNKNOWN_PROVIDER' | 'INVALID_SIGNATURE' | 'STALE_TIMESTAMP' | 'REPLAYED' | 'ENVIRONMENT_MISMATCH';
        readonly stateUnchanged: true;
      } {
    const validated = this.#guard.validate(envelope, nowMs);
    if (!validated.ok) {
      return { ok: false, code: validated.code, stateUnchanged: true };
    }
    const key = `${envelope.providerId}:${envelope.idempotencyKey}`;
    if (validated.duplicate || this.#store.webhookKeys.has(key)) {
      return { ok: true, duplicate: true, record: null };
    }
    this.#store.webhookKeys.add(key);
    const current = this.#store.verifications.get(payload.verificationId);
    if (!current) {
      return { ok: true, duplicate: false, record: null };
    }
    const next: IdentityVerificationRecord = Object.freeze({
      ...current,
      state: payload.state,
      observedAt: payload.now,
      reasonCodes: Object.freeze([...current.reasonCodes, 'WEBHOOK_APPLIED']),
    });
    this.#store.verifications.set(next.verificationId, next);
    return { ok: true, duplicate: false, record: next };
  }
}

export function unverifiedWebhookMayChangeVerifiedState(): false {
  return false;
}
