import type { UtcInstant } from '../../../domain/src/time.ts';
import type { DailyCloseId } from '../ids.ts';
import type { ReconciliationBreak } from './breaks.ts';
import type { TreasuryLiquidityView } from './liquidity-view.ts';
import type { SuspenseItem } from './suspense.ts';

export type CurrencyTotal = {
  readonly currency: string;
  readonly customerLiabilityMinor: bigint;
  readonly ledgerControlMinor: bigint;
  readonly providerExpectedMinor: bigint;
  readonly providerReportedMinor: bigint | null;
  readonly feesMinor: bigint;
  readonly fxLongMinor: bigint;
  readonly fxShortMinor: bigint;
};

export type DailyCloseReport = {
  readonly closeId: DailyCloseId;
  readonly periodStart: UtcInstant;
  readonly periodEnd: UtcInstant;
  readonly generatedAt: UtcInstant;
  readonly legalSufficiency: 'NOT_A_REGULATORY_REPORT';
  readonly currencyTotals: readonly CurrencyTotal[];
  readonly ledgerJournalCount: number;
  readonly reconciliationBreaks: readonly ReconciliationBreak[];
  readonly openSuspense: readonly SuspenseItem[];
  readonly unsettledSettlementCount: number;
  readonly pendingHoldCount: number;
  readonly liquidity: readonly TreasuryLiquidityView[];
  readonly notes: readonly string[];
};

export function freezeDailyCloseReport(input: DailyCloseReport): DailyCloseReport {
  return Object.freeze({
    ...input,
    legalSufficiency: 'NOT_A_REGULATORY_REPORT',
    currencyTotals: Object.freeze([...input.currencyTotals]),
    reconciliationBreaks: Object.freeze([...input.reconciliationBreaks]),
    openSuspense: Object.freeze([...input.openSuspense]),
    liquidity: Object.freeze([...input.liquidity]),
    notes: Object.freeze([...input.notes]),
  });
}
