import { evaluateDcfPath } from './dcf-path.ts';
import type { ProbabilisticDcfInput, SensitivitySurface } from './types.ts';

const DEFAULT_STEPS = 5;

export function buildSensitivitySurfaces(input: ProbabilisticDcfInput): readonly SensitivitySurface[] {
  const steps = input.sensitivityGridSteps ?? DEFAULT_STEPS;
  const base = input.assumptions;
  return Object.freeze([
    gridSurface({
      id: 'wacc_x_terminal_growth',
      xLabel: 'WACC',
      yLabel: 'terminal_growth',
      metric: 'ENTERPRISE_VALUE',
      input,
      xRange: range(base.wacc.mean, base.wacc.stdDev, steps, base.wacc.min, base.wacc.max),
      yRange: range(base.terminalGrowth.mean, base.terminalGrowth.stdDev, steps, base.terminalGrowth.min, base.terminalGrowth.max),
      apply: (assumptions, x, y) => ({ ...assumptions, wacc: x, terminalGrowth: y }),
    }),
    gridSurface({
      id: 'growth_x_margin',
      xLabel: 'revenue_growth',
      yLabel: 'margin',
      metric: 'ENTERPRISE_VALUE',
      input,
      xRange: range(base.revenueGrowth.mean, base.revenueGrowth.stdDev, steps, base.revenueGrowth.min, base.revenueGrowth.max),
      yRange: range(base.margin.mean, base.margin.stdDev, steps, base.margin.min, base.margin.max),
      apply: (assumptions, x, y) => ({ ...assumptions, revenueGrowth: x, margin: y }),
    }),
    gridSurface({
      id: 'reinvestment_x_roic',
      xLabel: 'reinvestment_rate',
      yLabel: 'ROIC',
      metric: 'EQUITY_VALUE',
      input,
      xRange: range(base.reinvestmentRate.mean, base.reinvestmentRate.stdDev, steps, base.reinvestmentRate.min, base.reinvestmentRate.max),
      yRange: roicRange(input.coherence.roic ?? 0.12, steps),
      apply: (assumptions, x, y) => ({ ...assumptions, reinvestmentRate: x, roic: y }),
    }),
  ]);
}

function gridSurface(input: {
  readonly id: string;
  readonly xLabel: string;
  readonly yLabel: string;
  readonly metric: 'ENTERPRISE_VALUE' | 'EQUITY_VALUE';
  readonly input: ProbabilisticDcfInput;
  readonly xRange: readonly number[];
  readonly yRange: readonly number[];
  readonly apply: (
    assumptions: import('./types.ts').ResolvedAssumptionDraw & { readonly roic?: number },
    x: number,
    y: number,
  ) => import('./types.ts').ResolvedAssumptionDraw & { readonly roic?: number };
}): SensitivitySurface {
  const baseAssumptions = {
    revenueGrowth: input.input.assumptions.revenueGrowth.mean,
    margin: input.input.assumptions.margin.mean,
    reinvestmentRate: input.input.assumptions.reinvestmentRate.mean,
    wacc: input.input.assumptions.wacc.mean,
    terminalGrowth: input.input.assumptions.terminalGrowth.mean,
    terminalMultiple: input.input.assumptions.terminalMultiple.mean,
  };
  const values: number[][] = [];
  for (const y of input.yRange) {
    const row: number[] = [];
    for (const x of input.xRange) {
      const merged = input.apply({ ...baseAssumptions }, x, y);
      const path = evaluateDcfPath({
        revenueGrowth: merged.revenueGrowth,
        margin: merged.margin,
        reinvestmentRate: merged.reinvestmentRate,
        wacc: merged.wacc,
        terminalGrowth: merged.terminalGrowth,
        terminalMultiple: merged.terminalMultiple,
        baseRevenue: input.input.baseRevenue,
        forecastYears: input.input.forecastYears,
        taxRate: input.input.taxRate,
        ...(input.input.explicitForecasts === undefined ? {} : { explicitForecasts: input.input.explicitForecasts }),
        terminal: input.input.terminal,
        capitalStructure: input.input.capitalStructure,
        roic: merged.roic ?? input.input.coherence.roic,
      });
      row.push(input.metric === 'ENTERPRISE_VALUE' ? path.enterpriseValue : path.equityValue);
    }
    values.push(row);
  }
  return Object.freeze({
    id: input.id,
    xLabel: input.xLabel,
    yLabel: input.yLabel,
    xValues: Object.freeze([...input.xRange]),
    yValues: Object.freeze([...input.yRange]),
    values: Object.freeze(values.map((row) => Object.freeze(row))),
    metric: input.metric,
  });
}

function range(mean: number, stdDev: number, steps: number, min?: number, max?: number): readonly number[] {
  const lo = min ?? mean - 2 * stdDev;
  const hi = max ?? mean + 2 * stdDev;
  const out: number[] = [];
  for (let i = 0; i < steps; i += 1) {
    const t = steps === 1 ? 0.5 : i / (steps - 1);
    out.push(lo + (hi - lo) * t);
  }
  return Object.freeze(out);
}

function roicRange(center: number, steps: number): readonly number[] {
  const lo = Math.max(0.05, center - 0.08);
  const hi = center + 0.08;
  const out: number[] = [];
  for (let i = 0; i < steps; i += 1) {
    const t = steps === 1 ? 0.5 : i / (steps - 1);
    out.push(lo + (hi - lo) * t);
  }
  return Object.freeze(out);
}
