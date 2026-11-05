import { resolveAssumptionDraw } from './constraints.ts';
import { evaluateDcfPath } from './dcf-path.ts';
import { createRngState, drawCorrelatedNormals } from './rng.ts';
import { DEFAULT_VAL04_MONTE_CARLO_PATHS } from './taxonomy.ts';
import type { ProbabilisticDcfInput, SinglePathDcfResult } from './types.ts';

export type MonteCarloRun = {
  readonly paths: readonly SinglePathDcfResult[];
  readonly constraintViolations: readonly string[];
};

export function runMonteCarloDcf(input: ProbabilisticDcfInput): MonteCarloRun {
  const pathCount = input.monteCarloPaths ?? DEFAULT_VAL04_MONTE_CARLO_PATHS;
  const rng = createRngState(input.seed ?? 0x5641_4c04);
  const paths: SinglePathDcfResult[] = [];
  const violations = new Set<string>();

  for (let i = 0; i < pathCount; i += 1) {
    const zScores = drawCorrelatedNormals({
      rng,
      correlationMatrix: input.assumptions.correlationMatrix,
    });
    const resolved = resolveAssumptionDraw({
      zScores,
      specs: input.assumptions,
      coherence: input.coherence,
      terminal: input.terminal,
    });
    for (const v of resolved.violations) violations.add(v);

    const path = evaluateDcfPath({
      ...resolved.assumptions,
      baseRevenue: input.baseRevenue,
      forecastYears: input.forecastYears,
      taxRate: input.taxRate,
      explicitForecasts: input.explicitForecasts,
      terminal: input.terminal,
      capitalStructure: input.capitalStructure,
      roic: input.coherence.roic,
    });
    paths.push(
      Object.freeze({
        ...path,
        constraintNotes: Object.freeze([...path.constraintNotes, ...resolved.notes]),
      }),
    );
  }

  return Object.freeze({
    paths: Object.freeze(paths),
    constraintViolations: Object.freeze([...violations]),
  });
}

/** Deterministic median-path draw at z=0 for representative reporting. */
export function evaluateMedianAssumptionPath(input: ProbabilisticDcfInput): SinglePathDcfResult {
  const zZero = {
    revenueGrowth: 0,
    margin: 0,
    reinvestmentRate: 0,
    wacc: 0,
    terminalGrowth: 0,
    terminalMultiple: 0,
  };
  const resolved = resolveAssumptionDraw({
    zScores: zZero,
    specs: input.assumptions,
    coherence: input.coherence,
    terminal: input.terminal,
  });
  return evaluateDcfPath({
    ...resolved.assumptions,
    baseRevenue: input.baseRevenue,
    forecastYears: input.forecastYears,
    taxRate: input.taxRate,
    explicitForecasts: input.explicitForecasts,
    terminal: input.terminal,
    capitalStructure: input.capitalStructure,
    roic: input.coherence.roic,
  });
}
