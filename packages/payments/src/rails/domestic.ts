import { Money } from '@solstice/domain';
import {
  assertSimulatedRail,
  refusedExecution,
  sameCountry,
  type PaymentRail,
  type RailExecution,
  type RailInstruction,
  type RailQuote,
  type RailStatus,
} from './types.ts';
import { LIVE_FLAGS } from '@solstice/kernel';

/**
 * Local domestic rail (ACH/FPS-like). Cheap, next-day, high liquidity,
 * same-country only.
 */
export class DomesticRail implements PaymentRail {
  readonly id = 'domestic' as const;
  readonly #status = new Map<string, RailStatus>();
  #seq = 0;

  quote(instruction: RailInstruction): RailQuote {
    assertSimulatedRail();
    if (LIVE_FLAGS.LIVE_DOMESTIC !== false) {
      throw new Error('LIVE_DOMESTIC must stay false');
    }
    const available = sameCountry(instruction);
    return Object.freeze({
      railId: this.id,
      fee: Money.of(20n, instruction.amount.currency),
      settlementMs: 86_400_000n,
      liquidity: 'HIGH',
      available,
      ...(available ? {} : { unavailabilityReason: 'domestic rail is same-country only' }),
    });
  }

  validate(instruction: RailInstruction): { readonly ok: boolean; readonly reason?: string } {
    if (!sameCountry(instruction)) {
      return { ok: false, reason: 'domestic rail is same-country only' };
    }
    return { ok: true };
  }

  execute(instruction: RailInstruction): RailExecution {
    const valid = this.validate(instruction);
    if (!valid.ok) {
      return refusedExecution(this.id, valid.reason);
    }
    this.#seq += 1;
    const railReference = `dom_${instruction.paymentId}_${this.#seq}`;
    this.#status.set(railReference, {
      railId: this.id,
      railReference,
      state: 'ACCEPTED',
    });
    return { railId: this.id, railReference, accepted: true };
  }

  getStatus(railReference: string): RailStatus | undefined {
    return this.#status.get(railReference);
  }

  settle(railReference: string): void {
    const current = this.#status.get(railReference);
    if (current) {
      this.#status.set(railReference, { ...current, state: 'SETTLED' });
    }
  }

  fail(railReference: string): void {
    const current = this.#status.get(railReference);
    if (current) {
      this.#status.set(railReference, { ...current, state: 'FAILED' });
    }
  }
}
