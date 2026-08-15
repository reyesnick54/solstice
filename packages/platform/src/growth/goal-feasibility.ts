import { Money } from '../../../money/src/money.ts';
import type { PersonalEconomicSnapshot } from '../../../personal-economic-graph/src/snapshot.ts';
import type { CompiledEconomicMandate, MandateGoal, SerializedMoney } from '../mandate/types.ts';
import { liquidForCurrency } from './feasibility.ts';
import type { GoalFeasibility } from './types.ts';

function moneyOf(amount: SerializedMoney): Money {
  return Money.fromMinorUnitsString(amount.minorUnits, amount.currency);
}

function requiredChange(goal: MandateGoal): SerializedMoney | undefined {
  if (!goal.target || !goal.baseline) {
    return undefined;
  }
  const target = moneyOf(goal.target);
  const baseline = moneyOf(goal.baseline);
  return target.minus(baseline).toJSON();
}

export function evaluateGoalFeasibility(
  mandate: CompiledEconomicMandate,
  snapshot: PersonalEconomicSnapshot,
): readonly GoalFeasibility[] {
  const results: GoalFeasibility[] = [];
  for (const goal of mandate.goals) {
    if (goal.kind === 'AGGRESSIVE_SHORT_HORIZON_GROWTH') {
      const change = requiredChange(goal);
      const days = goal.timeHorizon?.kind === 'DURATION_DAYS' ? goal.timeHorizon.days : undefined;
      results.push({
        goalId: goal.goalId,
        state: 'INFEASIBLE_WITH_CURRENT_FACTS',
        ...(change ? { requiredChange: change } : {}),
        limitations: Object.freeze([
          'Required change is computed from the stated baseline and target only.',
          'No deterministic trading or investment method is available.',
          days !== undefined
            ? `Horizon is ${String(days)} days; investment execution is not implemented.`
            : 'Horizon is short; investment execution is not implemented.',
        ]),
        uncertaintyNotes: Object.freeze([
          'Outcome depends on unimplemented market capabilities.',
          'Achievement is not promised.',
        ]),
        achievementPromised: false,
        investmentExecutionAvailable: false,
      });
      continue;
    }

    if (goal.kind === 'MAINTAIN_TARGET_LIQUIDITY' && goal.target) {
      const liquid = liquidForCurrency(snapshot, goal.currency);
      const target = moneyOf(goal.target);
      const onTrack = liquid.cmp(target) >= 0;
      results.push({
        goalId: goal.goalId,
        state: onTrack ? 'ON_TRACK' : 'AT_RISK',
        requiredChange: onTrack ? Money.zero(goal.currency).toJSON() : target.minus(liquid).toJSON(),
        limitations: Object.freeze(['Liquidity is derived from PEG facts; the ledger remains authoritative.']),
        uncertaintyNotes: Object.freeze([]),
        achievementPromised: false,
        investmentExecutionAvailable: false,
      });
      continue;
    }

    if (goal.kind === 'BUILD_EMERGENCY_RESERVE' && goal.target) {
      const liquid = liquidForCurrency(snapshot, goal.currency);
      const target = moneyOf(goal.target);
      const gap = target.minus(liquid);
      const state = gap.isPositive()
        ? snapshot.income.length === 0
          ? 'INSUFFICIENT_DATA'
          : 'AT_RISK'
        : 'ON_TRACK';
      results.push({
        goalId: goal.goalId,
        state,
        requiredChange: (gap.isPositive() ? gap : Money.zero(goal.currency)).toJSON(),
        limitations: Object.freeze([
          'Emergency-reserve progress uses current derived liquidity, not a promised path.',
        ]),
        uncertaintyNotes: Object.freeze(['Future surplus is not guaranteed.']),
        achievementPromised: false,
        investmentExecutionAvailable: false,
      });
      continue;
    }

    if (goal.kind === 'REDUCE_DEBT') {
      const hasDebt = snapshot.debt.length > 0;
      results.push({
        goalId: goal.goalId,
        state: hasDebt ? 'AT_RISK' : 'INSUFFICIENT_DATA',
        limitations: Object.freeze([
          hasDebt
            ? 'Debt reduction can be proposed only from known balances and surplus.'
            : 'No debt balance facts are available.',
        ]),
        uncertaintyNotes: Object.freeze([]),
        achievementPromised: false,
        investmentExecutionAvailable: false,
      });
      continue;
    }

    results.push({
      goalId: goal.goalId,
      state: 'INSUFFICIENT_DATA',
      limitations: Object.freeze(['Goal is recorded; current facts are not sufficient to score progress.']),
      uncertaintyNotes: Object.freeze([]),
      achievementPromised: false,
      investmentExecutionAvailable: false,
    });
  }
  return Object.freeze(results);
}
