import type { ExecutionQualityEstimate, ExecutionVenueCandidate, OrderUrgencyLevel, RoutingScorecard } from './types.ts';
import { EXEC05_SCHEMA } from './taxonomy.ts';
import type { RoutingScoreComponentContribution } from './types.ts';

const URGENCY_LATENCY_WEIGHT: Record<OrderUrgencyLevel, number> = {
  LOW: 0.25,
  NORMAL: 0.5,
  HIGH: 1.0,
  IMMEDIATE: 2.0,
};

function healthPenalty(state: ExecutionVenueCandidate['venueHealth'] | ExecutionVenueCandidate['providerHealth']): number {
  switch (state) {
    case 'HEALTHY':
      return 0;
    case 'DEGRADED':
      return 25;
    case 'UNAVAILABLE':
      return 10_000;
    default:
      return 10_000;
  }
}

function depthPenalty(depthScore: number): number {
  if (depthScore >= 900) return 0;
  if (depthScore >= 500) return 5;
  if (depthScore >= 100) return 15;
  return 40;
}

function fillProbabilityPenalty(ppm: number): number {
  const clamped = Math.max(0, Math.min(1_000_000, ppm));
  return Math.floor((1_000_000 - clamped) / 10_000);
}

function quantityShortfallPenalty(candidate: ExecutionVenueCandidate, orderSizeMinorUnits: string): number {
  const available = BigInt(candidate.availableQuantityUnits);
  const orderSize = BigInt(orderSizeMinorUnits);
  if (orderSize <= 0n) return 0;
  if (available >= orderSize) return 0;
  const shortfall = orderSize - available;
  const ratioPpm = Number((shortfall * 1_000_000n) / orderSize);
  return Math.min(500, Math.floor(ratioPpm / 2_000));
}

function priceLevelPenalty(candidate: ExecutionVenueCandidate, orderAction: 'BUY' | 'SELL'): number {
  const price = BigInt(candidate.displayedPriceMinorUnits);
  if (price <= 0n) return 200;
  const improvement = candidate.priceImprovementBps;
  const directional = orderAction === 'BUY' ? -improvement : improvement;
  return Math.max(0, -directional);
}

function netFeeBps(feeBps: number, rebateBps: number): number {
  return Math.max(0, feeBps - Math.min(rebateBps, feeBps + 5));
}

function volatilitySlippageAddon(volatilityBps: number, orderSizeMinorUnits: string): number {
  const size = BigInt(orderSizeMinorUnits);
  const sizeFactor = size > 1_000_000_000n ? 2 : size > 100_000_000n ? 1.5 : 1;
  return Math.floor(volatilityBps * 0.1 * sizeFactor);
}

export function buildExecutionQualityEstimate(
  candidate: ExecutionVenueCandidate,
  orderSizeMinorUnits: string,
): ExecutionQualityEstimate {
  const estimatedAllInSpreadBps = candidate.spreadBps + netFeeBps(candidate.feeBps, candidate.rebateBps);
  const expectedImplementationCostBps =
    estimatedAllInSpreadBps +
    candidate.expectedSlippageBps +
    candidate.estimatedMarketImpactBps +
    depthPenalty(candidate.depthScore) +
    fillProbabilityPenalty(candidate.expectedFillProbabilityPpm);
  return Object.freeze({
    candidateId: candidate.candidateId,
    expectedImplementationCostBps,
    expectedFillProbabilityPpm: candidate.expectedFillProbabilityPpm,
    expectedSlippageBps: candidate.expectedSlippageBps,
    estimatedMarketImpactBps: candidate.estimatedMarketImpactBps,
    estimatedAllInSpreadBps,
  });
}

