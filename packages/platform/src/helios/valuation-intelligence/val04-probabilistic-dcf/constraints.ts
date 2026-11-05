import { DEFAULT_NOMINAL_ECONOMIC_GROWTH_CAP } from './taxonomy.ts';
import type { DcfCoherencePolicy, ResolvedAssumptionDraw, TerminalValueSpec } from './types.ts';

export type ConstraintResolution = {
  readonly assumptions: ResolvedAssumptionDraw;
  readonly notes: readonly string[];
  readonly violations: readonly string[];
};

export function resolveAssumptionDraw(input: {
  readonly zScores: Record<string, number>;
  readonly specs: import('./types.ts').CorrelatedAssumptionBundle;
  readonly coherence: DcfCoherencePolicy;
  readonly terminal: TerminalValueSpec;
}): ConstraintResolution {
  const notes: string[] = [];
  const violations: string[] = [];
  const spec = input.specs;

  const draw = (key: keyof ResolvedAssumptionDraw): number => {
    const z = input.zScores[key] ?? 0;
    const gaussian = spec[key];
    return sample(key, z, gaussian.mean, gaussian.stdDev, gaussian.min, gaussian.max);
  };

  let revenueGrowth = draw('revenueGrowth');
  let margin = draw('margin');
  let reinvestmentRate = draw('reinvestmentRate');
  let wacc = draw('wacc');
  let terminalGrowth = draw('terminalGrowth');
  let terminalMultiple = draw('terminalMultiple');

  margin = clamp(margin, 0.001, 0.95);
  reinvestmentRate = clamp(reinvestmentRate, 0, 0.95);
  wacc = clamp(wacc, 0.03, 0.35);

  const growthCap = input.coherence.nominalEconomicGrowthCap ?? DEFAULT_NOMINAL_ECONOMIC_GROWTH_CAP;
  const needsTerminalGrowth =
    input.terminal.method === 'TERMINAL_GROWTH' ||
    (input.terminal.method === 'FADE_TO_MATURITY' && input.terminal.terminalMethod === 'TERMINAL_GROWTH');

  if (needsTerminalGrowth && terminalGrowth > growthCap) {
    if (input.coherence.exceptionalTerminalGrowthJustification?.trim()) {
      notes.push(
        `terminal_growth ${terminalGrowth.toFixed(4)} exceeds cap ${growthCap}; allowed via exceptional justification`,
      );
    } else {
      violations.push(`terminal_growth_exceeds_nominal_cap:${terminalGrowth}>${growthCap}`);
      terminalGrowth = growthCap;
      notes.push(`terminal_growth clamped to nominal economic cap ${growthCap}`);
    }
  }

  if (input.coherence.enforceRoicReinvestmentIdentity && input.coherence.roic !== undefined) {
    const roic = Math.max(input.coherence.roic, 0.05);
    const impliedGrowth = roic * reinvestmentRate;
    const growthGap = Math.abs(impliedGrowth - revenueGrowth);
    if (growthGap > 0.02) {
      const coherentReinvestment = clamp(revenueGrowth / roic, 0, 0.95);
      notes.push(
        `reinvestment adjusted for ROIC identity: g=${revenueGrowth.toFixed(4)} ROIC=${roic.toFixed(4)} ` +
          `reinvestment ${reinvestmentRate.toFixed(4)} -> ${coherentReinvestment.toFixed(4)}`,
      );
      reinvestmentRate = coherentReinvestment;
    }
  }

  if (needsTerminalGrowth && terminalGrowth >= wacc - 0.005) {
    violations.push(`terminal_growth_too_close_to_wacc:${terminalGrowth}>=${wacc}`);
    terminalGrowth = Math.min(terminalGrowth, wacc - 0.01);
    notes.push('terminal_growth reduced to maintain WACC spread');
  }

  terminalMultiple = Math.max(terminalMultiple, 0.5);

  return Object.freeze({
    assumptions: Object.freeze({
      revenueGrowth,
      margin,
      reinvestmentRate,
      wacc,
      terminalGrowth,
      terminalMultiple,
    }),
    notes: Object.freeze(notes),
    violations: Object.freeze(violations),
  });
}

function sample(
  label: string,
  z: number,
  mean: number,
  stdDev: number,
  min?: number,
  max?: number,
): number {
  let v = mean + z * stdDev;
  if (min !== undefined) v = Math.max(min, v);
  if (max !== undefined) v = Math.min(max, v);
  if (!Number.isFinite(v)) {
    throw new Error(`non-finite assumption draw for ${label}`);
  }
  return v;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
