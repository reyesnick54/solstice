import type { UtcInstant } from '../../domain/src/time.ts';
import { Money } from '../../money/src/money.ts';
import type { EconomicGraphId } from './ids.ts';
import type { SuitabilityProfile } from './suitability.ts';
import type { CurrencyCashFlow } from './cash-flow.ts';
import type { EconomicNode } from './node.ts';
import type { InsightSeverity, InsightType, SerializedMoney } from './taxonomy.ts';

export type DerivedInsight = {
  readonly insightId: string;
  readonly graphId: EconomicGraphId;
  readonly type: InsightType;
  readonly severity: InsightSeverity;
  readonly evidence: readonly string[];
  readonly calculatedAt: UtcInstant;
  readonly inputs: Readonly<Record<string, string>>;
  readonly confidence: 'DERIVED';
  readonly recommendation: null;
};

export type InsightInputs = {
  readonly graphId: EconomicGraphId;
  readonly at: UtcInstant;
  readonly nodes: readonly EconomicNode[];
  readonly cashByCurrency: readonly SerializedMoney[];
  readonly cashFlow: readonly CurrencyCashFlow[];
  readonly suitability: SuitabilityProfile | null;
};

function moneyOf(value: SerializedMoney): bigint {
  return BigInt(value.minorUnits);
}

function insightId(type: InsightType, currency: string): string {
  return `peg_i_${type.toLowerCase()}_${currency.toLowerCase()}`;
}

function insight(
  graphId: EconomicGraphId,
  type: InsightType,
  severity: InsightSeverity,
  at: UtcInstant,
  evidence: readonly string[],
  inputs: Record<string, string>,
  currency = 'USD',
): DerivedInsight {
  return Object.freeze({
    insightId: insightId(type, currency),
    graphId,
    type,
    severity,
    evidence: Object.freeze([...evidence]),
    calculatedAt: at,
    inputs: Object.freeze({ ...inputs }),
    confidence: 'DERIVED',
    recommendation: null,
  });
}

/**
 * Deterministic derived insights. Not growth recommendations (Phase E Prompt 2).
 */
export function deriveInsights(input: InsightInputs): readonly DerivedInsight[] {
  const out: DerivedInsight[] = [];
  const cashByCurrency = new Map(input.cashByCurrency.map((row) => [row.currency, moneyOf(row)]));

  for (const flow of input.cashFlow) {
    const cash = cashByCurrency.get(flow.currency) ?? 0n;
    const income = moneyOf(flow.income.amount);
    const recurring = moneyOf(flow.recurringOutflows.amount);
    const net = moneyOf(flow.netFlow.amount);
    const reserveTarget = income * 3n;

    if (cash > income * 6n && income > 0n) {
      out.push(
        insight(
          input.graphId,
          'HIGH_IDLE_CASH',
          'WATCH',
          input.at,
          [`cash ${cash.toString()} ${flow.currency} exceeds six months of recognized income`],
          {
            cash: cash.toString(),
            income: income.toString(),
            currency: flow.currency,
          },
          flow.currency,
        ),
      );
    }

    if (income > 0n && cash < reserveTarget) {
      out.push(
        insight(
          input.graphId,
          'INSUFFICIENT_EMERGENCY_RESERVE',
          cash === 0n ? 'HIGH' : 'ATTENTION',
          input.at,
          [`cash ${cash.toString()} is below a three-month income reserve of ${reserveTarget.toString()} ${flow.currency}`],
          {
            cash: cash.toString(),
            reserveTarget: reserveTarget.toString(),
            currency: flow.currency,
          },
          flow.currency,
        ),
      );
    }

    if (income > 0n && recurring * 2n > income) {
      out.push(
        insight(
          input.graphId,
          'LARGE_RECURRING_EXPENSE',
          'ATTENTION',
          input.at,
          [`recurring outflows ${recurring.toString()} are more than half of recognized income`],
          {
            recurring: recurring.toString(),
            income: income.toString(),
            currency: flow.currency,
          },
          flow.currency,
        ),
      );
    }

    if (net < 0n) {
      out.push(
        insight(
          input.graphId,
          'CASH_FLOW_DEFICIT',
          'HIGH',
          input.at,
          [`monthly net flow ${net.toString()} ${flow.currency} is negative`],
          { net: net.toString(), currency: flow.currency },
          flow.currency,
        ),
      );
    }

    if (net > 0n && cash > reserveTarget && reserveTarget > 0n) {
      out.push(
        insight(
          input.graphId,
          'UNUSED_RECURRING_SURPLUS',
          'INFO',
          input.at,
          [`monthly surplus ${net.toString()} ${flow.currency} sits above a funded reserve`],
          { surplus: net.toString(), currency: flow.currency },
          flow.currency,
        ),
      );
    }
  }

  const goals = input.nodes.filter((node) => node.kind === 'GOAL' && node.attributes.kind === 'GOAL');
  for (const goal of goals) {
    if (goal.attributes.kind !== 'GOAL' || goal.attributes.status !== 'ACTIVE') {
      continue;
    }
    const allocated = goal.attributes.currentAllocatedValue
      ? Money.fromMinorUnitsString(
          goal.attributes.currentAllocatedValue.minorUnits,
          goal.attributes.currentAllocatedValue.currency,
        )
      : Money.fromMinorUnits(0n, goal.attributes.target.currency);
    const target = Money.fromMinorUnitsString(goal.attributes.target.minorUnits, goal.attributes.target.currency);
    if (allocated.currency === target.currency && allocated.minorUnits < target.minorUnits) {
      out.push(
        insight(
          input.graphId,
          'GOAL_FUNDING_GAP',
          'WATCH',
          input.at,
          [`goal ${goal.attributes.label} is below target`],
          {
            goalId: goal.nodeId,
            allocated: allocated.minorUnits.toString(),
            target: target.minorUnits.toString(),
            currency: target.currency,
          },
          target.currency,
        ),
      );
    }
  }

  if (input.suitability?.concentration === 'HIGHLY_CONCENTRATED' || input.suitability?.concentration === 'CONCENTRATED') {
    out.push(
      insight(
        input.graphId,
        'HIGH_CONCENTRATION',
        input.suitability.concentration === 'HIGHLY_CONCENTRATED' ? 'ATTENTION' : 'WATCH',
        input.at,
        [`suitability concentration is ${input.suitability.concentration}`],
        { concentration: input.suitability.concentration },
      ),
    );
  }

  if (cashByCurrency.size >= 2) {
    const totalAbs = [...cashByCurrency.values()].reduce((acc, value) => acc + (value < 0n ? -value : value), 0n);
    for (const [currency, amount] of cashByCurrency) {
      if (totalAbs > 0n && amount * 100n >= totalAbs * 80n) {
        out.push(
          insight(
            input.graphId,
            'CURRENCY_CONCENTRATION',
            'WATCH',
            input.at,
            [`${currency} is at least 80% of reported cash by raw minor-unit share; this is not an FX-converted total`],
            { currency, amount: amount.toString() },
            currency,
          ),
        );
      }
    }
  }

  return Object.freeze(out);
}
