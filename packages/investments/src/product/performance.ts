/**
 * Portfolio performance engine.
 *
 * Authoritative calculator: this module. LLMs must not calculate
 * authoritative performance.
 *
 * Money stays in integer minor units. Period return is integer basis
 * points (1 bp = 0.01 percentage point). There is no floating-point
 * path and no blended yield / APY / APR field.
 *
 * ## Time-weighted return (TWR_LINKED_SUBPERIODS)
 *
 * External cash flows (deposits / withdrawals) are placed at sub-period
 * boundaries. Income earned by holdings is part of ending market value
 * and is not an external cash flow.
 *
 * For sub-period i:
 *
 *     1 + r_i = EMV_i / BMV_i
 *
 * where BMV_i is market value immediately after any opening cash flow
 * of that sub-period, and EMV_i is market value at the next boundary
 * before the next external cash flow.
 *
 * Linked TWR:
 *
 *     1 + TWR = Π_i (1 + r_i)
 *     periodReturnBps = floor((Π num_i / Π den_i) * 10000) - 10000
 *
 * A zero BMV sub-period is skipped (undefined return; do not invent one).
 *
 * ## Modified Dietz (MODIFIED_DIETZ)
 *
 * Money-weighted approximation for the whole period:
 *
 *     r = (EMV - BMV - CF) / (BMV + Σ_j w_j * CF_j)
 *     w_j = (T - t_j) / T
 *
 * T is the calendar-day span of the period. t_j is days from start to
 * cash flow j. A same-day period uses T = 1 so weights stay defined.
 * CF is signed: deposits positive, withdrawals negative.
 *
 * Absolute return = EMV - BMV - CF (Money). This is not a percentage.
 */

import { Money } from '../../../money/src/money.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import { linkedReturnBps, mulRatio, ratio, ratioToBps, utcDaySpan, type Ratio } from './ratio.ts';
import { asPerformanceReportId, type PerformanceReportId } from './ids.ts';
import type { CashFlowKind, PerformanceMethod } from './types.ts';

export type PerformanceCashFlow = {
  readonly at: UtcInstant;
  readonly amount: Money;
  readonly kind: CashFlowKind;
};

export type ValuationPoint = {
  readonly at: UtcInstant;
  readonly marketValue: Money;
  readonly cash: Money;
};

export type BenchmarkPoint = {
  readonly benchmarkId: string;
  readonly periodReturnBps: bigint;
  readonly source: string;
};

export type PerformanceReport = {
  readonly reportId: PerformanceReportId;
  readonly methodology: PerformanceMethod;
  readonly formula: string;
  readonly currency: string;
  readonly from: UtcInstant;
  readonly to: UtcInstant;
  readonly beginningMarketValue: Money;
  readonly endingMarketValue: Money;
  readonly absoluteReturn: Money;
  readonly periodReturnBps: bigint | null;
  readonly realized: Money;
  readonly unrealized: Money;
  readonly income: Money;
  readonly externalCashFlow: Money;
  readonly cashFlows: readonly PerformanceCashFlow[];
  readonly benchmark: {
    readonly benchmarkId: string;
    readonly periodReturnBps: bigint;
    readonly deltaBps: bigint | null;
    readonly source: string;
  } | null;
  readonly observations: bigint;
  readonly insufficientData: boolean;
  readonly authoritativeCalculator: 'INVESTMENT_PERFORMANCE_ENGINE';
  readonly llmAuthoritative: false;
  readonly taxAdvice: false;
};

const TWR_FORMULA =
  '1+r_i = EMV_i / BMV_i after boundary cash flows; 1+TWR = product(1+r_i); periodReturnBps = floor((1+TWR)*10000)-10000';
const DIETZ_FORMULA =
  'r = (EMV - BMV - CF) / (BMV + sum(w_j*CF_j)); w_j = (T - t_j) / T; periodReturnBps = floor(r*10000)';

function isExternal(kind: CashFlowKind): boolean {
  return kind === 'DEPOSIT' || kind === 'WITHDRAWAL';
}

function signedExternal(flow: PerformanceCashFlow): Money {
  if (flow.kind === 'DEPOSIT') {
    return flow.amount;
  }
  if (flow.kind === 'WITHDRAWAL') {
    return flow.amount.negate();
  }
  return Money.zero(flow.amount.currency);
}

function totalValue(point: ValuationPoint): Money {
  return point.marketValue.plus(point.cash);
}

