import { Money } from '../../../contracts/src/money.ts';
import type { FinancialContextSnapshot, RecurringPattern } from '../../../contracts/src/financial-context.ts';
import type { AgentProposal } from '../../../contracts/src/proposal.ts';
import type { CapabilityTokenClaims } from '../../../contracts/src/capability-claims.ts';
import type { CompiledMandate } from '../../../contracts/src/mandate-types.ts';
import { asProposalId, type MandateClauseId } from '../../../contracts/src/ids.ts';
import type { UtcInstant } from '../../../contracts/src/time.ts';
import type { ReasonCode } from '../../../contracts/src/proposal-types.ts';

const CLASS_TO_REASON: {
  readonly [C in RecurringPattern['classification']]: ReasonCode | null;
} = {
  ACTIVE: null,
  REDUNDANT: 'SUBSCRIPTION_REDUNDANT',
  UNUSED: 'SUBSCRIPTION_UNUSED',
  PRICE_INCREASED: 'SUBSCRIPTION_PRICE_INCREASED',
  TRIAL_ENDING: 'SUBSCRIPTION_TRIAL_ENDING',
};

/**
 * Detects recurring transactions already classified on the read-only
 * context and proposes cancellation. Never calls an external service.
 */
export function proposeSubscriptionCancellations(input: {
  readonly context: FinancialContextSnapshot;
  readonly claims: CapabilityTokenClaims;
  readonly mandateClauseId: MandateClauseId;
  readonly now: UtcInstant;
}): readonly AgentProposal[] {
  const out: AgentProposal[] = [];
  for (const pattern of input.context.recurringPatterns) {
    const reason = CLASS_TO_REASON[pattern.classification];
    if (reason === null) {
      continue;
    }
    out.push(
      Object.freeze({
        proposalId: asProposalId(`sub_${pattern.groupId}`),
        agentId: input.claims.agentId,
        customerId: input.claims.customerId,
        actionType: 'CANCEL_SUBSCRIPTION',
        amount: pattern.typicalAmount,
        targetAccountClass: 'deposits',
        reasonCode: reason,
        mandateClauseId: input.mandateClauseId,
        recordedFactors: Object.freeze([
          { key: 'merchant_name' as const, name: pattern.merchantName },
          { key: 'subscription_classification' as const, classification: pattern.classification },
          { key: 'reason_code' as const, code: reason },
        ]),
        sourceAccountId: null,
        targetAccountId: null,
        requiresDepositInvestmentAgreement: false,
        emittedAt: input.now,
      }),
    );
  }
  return out;
}

export type SimulatedMerchantBid = {
  readonly merchantId: string;
  readonly merchantName: string;
  readonly bid: Money;
  readonly anonymizedIntentId: string;
};

/**
 * Simulated merchant exchange. Bids come from a provided catalog — never
 * fabricated. Customer selection is recorded as a proposal only.
 */
export function proposeMerchantSelection(input: {
  readonly claims: CapabilityTokenClaims;
  readonly mandateClauseId: MandateClauseId;
  readonly now: UtcInstant;
  readonly selected: SimulatedMerchantBid;
}): AgentProposal {
  return Object.freeze({
    proposalId: asProposalId(`mx_${input.selected.anonymizedIntentId}`),
    agentId: input.claims.agentId,
    customerId: input.claims.customerId,
    actionType: 'SELECT_MERCHANT_BID',
    amount: input.selected.bid,
    targetAccountClass: 'deposits',
    reasonCode: 'MERCHANT_BID_SELECTED',
    mandateClauseId: input.mandateClauseId,
    recordedFactors: Object.freeze([
      { key: 'merchant_name' as const, name: input.selected.merchantName },
      { key: 'reason_code' as const, code: 'MERCHANT_BID_SELECTED' },
    ]),
    sourceAccountId: null,
    targetAccountId: null,
    requiresDepositInvestmentAgreement: false,
    emittedAt: input.now,
  });
}

