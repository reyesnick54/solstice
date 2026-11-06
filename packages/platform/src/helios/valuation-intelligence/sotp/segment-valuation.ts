/**
 * Per-segment valuation — independent method selection and scenario-weighted outputs.
 */

import type { SegmentValuationMethod } from './taxonomy.ts';
import type {
  SegmentForecast,
  SegmentValuation,
  SegmentValuationSpec,
  SegmentValueDistribution,
} from './types.ts';

const BPS = 10_000;

function ratioFromBps(bps: number): number {
  return bps / BPS;
}

function discountMinor(cashflows: readonly bigint[], discountBps: number, terminalGrowthBps: number): bigint {
  const r = ratioFromBps(discountBps);
  const g = ratioFromBps(terminalGrowthBps);
  if (cashflows.length === 0) {
    return 0n;
  }
  let pv = 0;
  for (let i = 0; i < cashflows.length; i++) {
    const cf = Number(cashflows[i]);
    pv += cf / (1 + r) ** (i + 1);
  }
  const terminal = Number(cashflows[cashflows.length - 1]!);
  if (r > g && terminal !== 0) {
    pv += (terminal * (1 + g)) / (r - g) / (1 + r) ** cashflows.length;
  }
  return BigInt(Math.round(pv));
}

function distributionFromScenarios(
  stableSegmentKey: string,
  method: SegmentValuationMethod,
  currency: string,
  values: readonly { readonly scenarioId: string; readonly valueMinor: bigint; readonly weight: number }[],
): SegmentValueDistribution {
  const sorted = [...values].sort((a, b) => (a.valueMinor < b.valueMinor ? -1 : 1));
  const pick = (pct: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(pct * sorted.length)))]!.valueMinor;
  return Object.freeze({
    stableSegmentKey,
    method,
    currency,
    p05Minor: pick(0.05),
    p25Minor: pick(0.25),
    medianMinor: pick(0.5),
    p75Minor: pick(0.75),
    p95Minor: pick(0.95),
    scenarioBreakdown: Object.freeze([...values]),
    notAFact: true,
    researchOnly: true,
  });
}

function valueForScenario(spec: SegmentValuationSpec, scenarioId: string): bigint {
  const forecast = spec.forecast;
  if (forecast && forecast.scenarioWeights.length > 0) {
    const allowed = forecast.scenarioWeights.some((row) => row.scenarioId === scenarioId);
    if (!allowed && scenarioId !== 'BASE') {
      return 0n;
    }
  }

  const scenarioScale = scenarioId === 'DOWNSIDE' ? 0.85 : 1;

  switch (spec.method) {
    case 'DCF_FCFF': {
      const flows = forecast?.explicitFcffMinor ?? [];
      const raw = discountMinor(
        flows,
        forecast?.discountRateBps ?? 900,
        forecast?.terminalGrowthBps ?? 200,
      );
      return BigInt(Math.round(Number(raw) * scenarioScale));
    }
    case 'DCF_FCFE': {
      const flows = forecast?.explicitFcfeMinor ?? [];
      return discountMinor(
        flows,
        forecast?.discountRateBps ?? 950,
        forecast?.terminalGrowthBps ?? 200,
      );
    }
    case 'RESIDUAL_INCOME': {
      const book = spec.profile?.assetsMinor ?? spec.assetBaseMinor ?? 0n;
      const earnings = spec.profile?.operatingIncomeMinor ?? 0n;
      return book + earnings * 8n;
    }
    case 'COMPARABLE_MULTIPLES': {
      const metric = spec.comparableMetricMinor ?? spec.profile?.revenueMinor ?? 0n;
      const multiple = BigInt(Math.max(0, spec.comparableMultipleBps ?? 300));
      return (metric * multiple) / BigInt(BPS);
    }
    case 'ASSET_BASED':
      return spec.assetBaseMinor ?? spec.profile?.assetsMinor ?? 0n;
    case 'DIVIDEND_DISCOUNT': {
      const div = spec.dividendCapacityMinor ?? 0n;
      const r = forecast?.discountRateBps ?? 900;
      const g = forecast?.terminalGrowthBps ?? 200;
      if (r <= g) {
        return div * 15n;
      }
      const cap = Number(div) * (1 + ratioFromBps(g)) / (ratioFromBps(r) - ratioFromBps(g));
      return BigInt(Math.round(cap));
    }
    default:
      return 0n;
  }
}

export function valueSegment(spec: SegmentValuationSpec, currency: string, intersegmentAdj: bigint): SegmentValuation {
  const scenarios =
    spec.forecast?.scenarioWeights.length
      ? spec.forecast.scenarioWeights
      : Object.freeze([Object.freeze({ scenarioId: 'BASE', label: 'Base', weight: 1 })]);

  const breakdown = scenarios.map((row) =>
    Object.freeze({
      scenarioId: row.scenarioId,
      valueMinor: valueForScenario(spec, row.scenarioId),
      weight: row.weight,
    }),
  );

  let weighted = 0;
  let weightSum = 0;
  for (const row of breakdown) {
    weighted += Number(row.valueMinor) * row.weight;
    weightSum += row.weight;
  }
  const enterprise = BigInt(Math.round(weightSum > 0 ? weighted / weightSum : 0));

  const distribution = distributionFromScenarios(spec.stableSegmentKey, spec.method, currency, breakdown);

  const rationale: string[] = [`method:${spec.method}`];
  if (spec.forecast?.driverTree) {
    rationale.push('driver_tree_attached');
  }
  if (spec.forecast?.evidenceDriverIds.length) {
    rationale.push('evidence_backed_drivers');
  }

  return Object.freeze({
    stableSegmentKey: spec.stableSegmentKey,
    method: spec.method,
    enterpriseValueMinor: enterprise - intersegmentAdj,
    equityValueMinor: null,
    distribution,
    methodRationale: Object.freeze(rationale),
    intersegmentAdjustmentMinor: intersegmentAdj,
  });
}
