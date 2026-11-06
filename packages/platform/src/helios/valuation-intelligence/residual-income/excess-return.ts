import type { ExcessReturnInput, ExcessReturnState } from './types.ts';
import { VAL07_RATE_BPS_SCALE } from './taxonomy.ts';

/**
 * Excess return on book equity — primary residual-income path for financial institutions.
 * Does not apply industrial net-debt / FCFF leverage heuristics.
 */
export function computeExcessReturnState(input: ExcessReturnInput): ExcessReturnState {
  const roeDecimal = input.roeBps / VAL07_RATE_BPS_SCALE;
  const keDecimal = input.costOfEquityBps / VAL07_RATE_BPS_SCALE;
  const excessReturn = (roeDecimal - keDecimal) * input.bookEquity;
  return Object.freeze({
    periodIndex: input.periodIndex,
    bookEquity: input.bookEquity,
    roeBps: input.roeBps,
    costOfEquityBps: input.costOfEquityBps,
    excessReturn,
    regulatoryCapitalRequired: input.regulatoryCapitalRequired ?? null,
    financialInstitution: input.isFinancialInstitution === true,
  });
}

export function intrinsicEquityFromExcessReturnStream(input: {
  readonly currentBookEquity: number;
  readonly periods: readonly ExcessReturnState[];
  readonly costOfEquityBps: number;
  readonly terminalExcessReturn?: number;
  readonly terminalGrowthBps?: number;
}): number {
  let pv = 0;
  for (const row of input.periods) {
    pv += row.excessReturn / (1 + input.costOfEquityBps / VAL07_RATE_BPS_SCALE) ** row.periodIndex;
  }
  const last = input.periods[input.periods.length - 1];
  if (last && input.terminalExcessReturn !== undefined) {
    const growth = input.terminalGrowthBps ?? 0;
    const rate = input.costOfEquityBps / VAL07_RATE_BPS_SCALE;
    const g = growth / VAL07_RATE_BPS_SCALE;
    if (rate > g) {
      const terminal = input.terminalExcessReturn / (rate - g);
      pv += terminal / (1 + rate) ** last.periodIndex;
    }
  }
  return input.currentBookEquity + pv;
}
