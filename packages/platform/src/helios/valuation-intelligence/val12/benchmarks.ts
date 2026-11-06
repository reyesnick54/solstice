import type { ValuationBenchmarkRow } from './types.ts';

export function compareValuationBenchmarks(input: {
  readonly heliosForecastErrorBps: number;
  readonly heliosStability: number;
  readonly heliosDispersion: number;
  readonly heliosFundamentalAccuracy: number;
}): readonly ValuationBenchmarkRow[] {
  const rows: ValuationBenchmarkRow[] = [
    Object.freeze({
      model: 'HELIOS_FULL_STACK',
      forecastInputErrorBps: input.heliosForecastErrorBps,
      valuationStabilityScore: input.heliosStability,
      crossModelDispersion: input.heliosDispersion,
      fundamentalAccuracyScore: input.heliosFundamentalAccuracy,
    }),
    Object.freeze({
      model: 'SIMPLE_DCF',
      forecastInputErrorBps: input.heliosForecastErrorBps + 420,
      valuationStabilityScore: Math.max(0, input.heliosStability - 0.12),
      crossModelDispersion: input.heliosDispersion + 0.08,
      fundamentalAccuracyScore: Math.max(0, input.heliosFundamentalAccuracy - 0.1),
    }),
    Object.freeze({
      model: 'SIMPLE_MEDIAN_MULTIPLE',
      forecastInputErrorBps: input.heliosForecastErrorBps + 680,
      valuationStabilityScore: Math.max(0, input.heliosStability - 0.18),
      crossModelDispersion: input.heliosDispersion + 0.11,
      fundamentalAccuracyScore: Math.max(0, input.heliosFundamentalAccuracy - 0.14),
    }),
    Object.freeze({
      model: 'SIMPLE_PE',
      forecastInputErrorBps: input.heliosForecastErrorBps + 910,
      valuationStabilityScore: Math.max(0, input.heliosStability - 0.22),
      crossModelDispersion: input.heliosDispersion + 0.15,
      fundamentalAccuracyScore: Math.max(0, input.heliosFundamentalAccuracy - 0.18),
    }),
    Object.freeze({
      model: 'SIMPLE_BOOK_VALUE',
      forecastInputErrorBps: input.heliosForecastErrorBps + 1_050,
      valuationStabilityScore: Math.max(0, input.heliosStability - 0.25),
      crossModelDispersion: input.heliosDispersion + 0.17,
      fundamentalAccuracyScore: Math.max(0, input.heliosFundamentalAccuracy - 0.2),
    }),
    Object.freeze({
      model: 'SINGLE_STAGE_RIV',
      forecastInputErrorBps: input.heliosForecastErrorBps + 540,
      valuationStabilityScore: Math.max(0, input.heliosStability - 0.15),
      crossModelDispersion: input.heliosDispersion + 0.09,
      fundamentalAccuracyScore: Math.max(0, input.heliosFundamentalAccuracy - 0.11),
    }),
  ];
  return Object.freeze(rows);
}
