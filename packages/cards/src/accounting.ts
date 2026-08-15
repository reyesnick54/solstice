import {
  SIMULATED_FUNDING_TO_CORPORATE_OPERATING,
  SIMULATED_FUNDING_TO_DEMAND_DEPOSIT,
  simulationFundingSourceId,
  type ClassBridge,
  type ProposedPosting,
} from '../../ledger/src/types.ts';
import type { AccountId } from '../../domain/src/account.ts';
import { Money } from '../../money/src/money.ts';
import {
  cardDisputeProvisionalAccountId,
  cardFeeClearingAccountId,
  cardFeeIncomeAccountId,
  cardProcessorNetworkAccountId,
  cardSettlementClearingAccountId,
} from './treasury.ts';

export type CardJournalPlan = {
  readonly suffix: string;
  readonly memo: string;
  readonly postings: readonly ProposedPosting[];
  readonly classBridge?: ClassBridge;
};

/**
 * After captureHold (customer → simulation funding source), reclass into
 * explicit card settlement books.
 */
export function settlementReclassPlan(amount: Money): CardJournalPlan {
  return {
    suffix: 'settle-reclass',
    memo: 'card clearing settlement reclass',
    postings: [
      { accountId: simulationFundingSourceId(amount.currency), direction: 'DEBIT', amount },
      { accountId: cardSettlementClearingAccountId(amount.currency), direction: 'CREDIT', amount },
      { accountId: cardSettlementClearingAccountId(amount.currency), direction: 'DEBIT', amount },
      { accountId: cardProcessorNetworkAccountId(amount.currency), direction: 'CREDIT', amount },
    ],
  };
}

/**
 * Direct customer debit when there is no hold to capture (force-post / partial
 * after release). Uses the existing disclosed class bridge.
 */
export function settlementDirectPlan(customerAccountId: AccountId, amount: Money): CardJournalPlan {
  return {
    suffix: 'settle-direct',
    memo: 'card clearing settlement without captured hold',
    classBridge: SIMULATED_FUNDING_TO_DEMAND_DEPOSIT,
    postings: [
      { accountId: customerAccountId, direction: 'DEBIT', amount },
      { accountId: cardSettlementClearingAccountId(amount.currency), direction: 'CREDIT', amount },
      { accountId: cardSettlementClearingAccountId(amount.currency), direction: 'DEBIT', amount },
      { accountId: cardProcessorNetworkAccountId(amount.currency), direction: 'CREDIT', amount },
    ],
  };
}

export function refundPlan(customerAccountId: AccountId, amount: Money): CardJournalPlan {
  return {
    suffix: 'refund',
    memo: 'card merchant refund compensating journal',
    classBridge: SIMULATED_FUNDING_TO_DEMAND_DEPOSIT,
    postings: [
      { accountId: cardProcessorNetworkAccountId(amount.currency), direction: 'DEBIT', amount },
      { accountId: cardSettlementClearingAccountId(amount.currency), direction: 'CREDIT', amount },
      { accountId: cardSettlementClearingAccountId(amount.currency), direction: 'DEBIT', amount },
      { accountId: customerAccountId, direction: 'CREDIT', amount },
    ],
  };
}

export function feePlan(amount: Money): CardJournalPlan {
  return {
    suffix: 'fee',
    memo: 'explicit card fee',
    classBridge: SIMULATED_FUNDING_TO_CORPORATE_OPERATING,
    postings: [
      { accountId: cardFeeClearingAccountId(amount.currency), direction: 'DEBIT', amount },
      { accountId: cardFeeIncomeAccountId(amount.currency), direction: 'CREDIT', amount },
    ],
  };
}

export function customerFeePlan(customerAccountId: AccountId, amount: Money): CardJournalPlan {
  return {
    suffix: 'customer-fee',
    memo: 'explicit card fee assessed to customer',
    classBridge: SIMULATED_FUNDING_TO_DEMAND_DEPOSIT,
    postings: [
      { accountId: customerAccountId, direction: 'DEBIT', amount },
      { accountId: cardFeeClearingAccountId(amount.currency), direction: 'CREDIT', amount },
    ],
  };
}

export function disputeProvisionalCreditPlan(customerAccountId: AccountId, amount: Money): CardJournalPlan {
  return {
    suffix: 'dispute-provisional',
    memo: 'simulation provisional dispute credit',
    classBridge: SIMULATED_FUNDING_TO_DEMAND_DEPOSIT,
    postings: [
      { accountId: cardDisputeProvisionalAccountId(amount.currency), direction: 'DEBIT', amount },
      { accountId: customerAccountId, direction: 'CREDIT', amount },
    ],
  };
}

export function disputeProvisionalReversalPlan(customerAccountId: AccountId, amount: Money): CardJournalPlan {
  return {
    suffix: 'dispute-provisional-reverse',
    memo: 'simulation reverse provisional dispute credit',
    classBridge: SIMULATED_FUNDING_TO_DEMAND_DEPOSIT,
    postings: [
      { accountId: customerAccountId, direction: 'DEBIT', amount },
      { accountId: cardDisputeProvisionalAccountId(amount.currency), direction: 'CREDIT', amount },
    ],
  };
}

export function disputeFinalChargebackPlan(amount: Money): CardJournalPlan {
  return {
    suffix: 'dispute-final',
    memo: 'simulation final dispute won — processor obligation',
    postings: [
      { accountId: cardProcessorNetworkAccountId(amount.currency), direction: 'DEBIT', amount },
      { accountId: cardDisputeProvisionalAccountId(amount.currency), direction: 'CREDIT', amount },
    ],
  };
}
