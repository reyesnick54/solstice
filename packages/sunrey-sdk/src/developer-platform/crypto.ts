import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const WEBHOOK_SIGNING_SCHEME = 'sunrey-webhook-v1' as const;

export function sha256Hex(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

export function hmacSha256Hex(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function randomSecret(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function secretHint(secret: string): string {
  return `…${secret.slice(-4)}`;
}

export function hashSecret(secret: string): string {
  return sha256Hex(`sunrey.developer.secret.v1:${secret}`);
}

export function secretsEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

export function hashesEqual(left: string, right: string): boolean {
  return secretsEqual(left, right);
}

export function webhookSigningPayload(input: {
  readonly deliveryId: string;
  readonly eventId: string;
  readonly timestamp: string;
  readonly attempt: number;
  readonly body: string;
}): string {
  const bodyHash = sha256Hex(input.body);
  return `${WEBHOOK_SIGNING_SCHEME}.${input.deliveryId}.${input.eventId}.${input.timestamp}.${input.attempt}.${bodyHash}`;
}

export function signWebhookDelivery(
  secret: string,
  input: {
    readonly deliveryId: string;
    readonly eventId: string;
    readonly timestamp: string;
    readonly attempt: number;
    readonly body: string;
  },
): { readonly signature: string; readonly bodyHash: string } {
  const payload = webhookSigningPayload(input);
  return {
    signature: `${WEBHOOK_SIGNING_SCHEME}=${hmacSha256Hex(secret, payload)}`,
    bodyHash: sha256Hex(input.body),
  };
}

export function verifyWebhookSignature(input: {
  readonly secret: string;
  readonly deliveryId: string;
  readonly eventId: string;
  readonly timestamp: string;
  readonly attempt: number;
  readonly body: string;
  readonly signature: string;
  readonly nowMs?: number;
  readonly maxSkewMs?: number;
  readonly seenDeliveryIds?: ReadonlySet<string>;
}):
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'INVALID_SIGNATURE' | 'REPLAY' | 'TIMESTAMP_SKEW' | 'SCHEME' } {
  if (!input.signature.startsWith(`${WEBHOOK_SIGNING_SCHEME}=`)) {
    return { ok: false, reason: 'SCHEME' };
  }
  const expected = signWebhookDelivery(input.secret, input).signature;
  if (!hashesEqual(expected, input.signature)) {
    return { ok: false, reason: 'INVALID_SIGNATURE' };
  }
  const nowMs = input.nowMs ?? Date.now();
  const eventMs = Date.parse(input.timestamp);
  const maxSkew = input.maxSkewMs ?? 5 * 60_000;
  if (!Number.isFinite(eventMs) || Math.abs(nowMs - eventMs) > maxSkew) {
    return { ok: false, reason: 'TIMESTAMP_SKEW' };
  }
  if (input.seenDeliveryIds?.has(input.deliveryId)) {
    return { ok: false, reason: 'REPLAY' };
  }
  return { ok: true };
}
