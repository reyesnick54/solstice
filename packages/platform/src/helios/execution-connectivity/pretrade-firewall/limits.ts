import type { CreditCapitalLimitVector } from './types.ts';

function minBigint(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}

export type EffectiveLimitDerivation = {
  readonly effective: CreditCapitalLimitVector;
  readonly limitingSource: 'SUNREY' | 'BROKER' | 'BOTH' | 'NONE';
  readonly sunreyBoundDimensions: readonly string[];
  readonly brokerBoundDimensions: readonly string[];
};

/**
 * Effective credit/capital envelope = most restrictive applicable constraint across
 * SunRey internal limits and broker-supplied limits.
 */
export function deriveEffectiveCreditCapitalLimits(input: {
  readonly sunrey: CreditCapitalLimitVector;
  readonly broker: CreditCapitalLimitVector | null;
}): EffectiveLimitDerivation {
  const broker = input.broker;
  if (!broker) {
    return Object.freeze({
      effective: input.sunrey,
      limitingSource: 'SUNREY',
      sunreyBoundDimensions: Object.freeze([
        'maxOrderNotionalMinor',
        'maxOrderQuantity',
        'maxParticipationRateBps',
        'availableBuyingPowerMinor',
      ]),
      brokerBoundDimensions: Object.freeze([]),
    });
  }

  const sunreyDims: string[] = [];
  const brokerDims: string[] = [];

  const maxOrderNotionalMinor = (() => {
    const v = minBigint(input.sunrey.maxOrderNotionalMinor, broker.maxOrderNotionalMinor);
    if (v === input.sunrey.maxOrderNotionalMinor) sunreyDims.push('maxOrderNotionalMinor');
    if (v === broker.maxOrderNotionalMinor) brokerDims.push('maxOrderNotionalMinor');
    if (
      input.sunrey.maxOrderNotionalMinor === broker.maxOrderNotionalMinor &&
      input.sunrey.maxOrderNotionalMinor === v
    ) {
      sunreyDims.push('maxOrderNotionalMinor');
      brokerDims.push('maxOrderNotionalMinor');
    }
    return v;
  })();

  const maxOrderQuantity = (() => {
    const v = minBigint(input.sunrey.maxOrderQuantity, broker.maxOrderQuantity);
    if (v === input.sunrey.maxOrderQuantity) sunreyDims.push('maxOrderQuantity');
    if (v === broker.maxOrderQuantity) brokerDims.push('maxOrderQuantity');
    if (input.sunrey.maxOrderQuantity === broker.maxOrderQuantity && input.sunrey.maxOrderQuantity === v) {
      sunreyDims.push('maxOrderQuantity');
      brokerDims.push('maxOrderQuantity');
    }
    return v;
  })();

  const maxParticipationRateBps = (() => {
    const v = minBigint(input.sunrey.maxParticipationRateBps, broker.maxParticipationRateBps);
    if (v === input.sunrey.maxParticipationRateBps) sunreyDims.push('maxParticipationRateBps');
    if (v === broker.maxParticipationRateBps) brokerDims.push('maxParticipationRateBps');
    if (
      input.sunrey.maxParticipationRateBps === broker.maxParticipationRateBps &&
      input.sunrey.maxParticipationRateBps === v
    ) {
      sunreyDims.push('maxParticipationRateBps');
      brokerDims.push('maxParticipationRateBps');
    }
    return v;
  })();

  const availableBuyingPowerMinor = (() => {
    const v = minBigint(input.sunrey.availableBuyingPowerMinor, broker.availableBuyingPowerMinor);
    if (v === input.sunrey.availableBuyingPowerMinor) sunreyDims.push('availableBuyingPowerMinor');
    if (v === broker.availableBuyingPowerMinor) brokerDims.push('availableBuyingPowerMinor');
    if (
      input.sunrey.availableBuyingPowerMinor === broker.availableBuyingPowerMinor &&
      input.sunrey.availableBuyingPowerMinor === v
    ) {
      sunreyDims.push('availableBuyingPowerMinor');
      brokerDims.push('availableBuyingPowerMinor');
    }
    return v;
  })();

  const effective: CreditCapitalLimitVector = Object.freeze({
    maxOrderNotionalMinor,
    maxOrderQuantity,
    maxParticipationRateBps,
    availableBuyingPowerMinor,
  });

  let limitingSource: EffectiveLimitDerivation['limitingSource'] = 'NONE';
  if (sunreyDims.length > 0 && brokerDims.length > 0) {
    limitingSource = 'BOTH';
  } else if (brokerDims.length > 0) {
    limitingSource = 'BROKER';
  } else if (sunreyDims.length > 0) {
    limitingSource = 'SUNREY';
  }

  return Object.freeze({
    effective,
    limitingSource,
    sunreyBoundDimensions: Object.freeze(sunreyDims),
    brokerBoundDimensions: Object.freeze(brokerDims),
  });
}

export function priceWithinCollarBps(
  limitPriceMinor: bigint,
  referencePriceMinor: bigint,
  collarBps: bigint,
): boolean {
  if (referencePriceMinor <= 0n) {
    return false;
  }
  const deviationBps = ((limitPriceMinor - referencePriceMinor) * 10_000n) / referencePriceMinor;
  const magnitude = deviationBps < 0n ? -deviationBps : deviationBps;
  return magnitude <= collarBps;
}

export function fatFingerDeviationBps(limitPriceMinor: bigint, referencePriceMinor: bigint): bigint {
  if (referencePriceMinor <= 0n) {
    return 100_000n;
  }
  const deviationBps = ((limitPriceMinor - referencePriceMinor) * 10_000n) / referencePriceMinor;
  return deviationBps < 0n ? -deviationBps : deviationBps;
}
