import { evaluateDcfPath } from '../val04-probabilistic-dcf/dcf-path.ts';
import type { ProbabilisticDcfInput } from '../val04-probabilistic-dcf/types.ts';
import type { AccountingUncertaintySpread, AccountingValuationStateInput } from './types.ts';

export function buildAccountingUncertaintySpread(input: {
  readonly dcf: ProbabilisticDcfInput;
  readonly states: readonly AccountingValuationStateInput[];
}): AccountingUncertaintySpread | null {
  if (input.states.length === 0) return null;
  const base = input.dcf.assumptions;
  const evaluated = input.states.map((state) => {
    const revenue = input.dcf.baseRevenue * state.revenueMultiplier;
    const margin = clamp(base.margin.mean + state.marginAdjustment, base.margin.min ?? 0, base.margin.max ?? 1);
    const reinvestment = clamp(
      base.reinvestmentRate.mean + state.reinvestmentRateAdjustment,
      base.reinvestmentRate.min ?? 0,
      base.reinvestmentRate.max ?? 1,
    );
    const path = evaluateDcfPath({
      revenueGrowth: base.revenueGrowth.mean,
      margin,
      reinvestmentRate: reinvestment,
      wacc: base.wacc.mean,
      terminalGrowth: base.terminalGrowth.mean,
      terminalMultiple: base.terminalMultiple.mean,
      baseRevenue: revenue,
      forecastYears: input.dcf.forecastYears,
      taxRate: input.dcf.taxRate,
      ...(input.dcf.explicitForecasts === undefined ? {} : { explicitForecasts: input.dcf.explicitForecasts }),
      terminal: input.dcf.terminal,
      capitalStructure: input.dcf.capitalStructure,
      roic: input.dcf.coherence.roic,
    });
    return Object.freeze({ stateId: state.stateId, enterpriseValue: path.enterpriseValue });
  });
  const values = evaluated.map((e) => e.enterpriseValue);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const mid = (min + max) / 2;
  const spreadRatio = mid <= Number.EPSILON ? 0 : (max - min) / Math.abs(mid);
  return Object.freeze({
    states: Object.freeze(evaluated),
    minEnterpriseValue: min,
    maxEnterpriseValue: max,
    spreadRatio,
  });
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
