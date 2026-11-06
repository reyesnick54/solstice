/**
 * Observed conglomerate discount — never auto-applied to fundamental SOTP.
 */

import type { ObservedConglomerateDiscountState } from './types.ts';
import type { UtcInstant } from '@solstice/domain';

const BPS = 10_000;

export function computeObservedConglomerateDiscountState(input: {
  readonly peerSetRef: string | null;
  readonly marketCapMinor: bigint | null;
  readonly sumOfPartsMinor: bigint;
  readonly asOfKnowableAt: UtcInstant | null;
}): ObservedConglomerateDiscountState {
  const { marketCapMinor, sumOfPartsMinor } = input;
  if (marketCapMinor === null || sumOfPartsMinor <= 0n) {
    return Object.freeze({
      observed: false,
      discountBps: null,
      peerSetRef: input.peerSetRef,
      marketCapMinor,
      sumOfPartsMinor,
      asOfKnowableAt: input.asOfKnowableAt,
      notAppliedToIntrinsic: true,
      researchOnly: true,
    });
  }

  const gap = Number(sumOfPartsMinor - marketCapMinor);
  const discountBps = Math.round((gap / Number(sumOfPartsMinor)) * BPS);

  return Object.freeze({
    observed: true,
    discountBps,
    peerSetRef: input.peerSetRef,
    marketCapMinor,
    sumOfPartsMinor,
    asOfKnowableAt: input.asOfKnowableAt,
    notAppliedToIntrinsic: true,
    researchOnly: true,
  });
}

export function emptyObservedConglomerateDiscountState(): ObservedConglomerateDiscountState {
  return Object.freeze({
    observed: false,
    discountBps: null,
    peerSetRef: null,
    marketCapMinor: null,
    sumOfPartsMinor: null,
    asOfKnowableAt: null,
    notAppliedToIntrinsic: true,
    researchOnly: true,
  });
}
