import { hmacSha256Hex, verifyHmacSha256Hex } from '../hmac.ts';
import type { SecretValue } from '../redaction.ts';

export const WEBHOOK_SCHEMA_VERSION = 1 as const;
export const WEBHOOK_REPLAY_WINDOW_MS = 5 * 60 * 1000;

export type ProviderWebhookEnvelope = {
  readonly schemaVersion: typeof WEBHOOK_SCHEMA_VERSION;
  readonly providerId: string;
  readonly eventType: string;
  readonly timestampUtc: string;
  readonly nonce: string;
  readonly idempotencyKey: string;
  readonly payloadHash: string;
  readonly signatureHex: string;
  readonly environment?: string;
};

export type WebhookValidationResult =
  | { readonly ok: true; readonly duplicate: boolean }
  | {
      readonly ok: false;
      readonly code:
        | 'UNKNOWN_PROVIDER'
        | 'INVALID_SIGNATURE'
        | 'STALE_TIMESTAMP'
        | 'REPLAYED'
        | 'SCHEMA_INVALID'
        | 'ENVIRONMENT_MISMATCH';
    };

export class ProviderWebhookGuard {
  readonly #secrets = new Map<string, SecretValue>();
  readonly #environments = new Map<string, string>();
  readonly #seenNonces = new Map<string, number>();
  readonly #seenIdempotency = new Set<string>();

  registerProvider(providerId: string, secret: SecretValue, environment?: string): void {
    this.#secrets.set(providerId, secret);
    if (environment) {
      this.#environments.set(providerId, environment);
    }
  }

  sign(input: Omit<ProviderWebhookEnvelope, 'signatureHex'>, secret: SecretValue): ProviderWebhookEnvelope {
    const signatureHex = hmacSha256Hex(secret, canonicalWebhook(input));
    return Object.freeze({ ...input, signatureHex });
  }

  validate(envelope: ProviderWebhookEnvelope, nowMs: number): WebhookValidationResult {
    if (envelope.schemaVersion !== WEBHOOK_SCHEMA_VERSION) {
      return { ok: false, code: 'SCHEMA_INVALID' };
    }
    if (!envelope.providerId || !envelope.eventType || !envelope.nonce || !envelope.idempotencyKey) {
      return { ok: false, code: 'SCHEMA_INVALID' };
    }
    const secret = this.#secrets.get(envelope.providerId);
    if (!secret) {
      return { ok: false, code: 'UNKNOWN_PROVIDER' };
    }
    const registeredEnvironment = this.#environments.get(envelope.providerId);
    if (registeredEnvironment && envelope.environment !== registeredEnvironment) {
      return { ok: false, code: 'ENVIRONMENT_MISMATCH' };
    }
    const timestampMs = Date.parse(envelope.timestampUtc);
    if (!Number.isFinite(timestampMs) || Math.abs(nowMs - timestampMs) > WEBHOOK_REPLAY_WINDOW_MS) {
      return { ok: false, code: 'STALE_TIMESTAMP' };
    }
    if (!verifyHmacSha256Hex(secret, canonicalWebhook(envelope), envelope.signatureHex)) {
      return { ok: false, code: 'INVALID_SIGNATURE' };
    }
    const nonceKey = `${envelope.providerId}:${envelope.nonce}`;
    if (this.#seenNonces.has(nonceKey)) {
      return { ok: false, code: 'REPLAYED' };
    }
    this.#seenNonces.set(nonceKey, nowMs);
    const idem = `${envelope.providerId}:${envelope.idempotencyKey}`;
    if (this.#seenIdempotency.has(idem)) {
      return { ok: true, duplicate: true };
    }
    this.#seenIdempotency.add(idem);
    return { ok: true, duplicate: false };
  }
}

function canonicalWebhook(envelope: Omit<ProviderWebhookEnvelope, 'signatureHex'> | ProviderWebhookEnvelope): string {
  return [
    String(envelope.schemaVersion),
    envelope.providerId,
    envelope.eventType,
    envelope.timestampUtc,
    envelope.nonce,
    envelope.idempotencyKey,
    envelope.payloadHash,
    envelope.environment ?? '',
  ].join('\n');
}
