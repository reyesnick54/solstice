import { Money } from '@solstice/domain';
import { LIVE_FLAGS } from '@solstice/kernel';
import {
  assertSimulatedRail,
  refusedExecution,
  type PaymentRail,
  type RailExecution,
  type RailInstruction,
  type RailQuote,
  type RailStatus,
} from './types.ts';

/**
 * SWIFT-like correspondent. Global, expensive, T+3, medium liquidity.
 */
export class SwiftLikeRail implements PaymentRail {
  readonly id = 'swift_like' as const;
  readonly #status = new Map<string, RailStatus>();
  #seq = 0;

  quote(instruction: RailInstruction): RailQuote {
    assertSimulatedRail();
    if (LIVE_FLAGS.LIVE_SWIFT !== false) {
      throw new Error('LIVE_SWIFT must stay false');
    }
    const blocked = ['IR', 'KP', 'SY', 'CU'].includes(instruction.destinationCountry);
    const available = !blocked;
    const bps = instruction.amount.minorUnits / 1000n;
    const fee = Money.of(2500n + bps, instruction.amount.currency);
    return Object.freeze({
      railId: this.id,
      fee,
      settlementMs: 259_200_000n,
      liquidity: 'MEDIUM',
      available,
      ...(available ? {} : { unavailabilityReason: 'SWIFT-like rail does not serve this destination' }),
    });
  }

  validate(instruction: RailInstruction): { readonly ok: boolean; readonly reason?: string } {
    const quoted = this.quote(instruction);
    if (!quoted.available) {
      return quoted.unavailabilityReason === undefined
        ? { ok: false }
        : { ok: false, reason: quoted.unavailabilityReason };
    }
    if (!instruction.creditorBic && !instruction.creditorIban) {
      return { ok: false, reason: 'SWIFT-like rail requires BIC or IBAN' };
    }
    return { ok: true };
  }

  execute(instruction: RailInstruction): RailExecution {
    const valid = this.validate(instruction);
    if (!valid.ok) {
      return refusedExecution(this.id, valid.reason);
    }
    this.#seq += 1;
    const railReference = `swift_${instruction.paymentId}_${this.#seq}`;
    this.#status.set(railReference, { railId: this.id, railReference, state: 'ACCEPTED' });
    return { railId: this.id, railReference, accepted: true };
  }

  getStatus(railReference: string): RailStatus | undefined {
    return this.#status.get(railReference);
  }

  settle(railReference: string): void {
    const current = this.#status.get(railReference);
    if (current) this.#status.set(railReference, { ...current, state: 'SETTLED' });
  }

  fail(railReference: string): void {
    const current = this.#status.get(railReference);
    if (current) this.#status.set(railReference, { ...current, state: 'FAILED' });
  }
}
