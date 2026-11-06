import type { BehaviorDescriptors, NicheDescriptor, StrategyNiche } from './types.ts';

const DESC_VERSION = 1 as const;

const DEFAULT_BIN_COUNTS = Object.freeze({
  holdingHorizon: 8,
  turnover: 8,
  trendSensitivity: 4,
  meanReversionSensitivity: 4,
  valuationSensitivity: 4,
  earningsSensitivity: 4,
  macroSensitivity: 4,
  volatilityPreference: 4,
  liquidityRequirement: 4,
  marketBeta: 4,
});

export type DefaultNicheGrid = typeof DEFAULT_BIN_COUNTS;

export { DEFAULT_BIN_COUNTS };

function clampBin(value: number, bins: number): number {
  if (!Number.isFinite(value) || bins <= 1) {
    return 0;
  }
  const max = bins - 1;
  const v = Math.max(0, Math.min(max, Math.floor(value)));
  return v;
}

/**
 * Map a scalar in [min, max] to 0..bins-1. Use for research/simulation axes only.
 */
export function binDescriptorValue(value: number, min: number, max: number, bins: number): number {
  if (bins <= 1) {
    return 0;
  }
  if (!Number.isFinite(value)) {
    return 0;
  }
  const span = max - min;
  if (span <= 0 || !Number.isFinite(span)) {
    return 0;
  }
  const t = (value - min) / span;
  const scaled = Math.floor(t * bins);
  return clampBin(scaled, bins);
}

function keySegment(k: string, v: string | number): string {
  return `${k}=${String(v)}`;
}

/**
 * Canonical key for MAP-Elites cells — stable across runs for the same descriptor version and bin layout.
 */
export function strategyNicheFromDescriptor(descriptor: NicheDescriptor): StrategyNiche {
  const { behavior, bins } = descriptor;
  const parts = [
    keySegment('v', descriptor.descriptorVersion),
    keySegment('hh', behavior.holdingHorizonBin),
    keySegment('to', behavior.turnoverBin),
    keySegment('ac', behavior.assetClass),
    keySegment('sf', behavior.signalFamily),
    keySegment('ts', behavior.trendSensitivityBin),
    keySegment('mr', behavior.meanReversionSensitivityBin),
    keySegment('val', behavior.valuationSensitivityBin),
    keySegment('earn', behavior.earningsSensitivityBin),
    keySegment('macro', behavior.macroSensitivityBin),
    keySegment('volp', behavior.volatilityPreferenceBin),
    keySegment('liq', behavior.liquidityRequirementBin),
    keySegment('beta', behavior.marketBetaBin),
    keySegment('dd', behavior.drawdownProfile),
    keySegment('ls', behavior.longShortBias),
    keySegment('reg', behavior.regimePreference),
    keySegment('nb_hh', bins.holdingHorizon),
    keySegment('nb_to', bins.turnover),
    keySegment('nb_ts', bins.trendSensitivity),
    keySegment('nb_mr', bins.meanReversionSensitivity),
    keySegment('nb_val', bins.valuationSensitivity),
    keySegment('nb_earn', bins.earningsSensitivity),
    keySegment('nb_macro', bins.macroSensitivity),
    keySegment('nb_volp', bins.volatilityPreference),
    keySegment('nb_liq', bins.liquidityRequirement),
    keySegment('nb_beta', bins.marketBeta),
  ];
  return parts.join('|');
}

export function defaultNicheDescriptor(behavior: BehaviorDescriptors): NicheDescriptor {
  return Object.freeze({
    descriptorVersion: DESC_VERSION,
    behavior: Object.freeze({ ...behavior }),
    bins: Object.freeze({ ...DEFAULT_BIN_COUNTS }),
  });
}

/** Placeholder behavior with all continuous axes at bin 0; fill before niche assignment. */
export function emptyBehaviorDescriptors(): BehaviorDescriptors {
  return Object.freeze({
    holdingHorizonBin: 0,
    turnoverBin: 0,
    assetClass: 'OTHER',
    signalFamily: 'OTHER',
    trendSensitivityBin: 0,
    meanReversionSensitivityBin: 0,
    valuationSensitivityBin: 0,
    earningsSensitivityBin: 0,
    macroSensitivityBin: 0,
    volatilityPreferenceBin: 0,
    liquidityRequirementBin: 0,
    marketBetaBin: 0,
    drawdownProfile: 'UNKNOWN',
    longShortBias: 'MARKET_NEUTRAL',
    regimePreference: 'NEUTRAL',
  });
}
