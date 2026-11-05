import type {
  DcfCapitalStructure,
  ExplicitYearForecast,
  ResolvedAssumptionDraw,
  SinglePathDcfResult,
  TerminalValueSpec,
  YearlyDcfPathRow,
} from './types.ts';

export type PathDrivers = ResolvedAssumptionDraw & {
  readonly baseRevenue: number;
  readonly forecastYears: number;
  readonly taxRate: number;
  readonly explicitForecasts?: readonly ExplicitYearForecast[];
  readonly terminal: TerminalValueSpec;
  readonly capitalStructure: DcfCapitalStructure;
  readonly roic?: number;
};

export function evaluateDcfPath(drivers: PathDrivers): SinglePathDcfResult {
  const notes: string[] = [];
  const yearly: YearlyDcfPathRow[] = [];
  let revenue = drivers.baseRevenue;
  const explicitByYear = mapExplicit(drivers.explicitForecasts);

  for (let year = 1; year <= drivers.forecastYears; year += 1) {
    const explicit = explicitByYear.get(year);
    if (explicit?.revenue !== undefined) {
      revenue = explicit.revenue;
    } else {
      revenue = revenue * (1 + drivers.revenueGrowth);
    }

    const margin = explicit?.margin ?? drivers.margin;
    const ebit = revenue * margin;
    const nopat = explicit?.nopat ?? ebit * (1 - drivers.taxRate);

    let reinvestmentRate = explicit?.reinvestmentRate ?? drivers.reinvestmentRate;
    if (drivers.roic !== undefined && explicit?.reinvestmentRate === undefined) {
      reinvestmentRate = clamp(drivers.revenueGrowth / Math.max(drivers.roic, 0.05), 0, 0.95);
    }
    const reinvestment = explicit?.reinvestment ?? nopat * reinvestmentRate;
    const fcff = explicit?.fcff ?? nopat - reinvestment;

    const interestRate = drivers.capitalStructure.interestRate ?? 0.04;
    const interest = drivers.capitalStructure.netDebt * interestRate;
    const interestAfterTax = interest * (1 - drivers.taxRate);
    const netDebtChange = drivers.capitalStructure.netDebtChangePerYear ?? 0;
    const fcfe = explicit?.fcfe ?? fcff - interestAfterTax + netDebtChange;

    const roicImplied =
      reinvestmentRate > 0 && nopat > 0 ? drivers.revenueGrowth / reinvestmentRate : drivers.roic ?? null;

    yearly.push(
      Object.freeze({
        yearIndex: year,
        revenue,
        margin,
        nopat,
        reinvestmentRate,
        reinvestment,
        roicImplied,
        fcff,
        fcfe,
      }),
    );
  }

  const terminalRow = yearly[yearly.length - 1]!;
  const terminalValue = computeTerminalValue({
    terminal: drivers.terminal,
    terminalRow,
    wacc: drivers.wacc,
    terminalGrowth: drivers.terminalGrowth,
    terminalMultiple: drivers.terminalMultiple,
    taxRate: drivers.taxRate,
    revenueGrowth: drivers.revenueGrowth,
    notes,
  });

  let pvExplicit = 0;
  for (const row of yearly) {
    pvExplicit += row.fcff / Math.pow(1 + drivers.wacc, row.yearIndex);
  }
  const pvTerminal = terminalValue / Math.pow(1 + drivers.wacc, drivers.forecastYears);
  const enterpriseValue = pvExplicit + pvTerminal;

  const netDebt = drivers.capitalStructure.netDebt;
  const cash = drivers.capitalStructure.cash ?? 0;
  const equityValue = enterpriseValue - netDebt + cash;
  const shares = Math.max(drivers.capitalStructure.sharesOutstanding, 1);
  const valuePerShare = equityValue / shares;

  return Object.freeze({
    yearly: Object.freeze(yearly),
    terminalValue,
    enterpriseValue,
    equityValue,
    valuePerShare,
    sampled: Object.freeze({
      revenueGrowth: drivers.revenueGrowth,
      margin: drivers.margin,
      reinvestmentRate: drivers.reinvestmentRate,
      wacc: drivers.wacc,
      terminalGrowth: drivers.terminalGrowth,
      terminalMultiple: drivers.terminalMultiple,
    }),
    constraintNotes: Object.freeze(notes),
  });
}

