import { Money } from '../../../money/src/money.ts';
import type { PersonalEconomicSnapshot } from '../../../personal-economic-graph/src/snapshot.ts';
import type { CompiledEconomicMandate, HardConstraint, SerializedMoney } from '../mandate/types.ts';
import type { PolicyControlPort } from '../policy-port.ts';
import type { FeasibilityResult, GrowthActionCandidate, PlanningContext } from './types.ts';
import type { FeasibilityRejectionReason } from './taxonomy.ts';

function moneyOf(amount: SerializedMoney): Money {
  return Money.fromMinorUnitsString(amount.minorUnits, amount.currency);
}

export function liquidForCurrency(snapshot: PersonalEconomicSnapshot, currency: string): Money {
  let total = Money.zero(currency);
  for (const item of snapshot.liquidAssetsByCurrency) {
    if (item.amount.currency === currency) {
      total = total.plus(moneyOf(item.amount));
    }
  }
  return total;
}

export function constraintAmount(
  mandate: CompiledEconomicMandate,
  kind: HardConstraint['kind'],
): Money | undefined {
  const found = mandate.hardConstraints.find((item) => item.kind === kind && item.amount);
  return found?.amount ? moneyOf(found.amount) : undefined;
}

export function evaluateCandidateFeasibility(input: {
  readonly candidate: GrowthActionCandidate;
  readonly mandate: CompiledEconomicMandate;
  readonly snapshot: PersonalEconomicSnapshot;
  readonly policy: PolicyControlPort;
  readonly planning: PlanningContext;
}): FeasibilityResult {
  const reasons: FeasibilityRejectionReason[] = [];
  const notes: string[] = [];
  const candidate = input.candidate;
  const currency = input.mandate.currency;
  const liquid = liquidForCurrency(input.snapshot, currency);
  const floor = constraintAmount(input.mandate, 'NEVER_SPEND_BELOW_LIQUIDITY_FLOOR')
    ?? constraintAmount(input.mandate, 'MINIMUM_CASH_RESERVE');
  const proposed = candidate.proposedAmount ? moneyOf(candidate.proposedAmount) : Money.zero(currency);
  const liquidityImpact = moneyOf(candidate.liquidityImpact);

  if (proposed.currency !== currency || liquidityImpact.currency !== currency) {
    reasons.push('CURRENCY_CONSTRAINT');
    notes.push('candidate currency does not match the active mandate');
  }

  if (floor && liquidityImpact.isNegative()) {
    const remaining = liquid.plus(liquidityImpact);
    if (remaining.cmp(floor) < 0) {
      reasons.push('LIQUIDITY_FLOOR');
      notes.push('action would spend below the mandate liquidity floor');
    }
  }

  const protectedAccounts = input.mandate.hardConstraints.find((item) => item.kind === 'PROTECTED_ACCOUNTS');
  if (
    protectedAccounts?.accountIds &&
    candidate.sourceAccountId &&
    protectedAccounts.accountIds.includes(candidate.sourceAccountId)
  ) {
    reasons.push('PROTECTED_FUNDS');
    notes.push('source account is protected by the mandate');
  }

  const protectedCurrencies = input.mandate.hardConstraints.find((item) => item.kind === 'PROTECTED_CURRENCIES');
  if (protectedCurrencies?.currencies?.includes(currency) && liquidityImpact.isNegative()) {
    reasons.push('PROTECTED_FUNDS');
    notes.push('mandate protects this currency from outflow');
  }

  const maxSingle = constraintAmount(input.mandate, 'MAXIMUM_SINGLE_PROPOSED_ACTION_AMOUNT');
  if (maxSingle && proposed.cmp(maxSingle) > 0) {
    reasons.push('AMOUNT_LIMIT');
    notes.push('proposed amount exceeds the mandate single-action limit');
  }

  if (input.planning.frozenAccountIds?.includes(candidate.sourceAccountId ?? '')) {
    reasons.push('ACCOUNT_STATE');
    notes.push('source account is frozen');
  }

  const prohibited = input.mandate.hardConstraints.find((item) => item.kind === 'PROHIBITED_ASSET_CATEGORIES');
  if (
    prohibited &&
    candidate.action === 'REVIEW_INVESTMENT_OPPORTUNITY_FUTURE' &&
    candidate.riskClass === 'HIGH'
  ) {
    reasons.push('USER_MANDATE');
    notes.push('high-risk investment review is prohibited by the mandate');
  }

  if (candidate.action === 'REVIEW_INVESTMENT_OPPORTUNITY_FUTURE') {
    const fact = input.policy.queryControlFact({
      capability: 'INVESTMENT_EXECUTION',
      subjectId: input.mandate.subjectId,
    });
    if (!fact.evaluable || !fact.permitted || input.planning.investmentExecutionImplemented === false) {
      if (candidate.executionCapability !== 'DEPENDENCY_NOT_IMPLEMENTED' && candidate.executionCapability !== 'PROPOSAL_ONLY') {
        reasons.push('REQUIRED_DEPENDENCY');
        notes.push('investment execution is not implemented');
      }
    }
  }

  if (candidate.executionCapability === 'PROHIBITED') {
    reasons.push('POLICY');
    notes.push('candidate is prohibited');
  }

  if (!candidate.mandateEvaluation.satisfied) {
    reasons.push('USER_MANDATE');
    notes.push(...candidate.mandateEvaluation.notes);
  }

  const annotation = input.planning.riskAnnotations?.find(
    (row) => row.candidateRef === candidate.actionId || row.candidateRef === candidate.title,
  );
  if (annotation && !annotation.compatible) {
    reasons.push('RISK_LIMIT');
    notes.push(annotation.reason);
  }

  const unique = [...new Set(reasons)];
  const accepted = unique.length === 0;
  return {
    actionId: candidate.actionId,
    accepted,
    deferred: !accepted && unique.includes('REQUIRED_DEPENDENCY'),
    reasons: Object.freeze(unique),
    detail: notes.join('; ') || (accepted ? 'feasible' : 'rejected'),
  };
}
