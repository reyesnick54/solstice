/**
 * ContractRevenueConversionEstimate — calibrated historical obligation→revenue only.
 * Award ceiling and raw obligation are never treated as recognized revenue.
 */

import type { ContractRevenueConversionEstimate, HistoricalRevenueCalibrationRow } from './types.ts';
import { CONTRACT_REVENUE_CONVERSION_SCHEMA } from './taxonomy.ts';

export function calibrateObligationToRevenueFactor(
  rows: readonly HistoricalRevenueCalibrationRow[],
): number | null {
  if (rows.length === 0) {
    return null;
  }
  let revenue = 0n;
  let obligation = 0n;
  for (const row of rows) {
    if (row.obligatedMinor <= 0n) {
      continue;
    }
    revenue += row.recognizedRevenueMinor;
    obligation += row.obligatedMinor;
  }
  if (obligation === 0n) {
    return null;
  }
  return Number(revenue) / Number(obligation);
}

export function estimateContractRevenueFromCalibration(input: {
  readonly attributionEntityId: string;
  readonly sourceObligationMinor: bigint;
  readonly currency: string;
  readonly calibrationRows: readonly HistoricalRevenueCalibrationRow[];
  readonly calibrationWindowStart: string;
  readonly calibrationWindowEnd: string;
}): ContractRevenueConversionEstimate | null {
  const factor = calibrateObligationToRevenueFactor(input.calibrationRows);
  if (factor === null || factor < 0 || !Number.isFinite(factor)) {
    return null;
  }
  const estimated = BigInt(Math.round(Number(input.sourceObligationMinor) * factor));
  return Object.freeze({
    schema: CONTRACT_REVENUE_CONVERSION_SCHEMA,
    attributionEntityId: input.attributionEntityId,
    calibrationWindowStart: input.calibrationWindowStart,
    calibrationWindowEnd: input.calibrationWindowEnd,
    obligationToRevenueFactor: factor,
    estimatedRecognizedRevenueMinor: estimated,
    sourceObligationMinor: input.sourceObligationMinor,
    currency: input.currency,
    notSourcedFromAwardCeiling: true,
    notSourcedFromObligationAsRevenue: true,
    grantsExecutionAuthority: false as const,
  });
}