import { Money } from '../../money/src/money.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import type { EconomicActivity } from './store.ts';
import type { SerializedMoney } from './taxonomy.ts';

export type CashFlowWindow = {
  readonly from: UtcInstant;
  readonly to: UtcInstant;
};

export type ProvenancedAmount = {
  readonly amount: SerializedMoney;
  readonly sourceRefs: readonly string[];
  readonly confidence: 'DERIVED';
};

export type CurrencyCashFlow = {
  readonly currency: string;
  readonly income: ProvenancedAmount;
  readonly recurringInflows: ProvenancedAmount;
  readonly recurringOutflows: ProvenancedAmount;
  readonly variableOutflows: ProvenancedAmount;
  readonly netFlow: ProvenancedAmount;
};

const INCOME_CLASSES = new Set([
  'SALARY',
  'FREELANCE',
  'BENEFITS',
  'INVESTMENT_INCOME',
  'BUSINESS_DISTRIBUTION',
]);

const RECURRING_OUTFLOW_CLASSES = new Set([
  'RENT',
  'SUBSCRIPTION',
  'LOAN_PAYMENT',
  'INSURANCE_PAYMENT',
]);

function emptyAmount(currency: string): ProvenancedAmount {
  return {
    amount: { minorUnits: '0', currency },
    sourceRefs: Object.freeze([]),
    confidence: 'DERIVED',
  };
}

function addActivity(current: ProvenancedAmount, activity: EconomicActivity): ProvenancedAmount {
  const money = Money.fromMinorUnitsString(current.amount.minorUnits, current.amount.currency).plus(
    Money.fromMinorUnitsString(activity.amount.minorUnits, activity.amount.currency),
  );
  return {
    amount: money.toJSON(),
    sourceRefs: Object.freeze([...current.sourceRefs, activity.sourceRef]),
    confidence: 'DERIVED',
  };
}

function subtractAmounts(left: ProvenancedAmount, right: ProvenancedAmount): ProvenancedAmount {
  const net = Money.fromMinorUnitsString(left.amount.minorUnits, left.amount.currency).minus(
    Money.fromMinorUnitsString(right.amount.minorUnits, right.amount.currency),
  );
  return {
    amount: net.toJSON(),
    sourceRefs: Object.freeze([...left.sourceRefs, ...right.sourceRefs]),
    confidence: 'DERIVED',
  };
}

function addAmounts(left: ProvenancedAmount, right: ProvenancedAmount): ProvenancedAmount {
  const sum = Money.fromMinorUnitsString(left.amount.minorUnits, left.amount.currency).plus(
    Money.fromMinorUnitsString(right.amount.minorUnits, right.amount.currency),
  );
  return {
    amount: sum.toJSON(),
    sourceRefs: Object.freeze([...left.sourceRefs, ...right.sourceRefs]),
    confidence: 'DERIVED',
  };
}

export function deriveCashFlow(
  activities: readonly EconomicActivity[],
  window: CashFlowWindow,
): readonly CurrencyCashFlow[] {
  const inWindow = activities.filter(
    (activity) => activity.occurredAt >= window.from && activity.occurredAt <= window.to,
  );
  const currencies = [...new Set(inWindow.map((activity) => activity.amount.currency))].sort();
  return Object.freeze(
    currencies.map((currency) => {
      const rows = inWindow.filter((activity) => activity.amount.currency === currency);
      let income = emptyAmount(currency);
      let recurringInflows = emptyAmount(currency);
      let recurringOutflows = emptyAmount(currency);
      let variableOutflows = emptyAmount(currency);
      let allInflows = emptyAmount(currency);
      let allOutflows = emptyAmount(currency);
      for (const activity of rows) {
        if (activity.direction === 'INFLOW') {
          allInflows = addActivity(allInflows, activity);
          if (INCOME_CLASSES.has(activity.classification)) {
            income = addActivity(income, activity);
          }
          if (INCOME_CLASSES.has(activity.classification)) {
            recurringInflows = addActivity(recurringInflows, activity);
          }
        } else {
          allOutflows = addActivity(allOutflows, activity);
          if (RECURRING_OUTFLOW_CLASSES.has(activity.classification)) {
            recurringOutflows = addActivity(recurringOutflows, activity);
          } else {
            variableOutflows = addActivity(variableOutflows, activity);
          }
        }
      }
      return Object.freeze({
        currency,
        income: Object.freeze(income),
        recurringInflows: Object.freeze(recurringInflows),
        recurringOutflows: Object.freeze(recurringOutflows),
        variableOutflows: Object.freeze(variableOutflows),
        netFlow: Object.freeze(subtractAmounts(allInflows, allOutflows)),
      });
    }),
  );
}

export function monthlyWindowContaining(at: UtcInstant): CashFlowWindow {
  const date = new Date(at);
  const from = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
  const to = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return {
    from: from.toISOString() as UtcInstant,
    to: to.toISOString() as UtcInstant,
  };
}

export function sumProvenanced(amounts: readonly ProvenancedAmount[], currency: string): ProvenancedAmount {
  return amounts
    .filter((item) => item.amount.currency === currency)
    .reduce((acc, item) => addAmounts(acc, item), emptyAmount(currency));
}
