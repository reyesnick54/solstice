import { evaluateDcfPath } from '../val04-probabilistic-dcf/dcf-path.ts';
import { evaluateMedianAssumptionPath } from '../val04-probabilistic-dcf/monte-carlo.ts';
import type { ProbabilisticDcfInput } from '../val04-probabilistic-dcf/types.ts';
import type { FragilityDimension, ValuationFragilityIndex, ValuationFragilityState } from './types.ts';

const BUMP_POLICY = 'val10-fragility-v1: one-sided plausible stress per dimension at median assumptions';

export function buildValuationFragility(input: ProbabilisticDcfInput): ValuationFragilityState {
  const basePath = evaluateMedianAssumptionPath(input);
  const baseEv = basePath.enterpriseValue;
  const a = input.assumptions;

  const dimensions: FragilityDimension[] = [
    bumpDimension({
      dimension: 'WACC',
      bumpDescription: '+100 bps WACC',
      baseEv,
      stressedEv: evWithAssumptionOverrides(input, { wacc: a.wacc.mean + 0.01 }),
    }),
    bumpDimension({
      dimension: 'GROWTH',
      bumpDescription: '-200 bps revenue growth',
      baseEv,
      stressedEv: evWithAssumptionOverrides(input, {
        revenueGrowth: Math.max(a.revenueGrowth.min ?? -0.2, a.revenueGrowth.mean - 0.02),
      }),
    }),
    bumpDimension({
      dimension: 'MARGIN',
      bumpDescription: '-150 bps margin',
      baseEv,
      stressedEv: evWithAssumptionOverrides(input, {
        margin: Math.max(a.margin.min ?? 0, a.margin.mean - 0.015),
      }),
    }),
    bumpDimension({
      dimension: 'ROIC',
      bumpDescription: '-300 bps ROIC (via reinvestment identity)',
      baseEv,
      stressedEv: evWithRoicStress(input, (input.coherence.roic ?? 0.12) - 0.03),
    }),
    bumpDimension({
      dimension: 'REINVESTMENT',
      bumpDescription: '+500 bps reinvestment rate',
      baseEv,
      stressedEv: evWithAssumptionOverrides(input, {
        reinvestmentRate: Math.min(a.reinvestmentRate.max ?? 1, a.reinvestmentRate.mean + 0.05),
      }),
    }),
    bumpDimension({
      dimension: 'PEER_SET',
      bumpDescription: '-1.0x exit multiple (peer-set compression proxy)',
      baseEv,
      stressedEv: evWithAssumptionOverrides(input, {
        terminalMultiple: Math.max(a.terminalMultiple.min ?? 1, a.terminalMultiple.mean - 1),
      }),
    }),
    bumpDimension({
      dimension: 'TERMINAL_METHODOLOGY',
      bumpDescription: '-25 bps terminal growth vs base Gordon path',
      baseEv,
      stressedEv: evWithAssumptionOverrides(input, {
        terminalGrowth: Math.max(a.terminalGrowth.min ?? 0, a.terminalGrowth.mean - 0.0025),
      }),
    }),
  ];

  const index = aggregateFragilityIndex(dimensions);
  return Object.freeze({
    fragility: Object.freeze({ index, dimensions: Object.freeze(dimensions) }),
    plausibleBumpPolicy: BUMP_POLICY,
  });
}

function bumpDimension(input: {
  readonly dimension: FragilityDimension['dimension'];
  readonly bumpDescription: string;
  readonly baseEv: number;
  readonly stressedEv: number;
}): FragilityDimension {
  const rel =
    input.baseEv <= Number.EPSILON ? 0 : (input.stressedEv - input.baseEv) / Math.abs(input.baseEv);
  return Object.freeze({
    dimension: input.dimension,
    bumpDescription: input.bumpDescription,
    baseEnterpriseValue: input.baseEv,
    stressedEnterpriseValue: input.stressedEv,
    relativeChange: rel,
  });
}

function aggregateFragilityIndex(dimensions: readonly FragilityDimension[]): number {
  if (dimensions.length === 0) return 0;
  let sum = 0;
  for (const d of dimensions) {
    sum += Math.abs(d.relativeChange);
  }
  return sum / dimensions.length;
}

function evWithAssumptionOverrides(
  input: ProbabilisticDcfInput,
  overrides: Partial<{
    revenueGrowth: number;
    margin: number;
    reinvestmentRate: number;
    wacc: number;
    terminalGrowth: number;
    terminalMultiple: number;
  }>,
): number {
  const base = input.assumptions;
  const path = evaluateDcfPath({
    revenueGrowth: overrides.revenueGrowth ?? base.revenueGrowth.mean,
    margin: overrides.margin ?? base.margin.mean,
    reinvestmentRate: overrides.reinvestmentRate ?? base.reinvestmentRate.mean,
    wacc: overrides.wacc ?? base.wacc.mean,
    terminalGrowth: overrides.terminalGrowth ?? base.terminalGrowth.mean,
    terminalMultiple: overrides.terminalMultiple ?? base.terminalMultiple.mean,
    baseRevenue: input.baseRevenue,
    forecastYears: input.forecastYears,
    taxRate: input.taxRate,
    explicitForecasts: input.explicitForecasts,
    terminal: input.terminal,
    capitalStructure: input.capitalStructure,
    roic: input.coherence.roic,
  });
  return path.enterpriseValue;
}

function evWithRoicStress(input: ProbabilisticDcfInput, roic: number): number {
  const base = input.assumptions;
  const path = evaluateDcfPath({
    revenueGrowth: base.revenueGrowth.mean,
    margin: base.margin.mean,
    reinvestmentRate: base.reinvestmentRate.mean,
    wacc: base.wacc.mean,
    terminalGrowth: base.terminalGrowth.mean,
    terminalMultiple: base.terminalMultiple.mean,
    baseRevenue: input.baseRevenue,
    forecastYears: input.forecastYears,
    taxRate: input.taxRate,
    explicitForecasts: input.explicitForecasts,
    terminal: input.terminal,
    capitalStructure: input.capitalStructure,
    roic: Math.max(0.05, roic),
  });
  return path.enterpriseValue;
}

export type { ValuationFragilityIndex };
