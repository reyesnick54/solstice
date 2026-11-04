import { LIVE_TRADING_ENABLED } from '@solstice/config';
import type { EarningsRealityGateStatus } from './taxonomy.ts';
import type {
  AntiOverfittingDiagnostics,
  ForecastMetrics,
  InvestmentResearchMetrics,
} from './types.ts';
import { forecastingMetricsQualified } from './metrics.ts';

export type RealityGateInput = {
  readonly architectureComplete: boolean;
  readonly chronologyValid: boolean;
  readonly holdoutEventCount: number;
  readonly forecast: ForecastMetrics;
  readonly investment: InvestmentResearchMetrics;
  readonly antiOverfitting: AntiOverfittingDiagnostics;
  readonly forwardPaperEvidencePresent: boolean;
  readonly liveTradingEnabled: boolean;
};

export function resolveEarningsRealityGate(input: RealityGateInput): {
  readonly status: EarningsRealityGateStatus;
  readonly notes: readonly string[];
  readonly insignificantAlphaNotPromoted: boolean;
} {
  const notes: string[] = [];

  if (!input.architectureComplete) {
    notes.push('EARN01–EARN11 modules or pipeline incomplete');
    return Object.freeze({
      status: 'ARCHITECTURALLY_QUALIFIED',
      notes: Object.freeze(notes),
      insignificantAlphaNotPromoted: true,
    });
  }

  if (!input.chronologyValid) {
    notes.push('Chronology embargo or issuer leakage violations detected');
  }

  const forecastingOk = forecastingMetricsQualified(input.forecast, input.holdoutEventCount);
  if (!forecastingOk) {
    notes.push('Holdout forecast metrics below qualification thresholds or insufficient holdout events');
  }

  if (input.investment.returnPredictabilitySignificant) {
    notes.push('Return predictability exceeds significance heuristic — requires manual review');
  } else {
    notes.push('Return predictability treated as not statistically significant (simulation fixture)');
  }

  if (input.antiOverfitting.deflatedSharpeRatio !== null && input.antiOverfitting.deflatedSharpeRatio <= 0) {
    notes.push('Deflated Sharpe Ratio does not support alpha promotion');
  }
  if (
    input.antiOverfitting.probabilityOfBacktestOverfitting !== null &&
    input.antiOverfitting.probabilityOfBacktestOverfitting > 0.45
  ) {
    notes.push('Elevated probability of backtest overfitting');
  }

  let status: EarningsRealityGateStatus = 'ARCHITECTURALLY_QUALIFIED';
  if (input.architectureComplete && input.chronologyValid) {
    status = forecastingOk ? 'FORECASTING_QUALIFIED' : 'ARCHITECTURALLY_QUALIFIED';
  }

  const insignificantAlphaNotPromoted = !input.investment.returnPredictabilitySignificant;

  if (
    status === 'FORECASTING_QUALIFIED' &&
    insignificantAlphaNotPromoted &&
    input.antiOverfitting.multipleTestingAdjusted
  ) {
    status = 'PAPER_ALPHA_CANDIDATE';
    notes.push('Paper alpha candidate only — not forward or live supported');
  }

  if (input.forwardPaperEvidencePresent && status === 'PAPER_ALPHA_CANDIDATE') {
    status = 'FORWARD_ALPHA_SUPPORTED';
    notes.push('Forward paper evidence present (simulation harness)');
  }

  const liveAllowed = input.liveTradingEnabled && LIVE_TRADING_ENABLED;
  if (liveAllowed && status === 'FORWARD_ALPHA_SUPPORTED') {
    status = 'LIVE_ALPHA_SUPPORTED';
    notes.push('Live alpha would require human pilot authorization — not enabled in this repository');
  }

  if (LIVE_TRADING_ENABLED) {
    notes.push('LIVE_TRADING_ENABLED must remain false in simulation qualification');
  }

  return Object.freeze({ status, notes: Object.freeze(notes), insignificantAlphaNotPromoted });
}

/** Architecture implemented must not imply alpha proven. */
export function architectureImpliesAlpha(status: EarningsRealityGateStatus): boolean {
  return status === 'FORWARD_ALPHA_SUPPORTED' || status === 'LIVE_ALPHA_SUPPORTED';
}
