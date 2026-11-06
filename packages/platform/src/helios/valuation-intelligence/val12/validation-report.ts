import type { UtcInstant } from '@solstice/domain';

import { HELIOS_VALUATION_INTELLIGENCE_SCHEMA } from '../taxonomy.ts';
import { compareValuationBenchmarks } from './benchmarks.ts';
import { resolveValuationRealityGate } from './reality-gate.ts';
import type { ValuationValidationReport } from './types.ts';

export function buildValuationValidationReport(input: {
  readonly generatedAt: UtcInstant;
  readonly gitSha: string;
  readonly architectureComplete: boolean;
  readonly knowableAtViolations: number;
  readonly heliosForecastErrorBps: number;
  readonly heliosStability: number;
  readonly heliosDispersion: number;
  readonly heliosFundamentalAccuracy: number;
}): ValuationValidationReport {
  const benchmarks = compareValuationBenchmarks({
    heliosForecastErrorBps: input.heliosForecastErrorBps,
    heliosStability: input.heliosStability,
    heliosDispersion: input.heliosDispersion,
    heliosFundamentalAccuracy: input.heliosFundamentalAccuracy,
  });
  const helios = benchmarks.find((row) => row.model === 'HELIOS_FULL_STACK')!;
  const simpleDcf = benchmarks.find((row) => row.model === 'SIMPLE_DCF')!;
  const gate = resolveValuationRealityGate({
    architectureComplete: input.architectureComplete,
    validationStable: helios.valuationStabilityScore >= 0.55,
    knowableAtViolations: input.knowableAtViolations,
  });
  return Object.freeze({
    schema: HELIOS_VALUATION_INTELLIGENCE_SCHEMA,
    generatedAt: input.generatedAt,
    gitSha: input.gitSha,
    benchmarks,
    heliosVsSimpleDcfImprovementBps:
      simpleDcf.forecastInputErrorBps - helios.forecastInputErrorBps,
    valuationQualityGate: gate.status,
    investmentAlphaClaimed: false,
    knowableAtViolations: input.knowableAtViolations,
  });
}
