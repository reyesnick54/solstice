import { Money } from '../../../../money/src/money.ts';
import type { PersonalEconomicSnapshot } from '../../../../personal-economic-graph/src/snapshot.ts';
import type { CompiledEconomicMandate } from '../../mandate/types.ts';
import type { DetectorFinding, GoalLink } from './types.ts';
import { liquidPositions } from './detectors.ts';
import type { OpportunityDiscoveryContext } from './types.ts';

function monthsUntil(now: string, targetDate: string | null | undefined): number | undefined {
  if (!targetDate) {
    return undefined;
  }
  const start = Date.parse(now);
  const end = Date.parse(targetDate);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return undefined;
  }
  return Math.max(1, Math.ceil((end - start) / (30 * 24 * 60 * 60 * 1000)));
}

export function goalLinksFor(
  finding: DetectorFinding,
  snapshot: PersonalEconomicSnapshot,
  context: OpportunityDiscoveryContext,
  mandate?: CompiledEconomicMandate,
): readonly GoalLink[] {
  const links: GoalLink[] = [];
  const { liquid } = liquidPositions(snapshot, context, finding.currency);
  const flow = snapshot.monthlyCashFlow.find((item) => item.currency === finding.currency);
  const surplus = flow
    ? Money.fromMinorUnitsString(flow.netFlow.amount.minorUnits, flow.netFlow.amount.currency)
    : Money.zero(finding.currency);

  for (const goalId of finding.goalIds) {
    const mandateGoal = mandate?.goals.find((item) => item.goalId === goalId);
    const pegGoal = snapshot.goals.find((item) => item.nodeId === goalId);
    const label = mandateGoal?.label ?? pegGoal?.label ?? goalId;
    const target = mandateGoal?.target ?? pegGoal?.target;
    const baseline = mandateGoal?.baseline;
    const date = mandateGoal?.timeHorizon?.date ?? pegGoal?.targetDate ?? null;
    const funded = baseline
      ? Money.fromMinorUnitsString(baseline.minorUnits, baseline.currency)
      : liquid;
    if (!target || target.currency !== finding.currency) {
      links.push({
        goalId,
        label,
        availableSurplus: surplus.toJSON(),
        achievementPromised: false,
      });
      continue;
    }
    const targetMoney = Money.fromMinorUnitsString(target.minorUnits, target.currency);
    const gap = targetMoney.cmp(funded) > 0 ? targetMoney.minus(funded) : Money.zero(finding.currency);
    const months = monthsUntil(context.now, date);
    const monthlyRequired = months
      ? Money.fromMinorUnits((gap.minorUnits + BigInt(months) - 1n) / BigInt(months), finding.currency)
      : undefined;
    const shortfall =
      monthlyRequired && surplus.cmp(monthlyRequired) < 0 ? monthlyRequired.minus(surplus) : Money.zero(finding.currency);
    links.push({
      goalId,
      label,
      ...(monthlyRequired ? { monthlyRequiredContribution: monthlyRequired.toJSON() } : {}),
      currentFunding: funded.toJSON(),
      projectedShortfall: shortfall.toJSON(),
      availableSurplus: surplus.toJSON(),
      achievementPromised: false,
    });
  }
  return Object.freeze(links);
}
