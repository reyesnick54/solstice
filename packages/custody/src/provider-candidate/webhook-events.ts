/**
 * Normalized custody webhook events. Provider signatures must be
 * verified before any mutation.
 */

import { verifyAuthenticCallback, type CustodyProviderCallback } from './callbacks.ts';
import { candidateErr, candidateOk, type CustodyCandidateResult } from './types.ts';

export const CUSTODY_WEBHOOK_KINDS = [
  'deposit',
  'withdrawal',
  'transaction',
  'wallet',
  'policy',
  'signing',
  'security',
] as const;
export type CustodyWebhookKind = (typeof CUSTODY_WEBHOOK_KINDS)[number];

export type NormalizedCustodyWebhook = {
  readonly eventId: string;
  readonly kind: CustodyWebhookKind;
  readonly providerId: string;
  readonly signatureVerified: true;
  readonly replay: boolean;
  readonly mutatesBeforeVerify: false;
  readonly payloadDigest: string;
};

const seenWebhookEvents = new Set<string>();

export function ingestCustodyWebhook(input: {
  readonly eventId: string;
  readonly kind: CustodyWebhookKind;
  readonly providerId: string;
  readonly callback: CustodyProviderCallback;
  readonly hmacSecret: string;
}): CustodyCandidateResult<NormalizedCustodyWebhook> {
  const verified = verifyAuthenticCallback(input.callback, input.hmacSecret);
  if (!verified.ok) {
    return verified;
  }
  const replay = seenWebhookEvents.has(input.eventId);
  if (replay) {
    return candidateErr('WEBHOOK_REPLAY', 'duplicate custody webhook rejected');
  }
  seenWebhookEvents.add(input.eventId);
  return candidateOk(
    Object.freeze({
      eventId: input.eventId,
      kind: input.kind,
      providerId: input.providerId,
      signatureVerified: true,
      replay: false,
      mutatesBeforeVerify: false,
      payloadDigest: input.callback.material,
    }),
  );
}

export function resetCustodyWebhooks(): void {
  seenWebhookEvents.clear();
}
