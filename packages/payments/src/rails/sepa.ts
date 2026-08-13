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

/**
 * SEPA-like credit transfer. EUR in EEA, cheap, T+1, high liquidity.
 */
export class SepaLikeRail implements PaymentRail {
  readonly id = 'sepa_like' as const;
  readonly #status = new Map<string, RailStatus>();
  #seq = 0;

  quote(instruction: RailInstruction): RailQuote {
    assertSimulatedRail();
    if (LIVE_FLAGS.LIVE_SEPA !== false) {
      throw new Error('LIVE_SEPA must stay false');
    }
    const available =
      instruction.currency === 'EUR' &&
      EU_COUNTRIES.has(instruction.destinationCountry) &&
      (EU_COUNTRIES.has(instruction.sourceCountry) || instruction.sourceCountry === 'US');
    return Object.freeze({
      railId: this.id,
      fee: Money.fromDecimalString('0.50', 'EUR'),
      settlementMs: 86_400_000n,
      liquidity: 'HIGH',
      available,
      ...(available
        ? {}
        : { unavailabilityReason: 'SEPA-like rail requires EUR and an EEA destination' }),
    });
  }

  validate(instruction: RailInstruction): { readonly ok: boolean; readonly reason?: string } {
    const quoted = this.quote(instruction);
    if (!quoted.available) {
      return quoted.unavailabilityReason === undefined
        ? { ok: false }
        : { ok: false, reason: quoted.unavailabilityReason };
    }
    if (!instruction.creditorIban) {
      return { ok: false, reason: 'SEPA-like rail requires an IBAN' };
    }
    return { ok: true };
  }

  execute(instruction: RailInstruction): RailExecution {
    const valid = this.validate(instruction);
    if (!valid.ok) {
      return refusedExecution(this.id, valid.reason);
    }
    this.#seq += 1;
    const railReference = `sepa_${instruction.paymentId}_${this.#seq}`;
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
