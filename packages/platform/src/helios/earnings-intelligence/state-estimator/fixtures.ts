/**
 * Sandbox expert signals for EARN09 qualification and tests.
 */

import { asUtcInstant } from '@solstice/domain';
import type { EarningsExpertSignal, EarningsGatingContext } from './types.ts';
import { DEFAULT_EXPERT_PRIMARY_TARGETS } from './expert-targets.ts';
import type { EarningsExpertKind } from './taxonomy.ts';

export const FIXTURE_EARNINGS_AS_OF = asUtcInstant('2026-10-15T14:00:00.000Z');

export const FIXTURE_EARNINGS_GATING: EarningsGatingContext = Object.freeze({
  sector: 'TECHNOLOGY',
  marketCapTier: 'LARGE',
  liquidityScore: 0.82,
  earningsRegime: 'mid_cycle',
  macroRegime: 'disinflation_soft_landing',
  dataCoverage: 0.88,
  forecastDispersion: 0.35,
  optionsAvailable: true,
});

function expert(
  expertKind: EarningsExpertKind,
  estimate: number,
  uncertainty: number,
  dataQuality: number,
): EarningsExpertSignal {
  return Object.freeze({
    expertKind,
    estimate,
    uncertainty,
    dataQuality,
    historicalCalibration: 0.75,
    applicableRegime: Object.freeze(['mid_cycle', 'sector:TECHNOLOGY']),
    primaryTargets: DEFAULT_EXPERT_PRIMARY_TARGETS[expertKind],
    evaluatedAt: FIXTURE_EARNINGS_AS_OF,
  });
}

export function fixtureEarningsExpertSignals(): readonly EarningsExpertSignal[] {
  return Object.freeze([
    expert('StreetExpectationExpert', 2.45, 0.12, 0.9),
    expert('FundamentalTrendExpert', 2.52, 0.18, 0.85),
    expert('EarningsQualityExpert', 0.32, 0.1, 0.8),
    expert('TranscriptExpert', 0.58, 0.15, 0.7),
    expert('OptionsExpert', 0.61, 0.08, 0.88),
    expert('PeerReadThroughExpert', 11.82, 0.35, 0.78),
    expert('MacroExpert', 0.55, 0.12, 0.72),
    expert('MarketReactionExpert', 0.018, 0.025, 0.65),
  ]);
}
