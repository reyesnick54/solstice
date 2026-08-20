import { createHash } from 'node:crypto';

import { applyOperationTransition } from './transitions.ts';
import type { OperationExecutionRecord, OperationState } from './types.ts';

export type CallbackIdentity = {
  readonly providerId: string;
  readonly providerEventId: string;
  readonly payloadDigest: string;
  readonly businessReference: string;
};

export type CallbackObservation = CallbackIdentity & {
  readonly observedState: OperationState;
  readonly providerOperationRef?: string | null;
  readonly authoritative: boolean;
};

export type CallbackRecord = CallbackIdentity & {
  readonly firstSeenAt: string;
  readonly applied: boolean;
};

export function callbackIdentityKey(identity: CallbackIdentity): string {
  return [
    identity.providerId,
    identity.providerEventId,
    identity.payloadDigest,
    identity.businessReference,
  ].join('::');
}

export function digestCallbackPayload(safeCanonical: string): string {
  return createHash('sha256').update(safeCanonical, 'utf8').digest('hex');
}

export class CallbackReplayLedger {
  private readonly seen = new Map<string, CallbackRecord>();

  ingest(identity: CallbackIdentity, now: string): { readonly duplicate: boolean; readonly record: CallbackRecord } {
    const key = callbackIdentityKey(identity);
    const existing = this.seen.get(key);
    if (existing) {
      return { duplicate: true, record: existing };
    }
    const record: CallbackRecord = Object.freeze({
      ...identity,
      firstSeenAt: now,
      applied: true,
    });
    this.seen.set(key, record);
    return { duplicate: false, record };
  }

  wasSeen(identity: CallbackIdentity): boolean {
    return this.seen.has(callbackIdentityKey(identity));
  }
}

/**
 * A finalized authoritative callback wins over a later, less authoritative
 * submission response. Late PENDING/SUBMITTED must not downgrade CONFIRMED.
 */
export function applyCallbackOrResponse(
  record: OperationExecutionRecord,
  observation: CallbackObservation,
  now: string,
): { readonly record: OperationExecutionRecord; readonly applied: boolean; readonly reason: string } {
  if (!observation.authoritative && record.state === 'CONFIRMED') {
    return { record, applied: false, reason: 'AUTHORITATIVE_CALLBACK_ALREADY_FINAL' };
  }
  return applyOperationTransition(record, observation.observedState, now, {
    providerOperationRef: observation.providerOperationRef ?? record.providerOperationRef,
    confirmedAt: observation.observedState === 'CONFIRMED' ? now : record.confirmedAt,
  });
}
