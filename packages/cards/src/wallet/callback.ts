import { hmacSha256Hex, verifyHmacSha256Hex } from '../../../security/src/hmac.ts';
import type { SecretValue } from '../../../security/src/redaction.ts';
import { parseSecretReference, type SecretProvider, type SecretReference } from '../../../security/src/secrets.ts';
import { assertNoSensitiveCardData } from '../pci-boundary.ts';

export const WALLET_CALLBACK_MAX_SKEW_MS = 5n * 60n * 1000n;

export type WalletCallbackEventType = 'TOKEN_ACTIVATED' | 'TOKEN_SUSPENDED' | 'TOKEN_DELETED';

export type WalletCallbackEnvelope = {
  readonly providerId: string;
  readonly eventType: WalletCallbackEventType;
  readonly idempotencyKey: string;
  readonly nonce: string;
  readonly timestampMs: bigint;
  readonly schemaVersion: 1;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly signatureHex: string;
};

export type WalletCallbackFailure = {
  readonly code:
    | 'CALLBACK_UNAUTHENTICATED'
    | 'CALLBACK_INVALID_SIGNATURE'
    | 'CALLBACK_REPLAY'
    | 'CALLBACK_SCHEMA_INVALID'
    | 'CALLBACK_EXPIRED';
  readonly message: string;
};

export type WalletCallbackReplayStore = {
  seen(key: string): boolean;
  remember(key: string): void;
};

export class InMemoryWalletCallbackReplayStore implements WalletCallbackReplayStore {
  private readonly keys = new Set<string>();

  seen(key: string): boolean {
    return this.keys.has(key);
  }

  remember(key: string): void {
    this.keys.add(key);
  }
}

export function canonicalWalletCallbackPayload(
  envelope: Omit<WalletCallbackEnvelope, 'signatureHex'>,
): string {
  return [
    envelope.providerId,
    envelope.eventType,
    envelope.idempotencyKey,
    envelope.nonce,
    envelope.timestampMs.toString(),
    String(envelope.schemaVersion),
    JSON.stringify(envelope.payload),
  ].join('\n');
}

export function signWalletCallback(
  secret: SecretValue,
  envelope: Omit<WalletCallbackEnvelope, 'signatureHex'>,
): WalletCallbackEnvelope {
  assertNoSensitiveCardData(envelope.payload, 'wallet.callback.payload');
  return Object.freeze({
    ...envelope,
    payload: Object.freeze({ ...envelope.payload }),
    signatureHex: hmacSha256Hex(secret, canonicalWalletCallbackPayload(envelope)),
  });
}

export function verifyWalletCallback(input: {
  readonly envelope: WalletCallbackEnvelope;
  readonly secrets: SecretProvider;
  readonly secretRef: SecretReference | string;
  readonly nowMs: bigint;
  readonly replay: WalletCallbackReplayStore;
  readonly expectedProviderId: string;
}): { readonly ok: true } | { readonly ok: false; readonly error: WalletCallbackFailure } {
  const envelope = input.envelope;
  try {
    assertNoSensitiveCardData(envelope.payload, 'wallet.callback.payload');
  } catch (error) {
    return {
      ok: false,
      error: {
        code: 'CALLBACK_SCHEMA_INVALID',
        message: error instanceof Error ? error.message : 'sensitive fields forbidden',
      },
    };
  }
  if (envelope.providerId !== input.expectedProviderId) {
    return { ok: false, error: { code: 'CALLBACK_UNAUTHENTICATED', message: 'provider id mismatch' } };
  }
  if (envelope.schemaVersion !== 1) {
    return { ok: false, error: { code: 'CALLBACK_SCHEMA_INVALID', message: 'unsupported callback schema' } };
  }
  if (!envelope.idempotencyKey || !envelope.nonce) {
    return { ok: false, error: { code: 'CALLBACK_SCHEMA_INVALID', message: 'idempotency key and nonce are required' } };
  }
  const skew = input.nowMs > envelope.timestampMs ? input.nowMs - envelope.timestampMs : envelope.timestampMs - input.nowMs;
  if (skew > WALLET_CALLBACK_MAX_SKEW_MS) {
    return { ok: false, error: { code: 'CALLBACK_EXPIRED', message: 'callback timestamp outside replay window' } };
  }
  const replayKey = `${envelope.providerId}:${envelope.nonce}`;
  if (input.replay.seen(replayKey)) {
    return { ok: false, error: { code: 'CALLBACK_REPLAY', message: 'callback nonce already seen' } };
  }
  const parsed = typeof input.secretRef === 'string' ? parseSecretReference(input.secretRef) : { ok: true as const, value: input.secretRef };
  if (!parsed.ok) {
    return { ok: false, error: { code: 'CALLBACK_UNAUTHENTICATED', message: parsed.error.message } };
  }
  const secret = input.secrets.resolve(parsed.value);
  if (!secret.ok) {
    return { ok: false, error: { code: 'CALLBACK_UNAUTHENTICATED', message: secret.error.message } };
  }
  const unsigned: Omit<WalletCallbackEnvelope, 'signatureHex'> = {
    providerId: envelope.providerId,
    eventType: envelope.eventType,
    idempotencyKey: envelope.idempotencyKey,
    nonce: envelope.nonce,
    timestampMs: envelope.timestampMs,
    schemaVersion: envelope.schemaVersion,
    payload: envelope.payload,
  };
  if (!verifyHmacSha256Hex(secret.value, canonicalWalletCallbackPayload(unsigned), envelope.signatureHex)) {
    return { ok: false, error: { code: 'CALLBACK_INVALID_SIGNATURE', message: 'wallet signature is invalid' } };
  }
  input.replay.remember(replayKey);
  return { ok: true };
}
