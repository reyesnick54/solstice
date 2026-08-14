import { formatMoney } from '../../../contracts/src/money.ts';
import type { AgentProposal } from '../../../contracts/src/proposal.ts';
import type { RecordedFactor } from '../../../contracts/src/recorded-factor.ts';

function amountOf(factors: readonly RecordedFactor[], key: RecordedFactor['key']): string | null {
  const found = factors.find((f) => f.key === key);
  if (!found) {
    return null;
  }
  if ('amount' in found) {
    return formatMoney(found.amount);
  }
  return null;
}

function textOf(factors: readonly RecordedFactor[], key: RecordedFactor['key']): string | null {
  const found = factors.find((f) => f.key === key);
  if (!found) {
    return null;
  }
  if ('name' in found) {
    return found.name;
  }
  if ('step' in found) {
    return found.step;
  }
  if ('code' in found) {
    return found.code;
  }
  if ('classification' in found) {
    return found.classification;
  }
  if ('reason' in found) {
    return found.reason;
  }
  if ('months' in found) {
    return found.months.toString();
  }
  if ('sourceText' in found) {
    return found.sourceText;
  }
  if ('present' in found) {
    return found.present ? 'present' : 'absent';
  }
  return null;
}

/**
 * Concise plain-English explanation built only from recorded factors.
 * Never exposes model chain-of-thought. Unknown keys are omitted, not guessed.
 */
export function explainProposal(proposal: AgentProposal): string {
  const f = proposal.recordedFactors;
  const savings = amountOf(f, 'savings_balance');
  const spending = amountOf(f, 'monthly_essential_spending');
  const months = textOf(f, 'reserve_months');
  const surplus = amountOf(f, 'surplus');
  const floor = amountOf(f, 'liquid_floor');
  const debtName = textOf(f, 'high_cost_debt_name');
  const debtBal = amountOf(f, 'high_cost_debt_balance');
  const obligation = textOf(f, 'obligation_name');
  const obligationAmt = amountOf(f, 'obligation_amount');
  const goal = textOf(f, 'goal_name');
  const merchant = textOf(f, 'merchant_name');
  const classification = textOf(f, 'subscription_classification');
  const sponsor = textOf(f, 'sponsor_name');
  const compensation = amountOf(f, 'opportunity_compensation');
  const agreement = textOf(f, 'agreement_present');
  const refusal = textOf(f, 'refusal_reason');
  const amount = formatMoney(proposal.amount);

  if (proposal.reasonCode === 'RESERVE_BELOW_TARGET' && savings && spending && months) {
    return `Keeping ${savings} in savings because average monthly essential spending is ${spending} and your reserve setting is ${months} months.`;
  }
  if (proposal.reasonCode === 'LIQUIDITY_BELOW_MANDATE' && floor && savings) {
    return `Holding ${amount} as liquidity because your liquid floor is ${floor} and current savings are ${savings}.`;
  }
  if (proposal.reasonCode === 'NEAR_TERM_OBLIGATION' && obligation && obligationAmt) {
    return `Holding ${amount} for the near-term obligation "${obligation}" of ${obligationAmt}.`;
  }
  if (proposal.reasonCode === 'HIGH_COST_DEBT_OUTSTANDING' && debtName && debtBal) {
    return `Proposing ${amount} toward high-cost debt "${debtName}" (balance ${debtBal}).`;
  }
  if (proposal.reasonCode === 'SURPLUS_CASH_INVESTABLE' && surplus) {
    return `Proposing an investment sweep of ${surplus} as surplus cash after higher-priority waterfall steps.`;
  }
  if (proposal.reasonCode === 'PROTECTED_DEPOSIT_SWEEP_REQUESTED' && surplus) {
    return `Proposing an investment sweep of ${surplus} from deposits; no deposit-to-investment agreement is on file (agreement ${agreement ?? 'absent'}). The Kernel must refuse execution.`;
  }
  if (proposal.reasonCode === 'USER_GOAL_FUNDING' && goal) {
    return `Allocating ${amount} toward your goal "${goal}".`;
  }
  if (proposal.reasonCode === 'PERMITTED_REST_ALLOCATION') {
    return `Allocating remaining ${amount} under permitted allocation after the Compounder waterfall.`;
  }
  if (
    (proposal.reasonCode === 'SUBSCRIPTION_REDUNDANT' ||
      proposal.reasonCode === 'SUBSCRIPTION_UNUSED' ||
      proposal.reasonCode === 'SUBSCRIPTION_PRICE_INCREASED' ||
      proposal.reasonCode === 'SUBSCRIPTION_TRIAL_ENDING') &&
    merchant &&
    classification
  ) {
    return `Proposing cancellation of "${merchant}" classified as ${classification}. This does not modify the external service.`;
  }
  if (proposal.reasonCode === 'MERCHANT_BID_SELECTED' && merchant) {
    return `Recording a simulated merchant bid for "${merchant}" of ${amount}.`;
  }
  if (proposal.reasonCode === 'OPPORTUNITY_ELIGIBLE' && sponsor && compensation) {
    return `Showing research opportunity from verified sponsor ${sponsor} paying ${compensation}.`;
  }
  if (proposal.reasonCode === 'RESEARCH_PAY_ABOVE_FLOOR' && sponsor && compensation) {
    return `Showing research opportunity from verified sponsor ${sponsor} paying ${compensation}, which is above your floor.`;
  }
  if (proposal.reasonCode === 'REWARD_METHOD_SUPERIOR') {
    return `Proposing a payment-method route that records the reward source separately (${amount}).`;
  }
  if (proposal.reasonCode === 'REALIZED_GAINS_REINVEST') {
    return `Proposing to reinvest ${amount} of realized gains per your mandate.`;
  }
  if (proposal.reasonCode === 'REALIZED_GAINS_TO_SAVINGS') {
    return `Proposing to move ${amount} of realized gains to savings this week per your mandate.`;
  }
  if (refusal) {
    return `Proposal of ${amount} for ${proposal.actionType} was refused: ${refusal}.`;
  }

  const mandate = f.find((x) => x.key === 'mandate_clause');
  const clauseText = mandate && 'sourceText' in mandate ? mandate.sourceText : proposal.reasonCode;
  return `Proposing ${proposal.actionType} of ${amount} because ${clauseText}.`;
}

export function explainRefusal(proposal: AgentProposal, reason: string): string {
  const extra: RecordedFactor[] = [...proposal.recordedFactors, { key: 'refusal_reason', reason }];
  return explainProposal({ ...proposal, recordedFactors: extra });
}