export function buildRoutingScorecard(input: {
  readonly candidate: ExecutionVenueCandidate;
  readonly orderAction: 'BUY' | 'SELL';
  readonly orderSizeMinorUnits: string;
  readonly urgency: OrderUrgencyLevel;
}): RoutingScorecard {
  const { candidate, orderAction, orderSizeMinorUnits, urgency } = input;
  const latencyWeight = URGENCY_LATENCY_WEIGHT[urgency];

  const components: RoutingScoreComponentContribution[] = [
    {
      component: 'DISPLAYED_PRICE',
      contributionBps: priceLevelPenalty(candidate, orderAction),
      rawValue: candidate.displayedPriceMinorUnits,
      notes: 'Displayed quote level; improvement reduces implementation cost.',
    },
    {
      component: 'AVAILABLE_QUANTITY',
      contributionBps: quantityShortfallPenalty(candidate, orderSizeMinorUnits),
      rawValue: candidate.availableQuantityUnits,
      notes: 'Penalty when displayed size is below order size.',
    },
    {
      component: 'SPREAD',
      contributionBps: candidate.spreadBps,
      rawValue: String(candidate.spreadBps),
      notes: 'Quoted spread in basis points.',
    },
    {
      component: 'DEPTH',
      contributionBps: depthPenalty(candidate.depthScore),
      rawValue: String(candidate.depthScore),
      notes: 'Book depth score; shallow books increase cost.',
    },
    {
      component: 'EXPECTED_FILL_PROBABILITY',
      contributionBps: fillProbabilityPenalty(candidate.expectedFillProbabilityPpm),
      rawValue: String(candidate.expectedFillProbabilityPpm),
      notes: 'Lower fill probability increases expected cost.',
    },
    {
      component: 'HISTORICAL_FILL_RATE',
      contributionBps: fillProbabilityPenalty(candidate.historicalFillRatePpm),
      rawValue: String(candidate.historicalFillRatePpm),
      notes: 'Historical venue fill rate informs completion risk.',
    },
    {
      component: 'LATENCY',
      contributionBps: Math.floor((candidate.latencyMs / 10) * latencyWeight),
      rawValue: String(candidate.latencyMs),
      notes: 'Latency penalty scaled by order urgency.',
    },
    {
      component: 'FEES',
      contributionBps: candidate.feeBps,
      rawValue: String(candidate.feeBps),
      notes: 'Explicit fee schedule component.',
    },
    {
      component: 'REBATES',
      contributionBps: -Math.min(candidate.rebateBps, candidate.feeBps + 5),
      rawValue: String(candidate.rebateBps),
      notes: 'Rebate credit capped; cannot dominate venue choice alone.',
    },
    {
      component: 'ESTIMATED_MARKET_IMPACT',
      contributionBps: candidate.estimatedMarketImpactBps,
      rawValue: String(candidate.estimatedMarketImpactBps),
      notes: 'Size-aware market impact estimate.',
    },
    {
      component: 'EXPECTED_SLIPPAGE',
      contributionBps: candidate.expectedSlippageBps,
      rawValue: String(candidate.expectedSlippageBps),
      notes: 'Expected slippage versus displayed price.',
    },
    {
      component: 'PRICE_IMPROVEMENT',
      contributionBps: priceLevelPenalty(candidate, orderAction),
      rawValue: String(candidate.priceImprovementBps),
      notes: 'Price improvement reduces cost for the action direction.',
    },
    {
      component: 'ORDER_SIZE',
      contributionBps: volatilitySlippageAddon(candidate.volatilityBps, orderSizeMinorUnits),
      rawValue: orderSizeMinorUnits,
      notes: 'Larger orders add volatility-sensitive cost.',
    },
    {
      component: 'URGENCY',
      contributionBps: Math.floor(latencyWeight * 2),
      rawValue: urgency,
      notes: 'Urgency shifts latency vs price trade-off.',
    },
    {
      component: 'VOLATILITY',
      contributionBps: Math.floor(candidate.volatilityBps * 0.05),
      rawValue: String(candidate.volatilityBps),
      notes: 'Elevated volatility increases expected implementation cost.',
    },
    {
      component: 'VENUE_HEALTH',
      contributionBps: healthPenalty(candidate.venueHealth),
      rawValue: candidate.venueHealth,
      notes: 'Unhealthy venues penalized or excluded.',
    },
    {
      component: 'PROVIDER_HEALTH',
      contributionBps: healthPenalty(candidate.providerHealth),
      rawValue: candidate.providerHealth,
      notes: 'Provider health affects route reliability.',
    },
  ];

  const expectedImplementationCostBps = components.reduce((sum, row) => sum + row.contributionBps, 0);

  return Object.freeze({
    schema: EXEC05_SCHEMA,
    candidateId: candidate.candidateId,
    components: Object.freeze(components),
    expectedImplementationCostBps,
    transparencyNote: 'COMPONENTS_ONLY_NO_ML_BLEND',
  });
}
