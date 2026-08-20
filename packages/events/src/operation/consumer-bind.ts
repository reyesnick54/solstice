import type { EventId } from '../envelope.ts';
import type { InboxStore } from '../consumer.ts';
import { SimulatedCrash, type CrashPoint } from './types.ts';

export type BusinessEffectLedger = {
  has(effectKey: string): boolean;
  record(effectKey: string): void;
};

export class InMemoryBusinessEffectLedger implements BusinessEffectLedger {
  private readonly keys = new Set<string>();

  has(effectKey: string): boolean {
    return this.keys.has(effectKey);
  }

  record(effectKey: string): void {
    this.keys.add(effectKey);
  }
}

/**
 * Where a local effect cannot share a database transaction with
 * inbox.complete(), the effect itself must carry a business idempotency key.
 * Restart after a crash between effect and complete() must not re-apply.
 */
export async function applyIdempotentConsumerEffect(input: {
  readonly inbox: InboxStore;
  readonly consumerId: string;
  readonly eventId: EventId;
  readonly now: string;
  readonly effectKey: string;
  readonly effects: BusinessEffectLedger;
  readonly effect: () => void | Promise<void>;
  readonly crashAt?: CrashPoint;
}): Promise<'applied' | 'duplicate'> {
  if (input.effects.has(input.effectKey)) {
    await input.inbox.complete(input.consumerId, input.eventId, input.now);
    return 'duplicate';
  }
  const begun = await input.inbox.tryBegin(input.consumerId, input.eventId, input.now);
  if (begun === 'duplicate') {
    return 'duplicate';
  }
  await input.effect();
  input.effects.record(input.effectKey);
  if (input.crashAt === 'AFTER_CONSUMER_EFFECT_BEFORE_INBOX') {
    throw new SimulatedCrash('AFTER_CONSUMER_EFFECT_BEFORE_INBOX');
  }
  await input.inbox.complete(input.consumerId, input.eventId, input.now);
  return 'applied';
}

export type BoundInboxTransaction = {
  applyEffectAndComplete(input: {
    readonly consumerId: string;
    readonly eventId: EventId;
    readonly now: string;
    readonly effectKey: string;
    readonly effect: () => void;
  }): 'applied' | 'duplicate';
};

/**
 * In-memory stand-in for a single local transaction that writes the
 * business effect and inbox completion together.
 */
export function createBoundInboxTransaction(
  inbox: InboxStore,
  effects: BusinessEffectLedger,
): BoundInboxTransaction {
  return {
    applyEffectAndComplete(input) {
      if (effects.has(input.effectKey)) {
        void inbox.complete(input.consumerId, input.eventId, input.now);
        return 'duplicate';
      }
      effects.record(input.effectKey);
      input.effect();
      void inbox.complete(input.consumerId, input.eventId, input.now);
      return 'applied';
    },
  };
}
