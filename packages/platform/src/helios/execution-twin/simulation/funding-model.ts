/**
 * HELIOS OS03 — perpetual funding simulation (research-only).
 */

import type { UtcInstant } from '@solstice/domain';

import type { FundingEvent, PerpetualInstrumentSpec } from './types.ts';

export type FundingAccrual = {
  readonly event: FundingEvent;
  readonly positionUnits: bigint;
  readonly paymentMinorUnits: bigint;
  readonly direction: 'PAY' | 'RECEIVE';
};

export function computeFundingPayment(input: {
  readonly spec: PerpetualInstrumentSpec;
  readonly event: FundingEvent;
  readonly positionUnits: bigint;
}): FundingAccrual {
  const notional = absBig(input.positionUnits) * input.event.indexPriceMinorUnits * input.spec.contractMultiplierMinorUnits;
  const scaled = notional / BigInt(10 ** input.spec.multiplierScale);
  const payment = (scaled * BigInt(Math.abs(input.event.fundingRateBps))) / 10_000n;
  const longPays = input.event.fundingRateBps > 0;
  const isLong = input.positionUnits > 0n;
  const pay =
    (longPays && isLong) || (!longPays && !isLong && input.positionUnits !== 0n)
      ? payment
      : 0n;
  const receive = payment - pay;
  return Object.freeze({
    event: input.event,
    positionUnits: input.positionUnits,
    paymentMinorUnits: pay > 0n ? pay : receive,
    direction: pay > 0n ? 'PAY' : 'RECEIVE',
  });
}

function absBig(value: bigint): bigint {
  return value < 0n ? -value : value;
}

export function fundingEvent(
  eventId: string,
  instrumentId: string,
  effectiveAt: UtcInstant,
  fundingRateBps: number,
  indexPriceMinorUnits: bigint,
  currency: string,
): FundingEvent {
  return Object.freeze({
    eventId,
    instrumentId,
    effectiveAt,
    fundingRateBps,
    indexPriceMinorUnits,
    currency,
  });
}
