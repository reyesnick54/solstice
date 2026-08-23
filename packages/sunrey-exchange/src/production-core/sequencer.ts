import type { OrderId } from '../ids.ts';
import type { ProductizedOrderState } from './order-lifecycle.ts';
import { canTransitionOrder, isTerminalOrderState } from './order-lifecycle.ts';

export type SequencedIntent =
  | { readonly kind: 'FILL'; readonly orderId: OrderId | string; readonly sequence: number; readonly fillUnits: bigint }
  | { readonly kind: 'CANCEL'; readonly orderId: OrderId | string; readonly sequence: number };

export type RaceResolution = {
  readonly state: ProductizedOrderState;
  readonly filledUnits: bigint;
  readonly cancelled: boolean;
  readonly releasedUnits: bigint;
  readonly overRelease: false;
};

/**
 * Deterministic cancel/fill race. The lower sequence wins the first
 * mutation. A fill that already consumed quantity cannot be un-filled
 * by a later cancel. Cancel never releases more than remaining units.
 */
export function resolveCancelFillRace(input: {
  readonly state: ProductizedOrderState;
  readonly remainingUnits: bigint;
  readonly originalUnits: bigint;
  readonly events: readonly SequencedIntent[];
}): RaceResolution {
  let state = input.state;
  let remaining = input.remainingUnits;
  let cancelled = false;
  const ordered = [...input.events].sort((a, b) => a.sequence - b.sequence);
  for (const event of ordered) {
    if (isTerminalOrderState(state) && state !== 'CANCEL_PENDING') {
      break;
    }
    if (event.kind === 'FILL') {
      if (state === 'CANCELLED') {
        continue;
      }
      const take = event.fillUnits < remaining ? event.fillUnits : remaining;
      remaining -= take;
      if (remaining === 0n) {
        state = canTransitionOrder(state === 'CANCEL_PENDING' ? 'CANCEL_PENDING' : state, 'FILLED')
          ? 'FILLED'
          : 'FILLED';
      } else if (canTransitionOrder(state, 'PARTIALLY_FILLED') || state === 'PARTIALLY_FILLED' || state === 'CANCEL_PENDING') {
        state = state === 'CANCEL_PENDING' && remaining > 0n ? 'CANCEL_PENDING' : 'PARTIALLY_FILLED';
      }
    } else if (event.kind === 'CANCEL') {
      if (state === 'FILLED') {
        continue;
      }
      if (canTransitionOrder(state, 'CANCEL_PENDING') && remaining > 0n && !cancelled) {
        state = remaining === input.originalUnits && state === 'OPEN' ? 'CANCELLED' : 'CANCEL_PENDING';
      }
      cancelled = true;
      if (remaining === 0n) {
        state = 'FILLED';
      } else if (state === 'CANCEL_PENDING' || state === 'OPEN' || state === 'PARTIALLY_FILLED') {
        state = 'CANCELLED';
      }
    }
  }
  const filledUnits = input.originalUnits - remaining;
  return Object.freeze({
    state,
    filledUnits: filledUnits < 0n ? 0n : filledUnits,
    cancelled: state === 'CANCELLED',
    releasedUnits: state === 'CANCELLED' ? remaining : 0n,
    overRelease: false,
  });
}

export class MatchingSequencer {
  private next = 0;
  private readonly inFlight = new Set<string>();
  private readonly pendingCancels = new Set<string>();

  nextSequence(): number {
    this.next += 1;
    return this.next;
  }

  beginMatch(orderId: OrderId | string): number {
    this.inFlight.add(String(orderId));
    return this.nextSequence();
  }

  endMatch(orderId: OrderId | string): boolean {
    this.inFlight.delete(String(orderId));
    return this.pendingCancels.delete(String(orderId));
  }

  requestCancel(orderId: OrderId | string): { readonly deferred: boolean; readonly sequence: number } {
    const sequence = this.nextSequence();
    if (this.inFlight.has(String(orderId))) {
      this.pendingCancels.add(String(orderId));
      return { deferred: true, sequence };
    }
    return { deferred: false, sequence };
  }

  isInFlight(orderId: OrderId | string): boolean {
    return this.inFlight.has(String(orderId));
  }
}
