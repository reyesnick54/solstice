import type { ProbabilisticDcfInput } from './types.ts';

const IDENTITY_CORRELATION = Object.freeze([
  Object.freeze([1, 0, 0, 0, 0, 0]),
  Object.freeze([0, 1, 0, 0, 0, 0]),
  Object.freeze([0, 0, 1, 0, 0, 0]),
  Object.freeze([0, 0, 0, 1, 0, 0]),
  Object.freeze([0, 0, 0, 0, 1, 0]),
  Object.freeze([0, 0, 0, 0, 0, 1]),
]);

/** Mild positive correlation: growth ↔ margin, WACC ↔ terminal growth (inflationary). */
export const FIXTURE_VAL04_CORRELATION = Object.freeze([
  Object.freeze([1, 0.25, 0.15, -0.1, 0.2, 0]),
  Object.freeze([0.25, 1, 0.1, -0.05, 0.05, 0.1]),
  Object.freeze([0.15, 0.1, 1, -0.2, 0, 0]),
  Object.freeze([-0.1, -0.05, -0.2, 1, 0.35, -0.15]),
  Object.freeze([0.2, 0.05, 0, 0.35, 1, 0.05]),
  Object.freeze([0, 0.1, 0, -0.15, 0.05, 1]),
]);

export function fixtureTerminalGrowthDcfInput(): ProbabilisticDcfInput {
  return Object.freeze({
    valuationId: 'val_fixture_terminal_growth',
    entityLabel: 'FixtureCo',
    baseRevenue: 1_000,
    forecastYears: 5,
    taxRate: 0.21,
    explicitForecasts: Object.freeze([
      Object.freeze({ yearIndex: 1, revenue: 1_080 }),
      Object.freeze({ yearIndex: 2, margin: 0.18 }),
    ]),
    terminal: Object.freeze({ method: 'TERMINAL_GROWTH' as const }),
    capitalStructure: Object.freeze({
      netDebt: 500,
      cash: 50,
      sharesOutstanding: 100,
      interestRate: 0.045,
      netDebtChangePerYear: -25,
    }),
    assumptions: Object.freeze({
      revenueGrowth: Object.freeze({ mean: 0.08, stdDev: 0.03, min: -0.05, max: 0.2 }),
      margin: Object.freeze({ mean: 0.17, stdDev: 0.02, min: 0.08, max: 0.28 }),
      reinvestmentRate: Object.freeze({ mean: 0.45, stdDev: 0.08, min: 0.1, max: 0.75 }),
      wacc: Object.freeze({ mean: 0.095, stdDev: 0.012, min: 0.06, max: 0.14 }),
      terminalGrowth: Object.freeze({ mean: 0.025, stdDev: 0.008, min: 0, max: 0.05 }),
      terminalMultiple: Object.freeze({ mean: 12, stdDev: 2, min: 6, max: 18 }),
      correlationMatrix: FIXTURE_VAL04_CORRELATION,
    }),
    coherence: Object.freeze({
      enforceRoicReinvestmentIdentity: true,
      roic: 0.14,
      nominalEconomicGrowthCap: 0.06,
    }),
    monteCarloPaths: 128,
    seed: 0x5641_4c04,
    sensitivityGridSteps: 4,
  });
}

export function fixtureExitMultipleDcfInput(): ProbabilisticDcfInput {
  const base = fixtureTerminalGrowthDcfInput();
  return Object.freeze({
    ...base,
    valuationId: 'val_fixture_exit_multiple',
    terminal: Object.freeze({
      method: 'EXIT_MULTIPLE' as const,
      metric: 'NOPAT' as const,
      terminalMultiple: 14,
    }),
  });
}

export function fixtureFadeToMaturityDcfInput(): ProbabilisticDcfInput {
  const base = fixtureTerminalGrowthDcfInput();
  return Object.freeze({
    ...base,
    valuationId: 'val_fixture_fade',
    terminal: Object.freeze({
      method: 'FADE_TO_MATURITY' as const,
      fade: Object.freeze({
        fadeYears: 3,
        terminalGrowth: 0.02,
        terminalMargin: 0.16,
        terminalReinvestmentRate: 0.35,
        terminalRoic: 0.12,
      }),
      terminalMethod: 'TERMINAL_GROWTH' as const,
    }),
  });
}

export { IDENTITY_CORRELATION };
