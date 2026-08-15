import type { AccountId } from '../../../domain/src/account.ts';
import {
  SIMULATED_FUNDING_TO_CORPORATE_OPERATING,
  SIMULATED_FUNDING_TO_DEMAND_DEPOSIT,
} from '../../../ledger/src/types.ts';
import { Money } from '../../../money/src/money.ts';
import type { CardJournalPlan } from '../accounting.ts';
import {
  acquiringClearingAccountId,
  acquiringFeeIncomeAccountId,
  acquiringProviderAccountId,
} from './treasury.ts';

export function merchantCreditPlan(merchantAccountId: AccountId, amount: Money): CardJournalPlan {
  return {
    suffix: 'acceptance-credit',
    memo: 'softpos merchant settlement credit',
    classBridge: SIMULATED_FUNDING_TO_DEMAND_DEPOSIT,
    postings: [
      { accountId: acquiringProviderAccountId(amount.currency), direction: 'DEBIT', amount },
      { accountId: acquiringClearingAccountId(amount.currency), direction: 'CREDIT', amount },
      { accountId: acquiringClearingAccountId(amount.currency), direction: 'DEBIT', amount },
      { accountId: merchantAccountId, direction: 'CREDIT', amount },
    ],
  };
}

export function acquiringFeePlan(amount: Money): CardJournalPlan {
  return {
    suffix: 'acceptance-fee',
    memo: 'explicit acquiring fee',
    classBridge: SIMULATED_FUNDING_TO_CORPORATE_OPERATING,
    postings: [
      { accountId: acquiringClearingAccountId(amount.currency), direction: 'DEBIT', amount },
      { accountId: acquiringFeeIncomeAccountId(amount.currency), direction: 'CREDIT', amount },
    ],
  };
}
