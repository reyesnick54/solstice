import type { UtcInstant } from '../../domain/src/time.ts';
import type { CurrencyCashFlow, ProvenancedAmount } from './cash-flow.ts';
import { deriveCashFlow, monthlyWindowContaining } from './cash-flow.ts';
import type { RecurringPattern } from './recurring.ts';
import { detectRecurringPatterns } from './recurring.ts';
import type { EconomicActivity } from './store.ts';
import type { SerializedMoney } from './taxonomy.ts';

export type UpcomingObligation = {
  readonly label: string;
  readonly amount: SerializedMoney;
  readonly nextExpected: UtcInstant;
  readonly classification: string;
  readonly patternConfidence: 'LOW' | 'MEDIUM' | 'HIGH';
  readonly userCorrectable: true;
};

export type CurrencyCashFlowAnalysis = CurrencyCashFlow & {
  readonly mandatoryObligations: ProvenancedAmount;
  readonly discretionarySpending: ProvenancedAmount;
  readonly monthlySurplusOrDeficit: ProvenancedAmount;
  readonly cashReserveEstimate: ProvenancedAmount | null;
  readonly upcomingKnownObligations: readonly UpcomingObligation[];
};

export function analyzeCashFlow(input: {
  readonly activities: readonly EconomicActivity[];
  readonly at: UtcInstant;
  readonly cashByCurrency?: readonly SerializedMoney[];
  readonly patterns?: readonly RecurringPattern[];
}): readonly CurrencyCashFlowAnalysis[] {
  const window = monthlyWindowContaining(input.at);
  const flows = deriveCashFlow(input.activities, window);
  const patterns = input.patterns ?? detectRecurringPatterns(input.activities);
  const reserve = new Map((input.cashByCurrency ?? []).map((row) => [row.currency, row]));
  return Object.freeze(
    flows.map((flow) => {
      const upcoming = patterns
        .filter((pattern) => pattern.direction === 'OUTFLOW' && pattern.amount.currency === flow.currency)
        .map((pattern) =>
          Object.freeze({
            label: pattern.counterpartLabel ?? pattern.counterpartRef,
            amount: pattern.amount,
            nextExpected: pattern.nextExpected,
            classification: pattern.classification,
            patternConfidence: pattern.patternConfidence,
            userCorrectable: true as const,
          }),
        );
      return Object.freeze({
        ...flow,
        mandatoryObligations: flow.recurringOutflows,
        discretionarySpending: flow.variableOutflows,
        monthlySurplusOrDeficit: flow.netFlow,
        cashReserveEstimate: reserve.has(flow.currency)
          ? Object.freeze({
              amount: reserve.get(flow.currency)!,
              sourceRefs: Object.freeze(['ledger-backed-account']),
              confidence: 'DERIVED' as const,
            })
          : null,
        upcomingKnownObligations: Object.freeze(upcoming),
      });
    }),
  );
}
