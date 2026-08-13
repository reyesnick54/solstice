import { Money } from '@solstice/domain';
import { LIVE_FLAGS } from '@solstice/kernel';
import {
  assertSimulatedRail,
  EU_COUNTRIES,
  refusedExecution,
  type PaymentRail,
  type RailExecution,
  type RailInstruction,
  type RailQuote,
  type RailStatus,
} from './types.ts';

const INSTANT_COUNTRIES = new Set(['US', 'GB', ...EU_COUNTRIES]);

/**
 * Instant payment. Seconds, higher fee, high liquidity, selected corridors.
 */
export class InstantRail implements PaymentRail {
  readonly id = 'instant' as const;
  readonly #status = new Map<string, RailStatus>();
  #seq = 0;

  quote(instruction: RailInstruction): RailQuote {
    assertSimulatedRail();
    if (LIVE_FLAGS.LIVE_INSTANT !== false) {
      throw new Error('LIVE_INSTANT must stay false');
    }
    const available =
      INSTANT_COUNTRIES.has(instruction.sourceCountry) &&
      INSTANT_COUNTRIES.has(instruction.destinationCountry) &&
      instruction.amount.minorUnits <= 10_000_00n;
    return Object.freeze({
      railId: this.id,
      fee: Money.of(150n, instruction.amount.currency),
      settlementMs: 10_000n,
      liquidity: 'HIGH',
      available,
      ...(available
        ? {}
        : { unavailabilityReason: 'instant rail is capped and corridor-limited' }),
    });
  }

  validate(instruction: RailInstruction): { readonly ok: boolean; readonly reason?: string } {
    const quoted = this.quote(instruction);
    if (!quoted.available) {
      return quoted.unavailabilityReason === undefined
        ? { ok: false }
        : { ok: false, reason: quoted.unavailabilityReason };
    }
    return { ok: true };
  }

  execute(instruction: RailInstruction): RailExecution {
    const valid = this.validate(instruction);
    if (!valid.ok) {
      return refusedExecution(this.id, valid.reason);
    }
    this.#seq += 1;
    const railReference = `inst_${instruction.paymentId}_${this.#seq}`;
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
