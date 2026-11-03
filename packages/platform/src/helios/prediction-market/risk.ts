/**
 * HELIOS Risk — prediction-market paper research constraints.
 */

import type { ExposureMetrics, PredictionRiskAssessment } from './types.ts';

export type PredictionRiskLimits = {
  readonly maxGrossContractsPerCondition: bigint;
  readonly maxNetYesContracts: bigint;
  readonly maxNotionalMinor: bigint;
};

export const DEFAULT_PREDICTION_RISK_LIMITS: PredictionRiskLimits = Object.freeze({
  maxGrossContractsPerCondition: 100_000n,
  maxNetYesContracts: 50_000n,
  maxNotionalMinor: 500_000_000n,
});

export function assessPredictionMarketRisk(
  exposure: ExposureMetrics,
  limits: PredictionRiskLimits = DEFAULT_PREDICTION_RISK_LIMITS,
): PredictionRiskAssessment {
  const reasonCodes: string[] = [];
  if (exposure.grossContracts > limits.maxGrossContractsPerCondition) {
    reasonCodes.push('GROSS_EXPOSURE_LIMIT');
  }
  const absNet = exposure.netYesContracts < 0n ? -exposure.netYesContracts : exposure.netYesContracts;
  if (absNet > limits.maxNetYesContracts) {
    reasonCodes.push('NET_YES_LIMIT');
  }
  if (exposure.notionalAtRiskMinor > limits.maxNotionalMinor) {
    reasonCodes.push('NOTIONAL_LIMIT');
  }
  return Object.freeze({
    permitted: reasonCodes.length === 0,
    reasonCodes: Object.freeze(reasonCodes),
    exposure,
  });
}
