/**
 * NATIVE13 qualification — HELIOS_NATIVE_PREDICTION_MARKET_ENGINE_QUALIFIED
 */

import {
  HELIOS_NATIVE_PREDICTION_MARKET_ENGINE_BLOCKED,
  HELIOS_NATIVE_PREDICTION_MARKET_ENGINE_QUALIFIED,
} from './taxonomy.ts';

export { HELIOS_NATIVE_PREDICTION_MARKET_ENGINE_QUALIFIED, HELIOS_NATIVE_PREDICTION_MARKET_ENGINE_BLOCKED };

export type PredictionMarketEngineQualificationChecks = {
  readonly domainModelsPresent: boolean;
  readonly clobMetricsComputed: boolean;
  readonly entityResolutionWorks: boolean;
  readonly featureFabricExtracts: boolean;
  readonly paperPositionsTracked: boolean;
  readonly simulatedFillsWork: boolean;
  readonly exposureMetricsWork: boolean;
  readonly executionTwinPaperOnly: boolean;
  readonly riskAssessmentWorks: boolean;
  readonly evidenceSealed: boolean;
  readonly noPrivateKeyHandling: boolean;
  readonly livePolymarketTradingDisabled: boolean;
  readonly strategyLabStrategiesPresent: boolean;
  readonly externalDataSandboxProvider: boolean;
  readonly crossMarketConsistencyChecks: boolean;
};

export type PredictionMarketEngineQualificationResult = {
  readonly marker:
    | typeof HELIOS_NATIVE_PREDICTION_MARKET_ENGINE_QUALIFIED
    | typeof HELIOS_NATIVE_PREDICTION_MARKET_ENGINE_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluatePredictionMarketEngineQualification(
  checks: PredictionMarketEngineQualificationChecks,
): PredictionMarketEngineQualificationResult {
  const blockers: string[] = [];
  const entries: [keyof PredictionMarketEngineQualificationChecks, string][] = [
    ['domainModelsPresent', 'domain_models'],
    ['clobMetricsComputed', 'clob_metrics'],
    ['entityResolutionWorks', 'entity_resolution'],
    ['featureFabricExtracts', 'feature_fabric'],
    ['paperPositionsTracked', 'paper_positions'],
    ['simulatedFillsWork', 'simulated_fills'],
    ['exposureMetricsWork', 'exposure_metrics'],
    ['executionTwinPaperOnly', 'execution_twin'],
    ['riskAssessmentWorks', 'risk'],
    ['evidenceSealed', 'evidence'],
    ['noPrivateKeyHandling', 'no_private_keys'],
    ['livePolymarketTradingDisabled', 'live_trading_disabled'],
    ['strategyLabStrategiesPresent', 'strategy_lab'],
    ['externalDataSandboxProvider', 'external_data'],
    ['crossMarketConsistencyChecks', 'cross_market_consistency'],
  ];
  for (const [key, label] of entries) {
    if (!checks[key]) {
      blockers.push(label);
    }
  }
  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified
      ? HELIOS_NATIVE_PREDICTION_MARKET_ENGINE_QUALIFIED
      : HELIOS_NATIVE_PREDICTION_MARKET_ENGINE_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}
