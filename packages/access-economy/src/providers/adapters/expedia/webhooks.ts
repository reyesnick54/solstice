/**
 * Expedia Rapid webhook signature verification and replay protection.
 *
 * Unknown or unverified events fail closed. Replay protection is mandatory.
 */

import { createHash, timingSafeEqual } from 'node:crypto';
import type { ProviderCredentialPort } from '../../security.ts';
import { EXPEDIA_CREDENTIAL_REFS } from './credentials.ts';

export type ExpediaWebhookHeaders = {
  readonly signature: string | null;
  readonly timestamp: string | null;
  readonly eventId: string | null;
};

export type ExpediaWebhookVerificationResult =
  | { readonly verified: true; readonly eventId: string }
  | { readonly verified: false; readonly reason: string };

const REPLAY_WINDOW_SECONDS = 300;

export class ExpediaWebhookVerifier {
  private readonly seenEventIds = new Set<string>();
  private readonly credentials: ProviderCredentialPort;
  private readonly nowSeconds: () => number;

  constructor(credentials: ProviderCredentialPort, nowSeconds: () => number = () => Math.floor(Date.now() / 1000)) {
    this.credentials = credentials;
    this.nowSeconds = nowSeconds;
  }

  async verify(input: {
    readonly payload: string;
    readonly headers: ExpediaWebhookHeaders;
  }): Promise<ExpediaWebhookVerificationResult> {
    const { signature, timestamp, eventId } = input.headers;
    if (!signature || !timestamp || !eventId) {
      return Object.freeze({ verified: false, reason: 'missing signature, timestamp, or event id' });
    }
    if (this.seenEventIds.has(eventId)) {
      return Object.freeze({ verified: false, reason: 'replay detected' });
    }
    const ts = Number(timestamp);
    if (!Number.isFinite(ts)) {
      return Object.freeze({ verified: false, reason: 'invalid timestamp' });
    }
    const skew = Math.abs(this.nowSeconds() - ts);
    if (skew > REPLAY_WINDOW_SECONDS) {
      return Object.freeze({ verified: false, reason: 'timestamp outside replay window' });
    }
    const signingKey = await this.credentials.getCredential(EXPEDIA_CREDENTIAL_REFS.WEBHOOK_SIGNING_KEY);
    if (!signingKey) {
      return Object.freeze({ verified: false, reason: 'webhook signing key unavailable' });
    }
    const expected = createHash('sha256')
      .update(`${timestamp}.${input.payload}`, 'utf8')
      .update(signingKey, 'utf8')
      .digest('hex');
    const provided = signature.replace(/^sha256=/, '');
    if (!safeEqual(expected, provided)) {
      return Object.freeze({ verified: false, reason: 'signature mismatch' });
    }
    this.seenEventIds.add(eventId);
    return Object.freeze({ verified: true, eventId });
  }
}

function safeEqual(left: string, right: string): boolean {
  const leftBuf = Buffer.from(left, 'utf8');
  const rightBuf = Buffer.from(right, 'utf8');
  if (leftBuf.length !== rightBuf.length) {
    return false;
  }
  return timingSafeEqual(leftBuf, rightBuf);
}
