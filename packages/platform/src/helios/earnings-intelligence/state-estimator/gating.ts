/**
 * Expert gating from sector, liquidity, regime, and data coverage.
 */

import type { EarningsExpertKind, EarningsGatingVariable } from './taxonomy.ts';
import type { EarningsExpertSignal, EarningsGatingContext } from './types.ts';

const OPTIONS_EXPERT: EarningsExpertKind = 'OptionsExpert';
const MARKET_REACTION_EXPERT: EarningsExpertKind = 'MarketReactionExpert';

export function listGatingVariablesUsed(context: EarningsGatingContext): readonly EarningsGatingVariable[] {
  return Object.freeze([
    'sector',
    'marketCap',
    'liquidity',
    'earningsRegime',
    'macroRegime',
    'dataCoverage',
    'forecastDispersion',
    'optionsAvailability',
  ]);
}

export function computeExpertGateWeight(signal: EarningsExpertSignal, context: EarningsGatingContext): number {
  let weight = signal.dataQuality * signal.historicalCalibration;
  weight *= Math.min(1, Math.max(0, context.dataCoverage));

  if (signal.applicableRegime.length > 0) {
    const regimeHit =
      signal.applicableRegime.includes(context.earningsRegime) ||
      signal.applicableRegime.includes(context.macroRegime) ||
      signal.applicableRegime.includes(`sector:${context.sector}`);
    weight *= regimeHit ? 1.15 : 0.85;
  }

  if (context.liquidityScore < 0.3 && signal.expertKind === MARKET_REACTION_EXPERT) {
    weight *= 0.6;
  }

  if (context.marketCapTier === 'MICRO' || context.marketCapTier === 'SMALL') {
    if (signal.expertKind === 'PeerReadThroughExpert') {
      weight *= 0.9;
    }
  }

  if (!context.optionsAvailable && signal.expertKind === OPTIONS_EXPERT) {
    weight *= 0.08;
  }

  if (context.forecastDispersion > 0.6 && signal.expertKind === 'StreetExpectationExpert') {
    weight *= 1.05;
  }

  return Math.min(1, Math.max(0.02, weight));
}