export function computePerformance(input: {
  readonly from: UtcInstant;
  readonly to: UtcInstant;
  readonly points: readonly ValuationPoint[];
  readonly cashFlows: readonly PerformanceCashFlow[];
  readonly realized: Money;
  readonly unrealized: Money;
  readonly income: Money;
  readonly methodology?: PerformanceMethod;
  readonly benchmark?: BenchmarkPoint;
}): PerformanceReport {
  const currency = input.realized.currency;
  const points = [...input.points].sort((a, b) => (a.at < b.at ? -1 : 1));
  const flows = [...input.cashFlows].filter((row) => row.at >= input.from && row.at <= input.to);
  const start = points[0];
  const end = points[points.length - 1];
  if (!start || !end) {
    return freezeReport({
      reportId: asPerformanceReportId(`perf_${input.from}_${input.to}`),
      methodology: input.methodology ?? 'TWR_LINKED_SUBPERIODS',
      formula: input.methodology === 'MODIFIED_DIETZ' ? DIETZ_FORMULA : TWR_FORMULA,
      currency,
      from: input.from,
      to: input.to,
      beginningMarketValue: Money.zero(currency),
      endingMarketValue: Money.zero(currency),
      absoluteReturn: Money.zero(currency),
      periodReturnBps: null,
      realized: input.realized,
      unrealized: input.unrealized,
      income: input.income,
      externalCashFlow: Money.zero(currency),
      cashFlows: flows,
      benchmark: null,
      observations: 0n,
      insufficientData: true,
      authoritativeCalculator: 'INVESTMENT_PERFORMANCE_ENGINE',
      llmAuthoritative: false,
      taxAdvice: false,
    });
  }
  const bmv = totalValue(start);
  const emv = totalValue(end);
  const external = flows.filter((row) => isExternal(row.kind));
  const cf = external.reduce((sum, row) => sum.plus(signedExternal(row)), Money.zero(currency));
  const absolute = emv.minus(bmv).minus(cf);
  const methodology = input.methodology ?? 'TWR_LINKED_SUBPERIODS';
  const periodReturnBps =
    methodology === 'MODIFIED_DIETZ'
      ? modifiedDietzBps(bmv, emv, external, input.from, input.to)
      : twrBps(points, external, currency);
  const benchmark = input.benchmark
    ? {
        benchmarkId: input.benchmark.benchmarkId,
        periodReturnBps: input.benchmark.periodReturnBps,
        deltaBps: periodReturnBps === null ? null : periodReturnBps - input.benchmark.periodReturnBps,
        source: input.benchmark.source,
      }
    : null;
  return freezeReport({
    reportId: asPerformanceReportId(`perf_${input.from}_${input.to}`),
    methodology,
    formula: methodology === 'MODIFIED_DIETZ' ? DIETZ_FORMULA : TWR_FORMULA,
    currency,
    from: input.from,
    to: input.to,
    beginningMarketValue: bmv,
    endingMarketValue: emv,
    absoluteReturn: absolute,
    periodReturnBps,
    realized: input.realized,
    unrealized: input.unrealized,
    income: input.income,
    externalCashFlow: cf,
    cashFlows: flows,
    benchmark,
    observations: BigInt(points.length),
    insufficientData: periodReturnBps === null,
    authoritativeCalculator: 'INVESTMENT_PERFORMANCE_ENGINE',
    llmAuthoritative: false,
    taxAdvice: false,
  });
}

function twrBps(
  points: readonly ValuationPoint[],
  flows: readonly PerformanceCashFlow[],
  currency: string,
): bigint | null {
  const events = [
    ...points.map((point) => ({ at: point.at, kind: 'VALUE' as const, value: totalValue(point) })),
    ...flows.map((flow) => ({ at: flow.at, kind: 'FLOW' as const, value: signedExternal(flow) })),
  ].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.kind === 'VALUE' ? -1 : 1));
  let linked: Ratio = ratio(1n, 1n);
  let periods = 0n;
  let current: Money | null = null;
  for (const event of events) {
    if (event.kind === 'VALUE') {
      if (current !== null && current.minorUnits > 0n) {
        linked = mulRatio(linked, ratio(event.value.minorUnits, current.minorUnits));
        periods += 1n;
      }
      current = event.value;
    } else if (current !== null) {
      current = current.plus(event.value);
    } else {
      current = event.value.currency === currency ? event.value : Money.zero(currency);
    }
  }
  if (periods === 0n) {
    return null;
  }
  return linkedReturnBps(linked);
}

function modifiedDietzBps(
  bmv: Money,
  emv: Money,
  flows: readonly PerformanceCashFlow[],
  from: UtcInstant,
  to: UtcInstant,
): bigint | null {
  let span = utcDaySpan(from, to);
  if (span === 0n) {
    span = 1n;
  }
  let weighted = 0n;
  let cf = 0n;
  for (const flow of flows) {
    const signed = signedExternal(flow).minorUnits;
    cf += signed;
    const elapsed = utcDaySpan(from, flow.at);
    const remaining = span > elapsed ? span - elapsed : 0n;
    weighted += signed * remaining;
  }
  const denominator = bmv.minorUnits * span + weighted;
  if (denominator === 0n) {
    return null;
  }
  const numerator = (emv.minorUnits - bmv.minorUnits - cf) * 10_000n * span;
  return numerator / denominator;
}

function freezeReport(report: PerformanceReport): PerformanceReport {
  return Object.freeze({
    ...report,
    cashFlows: Object.freeze([...report.cashFlows]),
    benchmark: report.benchmark ? Object.freeze({ ...report.benchmark }) : null,
  });
}

export function simplePeriodReturnBps(beginning: Money, ending: Money): bigint | null {
  if (beginning.minorUnits === 0n) {
    return null;
  }
  return ratioToBps(ratio(ending.minorUnits - beginning.minorUnits, beginning.minorUnits));
}
