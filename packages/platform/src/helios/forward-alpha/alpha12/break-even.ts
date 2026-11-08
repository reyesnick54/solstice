import { ALPHA12_CAPITAL_SCALE_MULTIPLIERS } from './taxonomy.ts';
import type { Alpha12CapitalScaleMultiplier, BreakEvenCapitalEstimate, CapacityCeilingEstimate } from './types.ts';
import type { CapitalScaleScenario } from './types.ts';

function parseMinor(value: string): bigint {
  return BigInt(value);
}

export function estimateBreakEvenCapital(
  shadowMinor: bigint,
  scenarios: readonly CapitalScaleScenario[],
): BreakEvenCapitalEstimate {
  const permitted = scenarios.filter((row) => row.liquidityPermitted);
  if (permitted.length === 0) {
    return Object.freeze({
      breakEvenCapitalMinorLow: '0',
      breakEvenCapitalMinorMid: '0',
      breakEvenCapitalMinorHigh: '0',
      uncertaintyBps: 500,
      method: 'INTERPOLATED_SCALE_CURVE',
      netAlphaCrossesZero: false,
    });
  }

  let cross: { low: bigint; high: bigint } | null = null;
  for (let i = 1; i < permitted.length; i += 1) {
    const prev = permitted[i - 1]!;
    const cur = permitted[i]!;
    if (prev.netAlphaBps > 0 && cur.netAlphaBps <= 0) {
      cross = {
        low: parseMinor(prev.deployedCapitalMinor),
        high: parseMinor(cur.deployedCapitalMinor),
      };
      break;
    }
  }

  if (!cross) {
    const last = permitted[permitted.length - 1]!;
    if (last.netAlphaBps > 0) {
      return Object.freeze({
        breakEvenCapitalMinorLow: last.deployedCapitalMinor,
        breakEvenCapitalMinorMid: last.deployedCapitalMinor,
        breakEvenCapitalMinorHigh: last.deployedCapitalMinor,
        uncertaintyBps: 150,
        method: 'INTERPOLATED_SCALE_CURVE',
        netAlphaCrossesZero: false,
      });
    }
    return Object.freeze({
      breakEvenCapitalMinorLow: '0',
      breakEvenCapitalMinorMid: shadowMinor.toString(),
      breakEvenCapitalMinorHigh: (shadowMinor * 2n).toString(),
      uncertaintyBps: 400,
      method: 'INTERPOLATED_SCALE_CURVE',
      netAlphaCrossesZero: true,
    });
  }

  const mid = (cross.low + cross.high) / 2n;
  const spreadBps = Math.min(
    800,
    Math.round((Number(cross.high - cross.low) / Number(shadowMinor)) * 10_000),
  );

  return Object.freeze({
    breakEvenCapitalMinorLow: cross.low.toString(),
    breakEvenCapitalMinorMid: mid.toString(),
    breakEvenCapitalMinorHigh: cross.high.toString(),
    uncertaintyBps: spreadBps,
    method: 'INTERPOLATED_SCALE_CURVE',
    netAlphaCrossesZero: true,
  });
}

export function estimateCapacityCeiling(
  scenarios: readonly CapitalScaleScenario[],
): CapacityCeilingEstimate {
  const permitted = scenarios.filter((row) => row.liquidityPermitted && row.netAlphaBps > 0);
  let maxMult: Alpha12CapitalScaleMultiplier | null = null;
  let maxCap: string | null = null;
  for (const row of permitted) {
    maxMult = row.scaleMultiplier;
    maxCap = row.deployedCapitalMinor;
  }

  const zeroApproach = scenarios.some((row) => row.liquidityPermitted && row.netAlphaBps <= 0);

  const viable = scenarios.filter((row) => row.liquidityPermitted);
  const low =
    viable.find((row) => row.netAlphaBps <= 25)?.deployedCapitalMinor ??
    viable[viable.length - 1]?.deployedCapitalMinor ??
    '0';
  const high =
    viable.find((row) => row.netAlphaBps <= 0)?.deployedCapitalMinor ??
    viable[viable.length - 1]?.deployedCapitalMinor ??
    '0';

  return Object.freeze({
    maxViableScaleMultiplier: maxMult,
    maxViableCapitalMinor: maxCap,
    ceilingCapitalMinorLow: low,
    ceilingCapitalMinorHigh: high,
    uncertaintyBps: zeroApproach ? 250 : 120,
    netEdgeApproachesZero: zeroApproach,
  });
}

export function classifyCapacity(
  shadowMinor: bigint,
  scenarios: readonly CapitalScaleScenario[],
): import('./taxonomy.ts').Alpha12CapacityClassification {
  if (scenarios.every((row) => !row.liquidityPermitted)) {
    return 'INSUFFICIENT_LIQUIDITY_DATA';
  }

  const netAt = (mult: number): number | null => {
    const row = scenarios.find((s) => s.scaleMultiplier === mult && s.liquidityPermitted);
    return row ? row.netAlphaBps : null;
  };

  const n1 = netAt(1);
  const n10 = netAt(10);
  const n50 = netAt(50);

  if (n1 !== null && n1 > 0 && (n10 === null || n10 <= 0)) {
    if (parseMinor(scenarios[0]!.deployedCapitalMinor) < 100_000_00n && shadowMinor < 1_000_000_00n) {
      return 'ECONOMICALLY_IMPOSSIBLE_AT_SCALE';
    }
    return 'MICRO_SCALABLE';
  }

  if (n50 !== null && n50 > 0) {
    return 'INSTITUTIONAL_SCALE_VIABLE';
  }
  if (n10 !== null && n10 > 0) {
    return 'MID_SCALE_VIABLE';
  }
  if (n1 !== null && n1 > 0) {
    return 'SMALL_SCALE_VIABLE';
  }
  return 'ECONOMICALLY_IMPOSSIBLE_AT_SCALE';
}

export function allScaleMultipliersPresent(
  scenarios: readonly CapitalScaleScenario[],
): boolean {
  return ALPHA12_CAPITAL_SCALE_MULTIPLIERS.every((mult) => scenarios.some((row) => row.scaleMultiplier === mult));
}