function computeTerminalValue(input: {
  readonly terminal: TerminalValueSpec;
  readonly terminalRow: YearlyDcfPathRow;
  readonly wacc: number;
  readonly terminalGrowth: number;
  readonly terminalMultiple: number;
  readonly taxRate: number;
  readonly revenueGrowth: number;
  readonly notes: string[];
}): number {
  if (input.terminal.method === 'EXIT_MULTIPLE') {
    const metric =
      input.terminal.metric === 'NOPAT' ? input.terminalRow.nopat : input.terminalRow.fcff;
    const multiple = input.terminal.terminalMultiple ?? input.terminalMultiple;
    return metric * multiple;
  }

  if (input.terminal.method === 'FADE_TO_MATURITY') {
    const last = applyFade({
      terminalRow: input.terminalRow,
      fade: input.terminal.fade,
      taxRate: input.taxRate,
      revenueGrowth: input.revenueGrowth,
    });
    if (input.terminal.terminalMethod === 'EXIT_MULTIPLE') {
      const metric = input.terminal.exitMetric === 'FCFF' ? last.fcff : last.nopat;
      const multiple = input.terminal.terminalMultiple ?? input.terminalMultiple;
      input.notes.push('fade_to_maturity then exit_multiple terminal');
      return metric * multiple;
    }
    const g = input.terminal.terminalGrowth ?? input.terminalGrowth;
    return terminalGrowthValue(last.fcff, input.wacc, g);
  }

  const g = input.terminal.terminalGrowth ?? input.terminalGrowth;
  return terminalGrowthValue(input.terminalRow.fcff, input.wacc, g);
}

function terminalGrowthValue(terminalFcff: number, wacc: number, terminalGrowth: number): number {
  const spread = wacc - terminalGrowth;
  if (spread <= 0.001) {
    return terminalFcff * 20;
  }
  return (terminalFcff * (1 + terminalGrowth)) / spread;
}

function applyFade(input: {
  readonly terminalRow: YearlyDcfPathRow;
  readonly fade: import('./types.ts').FadeToMaturitySpec;
  readonly taxRate: number;
  readonly revenueGrowth: number;
}): YearlyDcfPathRow {
  let revenue = input.terminalRow.revenue;
  let margin = input.terminalRow.margin;
  let reinvestmentRate = input.terminalRow.reinvestmentRate;
  const fadeYears = Math.max(1, input.fade.fadeYears);
  let lastRow = input.terminalRow;
  for (let i = 1; i <= fadeYears; i += 1) {
    const weight = i / fadeYears;
    const growth = lerp(input.revenueGrowth, input.fade.terminalGrowth, weight);
    revenue = revenue * (1 + growth);
    if (input.fade.terminalMargin !== undefined) {
      margin = lerp(margin, input.fade.terminalMargin, weight);
    }
    if (input.fade.terminalReinvestmentRate !== undefined) {
      reinvestmentRate = lerp(reinvestmentRate, input.fade.terminalReinvestmentRate, weight);
    }
    const nopat = revenue * margin * (1 - input.taxRate);
    const reinvestment = nopat * reinvestmentRate;
    const fcff = nopat - reinvestment;
    lastRow = Object.freeze({
      yearIndex: input.terminalRow.yearIndex + i,
      revenue,
      margin,
      nopat,
      reinvestmentRate,
      reinvestment,
      roicImplied: input.fade.terminalRoic ?? null,
      fcff,
      fcfe: fcff,
    });
  }
  return lastRow;
}

function mapExplicit(rows: readonly ExplicitYearForecast[] | undefined): Map<number, ExplicitYearForecast> {
  const map = new Map<number, ExplicitYearForecast>();
  for (const row of rows ?? []) {
    map.set(row.yearIndex, row);
  }
  return map;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
