import type { LovableGrowExperience, ProductGrowthPlan } from './types.ts';

export function toLovableExperience(plan: ProductGrowthPlan): LovableGrowExperience {
  const cash = plan.components.find((item) => item.kind === 'CASH_RESERVE_TARGET') ?? null;
  const investments = plan.components.find((item) => item.kind === 'ELIGIBLE_INVESTMENT_ALLOCATION') ?? null;
  const recurring = plan.components.find((item) => item.kind === 'RECURRING_SAVINGS') ?? null;
  const other = plan.components.filter(
    (item) =>
      item.kind !== 'CASH_RESERVE_TARGET' &&
      item.kind !== 'ELIGIBLE_INVESTMENT_ALLOCATION' &&
      item.kind !== 'RECURRING_SAVINGS',
  );
  return Object.freeze({
    schema: 'sunrey.lovable.grow-my-money.v1',
    iHave: plan.startingSnapshot.startingCapital,
    myGoal: plan.targetOutcome ?? null,
    timeHorizonMonths: plan.timeHorizonMonths,
    risk: plan.riskProfile,
    yourGrowthPlan: {
      cashReserve: cash,
      investments,
      recurringContributions: recurring,
      otherEligibleActions: Object.freeze(other),
    },
    scenarios: {
      conservative: plan.scenarioAnalysis.conservative,
      base: plan.scenarioAnalysis.base,
      upside: plan.scenarioAnalysis.upside,
    },
    uncertainty:
      'Conservative, base, and upside are illustrated ranges under catalog assumptions. They are not guaranteed outcomes.',
    guaranteedOutcome: false,
    productionActive: false,
  });
}
