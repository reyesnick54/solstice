import type { StrategyLiquidityLeg } from './types.ts';
import type { LiquidityCapacityEnvelope } from './types.ts';

function parseMinor(value: string): bigint {
  return BigInt(value);
}

function minBigint(rows: readonly bigint[]): bigint {
  return rows.reduce((acc, row) => (row < acc ? row : acc), rows[0] ?? 0n);
}

/**
 * Portfolio liquidity envelope — concentration, per-name, venue, and binding constraint.
 */
export function buildLiquidityCapacityEnvelope(
  legs: readonly StrategyLiquidityLeg[],
  executionDurationHours: number,
): LiquidityCapacityEnvelope {
  if (legs.length === 0) {
    return Object.freeze({
      liquidityConcentrationHhi: 1,
      topLegWeightBps: 10_000,
      singleNameCapacityMinor: '0',
      portfolioCapacityMinor: '0',
      venueCapacityMinor: '0',
      bindingConstraint: 'DEPTH',
    });
  }

  const weights = legs.map((leg) => leg.weightBps / 10_000);
  const hhi = weights.reduce((sum, w) => sum + w * w, 0);
  const topLegWeightBps = Math.max(...legs.map((leg) => leg.weightBps));

  const durationFactor = Math.max(0.05, Math.min(1, executionDurationHours / 6.5));

  const perNameCaps = legs.map((leg) => {
    const adv = parseMinor(leg.advNotionalMinor);
    const depth = parseMinor(leg.marketDepthNotionalMinor);
    const maxPart = BigInt(leg.maxParticipationRateBps);
    const advBound = (adv * maxPart) / 10_000n;
    const depthBound = (depth * 8n) / 10n;
    return minBigint([advBound, depthBound].filter((row) => row > 0n));
  });

  const singleNameCapacity = perNameCaps.length > 0 ? minBigint(perNameCaps) : 0n;

  let portfolioCapacity = 0n;
  for (let i = 0; i < legs.length; i += 1) {
    const leg = legs[i]!;
    const weight = leg.weightBps;
    if (weight <= 0) {
      continue;
    }
    const legCap = (perNameCaps[i] ?? 0n) * 10_000n / BigInt(weight);
    portfolioCapacity += legCap;
  }

  const venueAdv = new Map<string, bigint>();
  for (const leg of legs) {
    const prior = venueAdv.get(leg.venueId) ?? 0n;
    venueAdv.set(leg.venueId, prior + parseMinor(leg.venueAdvNotionalMinor));
  }
  const venueCaps = [...venueAdv.entries()].map(([venueId, adv]) => {
    void venueId;
    const legOnVenue = legs.filter((row) => row.venueId === venueId);
    const maxPart = legOnVenue.reduce(
      (acc, row) => (row.maxParticipationRateBps < acc ? row.maxParticipationRateBps : acc),
      10_000,
    );
    return (adv * BigInt(maxPart) * BigInt(Math.round(durationFactor * 10_000))) / 100_000_000n;
  });
  const venueCapacity = venueCaps.length > 0 ? minBigint(venueCaps) : 0n;

  const portfolioVsVenue = portfolioCapacity < venueCapacity ? portfolioCapacity : venueCapacity;
  const binding: LiquidityCapacityEnvelope['bindingConstraint'] =
    singleNameCapacity <= portfolioVsVenue && singleNameCapacity <= venueCapacity
      ? 'SINGLE_NAME'
      : portfolioCapacity <= venueCapacity
        ? 'PORTFOLIO'
        : 'VENUE';

  return Object.freeze({
    liquidityConcentrationHhi: Math.round(hhi * 10_000) / 10_000,
    topLegWeightBps,
    singleNameCapacityMinor: singleNameCapacity.toString(),
    portfolioCapacityMinor: portfolioCapacity.toString(),
    venueCapacityMinor: venueCapacity.toString(),
    bindingConstraint: binding,
  });
}

export function effectiveParticipationRate(
  deployedMinor: bigint,
  legs: readonly StrategyLiquidityLeg[],
): number {
  if (deployedMinor <= 0n || legs.length === 0) {
    return 0;
  }
  let weighted = 0;
  let totalWeight = 0;
  for (const leg of legs) {
    const adv = parseMinor(leg.advNotionalMinor);
    if (adv <= 0n) {
      continue;
    }
    const legDeployment = (deployedMinor * BigInt(leg.weightBps)) / 10_000n;
    const part = Number(legDeployment) / Number(adv);
    weighted += part * leg.weightBps;
    totalWeight += leg.weightBps;
  }
  if (totalWeight === 0) {
    return 0;
  }
  return weighted / totalWeight;
}

export function liquidityPermitsScale(
  deployedMinor: bigint,
  envelope: LiquidityCapacityEnvelope,
): boolean {
  const single = parseMinor(envelope.singleNameCapacityMinor);
  const portfolio = parseMinor(envelope.portfolioCapacityMinor);
  const venue = parseMinor(envelope.venueCapacityMinor);
  const caps = [single, portfolio, venue].filter((row) => row > 0n);
  if (caps.length === 0) {
    return false;
  }
  const maxCap = caps.reduce((acc, row) => (row > acc ? row : acc), 0n);
  return deployedMinor <= maxCap;
}