export type CuratedOpportunity = {
  readonly opportunityId: string;
  readonly sponsorId: string;
  readonly sponsorName: string;
  readonly verifiedSponsor: true;
  readonly eligibility: string;
  readonly compensation: Money;
  readonly requiredTimeMinutes: bigint;
  readonly privacyTerms: string;
  readonly jurisdiction: string;
};

/**
 * Opportunity engine. Only curated, verified-sponsor records may be shown.
 * Fabricating an opportunity or sponsor is a hard error.
 */
export function proposeOpportunities(input: {
  readonly claims: CapabilityTokenClaims;
  readonly mandates: readonly CompiledMandate[];
  readonly now: UtcInstant;
  readonly catalog: readonly CuratedOpportunity[];
}): readonly AgentProposal[] {
  const floorMandate = input.mandates.find((m) => m.constraint.kind === 'RESEARCH_PAY_FLOOR');
  const floor =
    floorMandate && floorMandate.constraint.kind === 'RESEARCH_PAY_FLOOR'
      ? floorMandate.constraint.minCompensation
      : Money.zero(input.claims.perTransactionLimit.currency);
  const clauseId = (floorMandate?.clauseId ?? 'clause_none') as MandateClauseId;

  const out: AgentProposal[] = [];
  for (const opportunity of input.catalog) {
    if (opportunity.verifiedSponsor !== true) {
      throw new Error('Opportunity engine refuses unverified sponsors');
    }
    if (opportunity.compensation.cmp(floor) <= 0) {
      continue;
    }
    out.push(
      Object.freeze({
        proposalId: asProposalId(`opp_${opportunity.opportunityId}`),
        agentId: input.claims.agentId,
        customerId: input.claims.customerId,
        actionType: 'SHOW_RESEARCH_OPPORTUNITY',
        amount: opportunity.compensation,
        targetAccountClass: 'pending',
        reasonCode: 'RESEARCH_PAY_ABOVE_FLOOR',
        mandateClauseId: clauseId,
        recordedFactors: Object.freeze([
          { key: 'sponsor_name' as const, name: opportunity.sponsorName },
          { key: 'opportunity_compensation' as const, amount: opportunity.compensation },
          { key: 'reason_code' as const, code: 'RESEARCH_PAY_ABOVE_FLOOR' },
        ]),
        sourceAccountId: null,
        targetAccountId: null,
        requiresDepositInvestmentAgreement: false,
        emittedAt: input.now,
      }),
    );
  }
  return out;
}

export type RewardComparison = {
  readonly method: string;
  readonly reward: Money;
  readonly source: 'CARD_REWARD_PENDING' | 'CASHBACK';
};

/**
 * Reward router: compares provided methods, records the reward source
 * separately, never misclassifies cost-avoided as a reward.
 */
export function proposeRewardRoute(input: {
  readonly claims: CapabilityTokenClaims;
  readonly mandateClauseId: MandateClauseId;
  readonly now: UtcInstant;
  readonly methods: readonly RewardComparison[];
}): AgentProposal {
  if (input.methods.length === 0) {
    throw new Error('Reward router requires at least one compared method');
  }
  let best = input.methods[0]!;
  for (const method of input.methods) {
    if (method.reward.cmp(best.reward) > 0) {
      best = method;
    }
  }
  return Object.freeze({
    proposalId: asProposalId(`rew_${best.method}`),
    agentId: input.claims.agentId,
    customerId: input.claims.customerId,
    actionType: 'ROUTE_REWARD',
    amount: best.reward,
    targetAccountClass: best.source === 'CASHBACK' ? 'rewards' : 'pending',
    reasonCode: 'REWARD_METHOD_SUPERIOR',
    mandateClauseId: input.mandateClauseId,
    recordedFactors: Object.freeze([
      { key: 'reason_code' as const, code: 'REWARD_METHOD_SUPERIOR' },
      { key: 'merchant_name' as const, name: best.method },
    ]),
    sourceAccountId: null,
    targetAccountId: null,
    requiresDepositInvestmentAgreement: false,
    emittedAt: input.now,
  });
}
