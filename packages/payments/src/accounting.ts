import {
  DEMAND_DEPOSIT_TO_PENDING_SETTLEMENT,
  DEMAND_DEPOSIT_TO_SIMULATED_FUNDING,
  PENDING_SETTLEMENT_TO_SIMULATED_FUNDING,
  SIMULATED_FUNDING_TO_CORPORATE_OPERATING,
  SIMULATED_FUNDING_TO_DEMAND_DEPOSIT,
  SIMULATED_FUNDING_TO_PENDING_SETTLEMENT,
  type ClassBridge,
  type ProposedPosting,
} from '../../ledger/src/types.ts';
import type { Money } from '../../money/src/money.ts';
import {
  beneficiaryPayableAccountId,
  feeClearingAccountId,
  feeIncomeAccountId,
  fxClearingAccountId,
  pendingAccountId,
  settlementAccountId,
  treasuryAccountId,
} from './treasury.ts';

export type PaymentJournalPlan = {
  readonly suffix: string;
  readonly memo: string;
  readonly postings: readonly ProposedPosting[];
  readonly classBridge?: ClassBridge;
};

/**
 * Exact simulation postings for a cross-border payment.
 *
 * USD reserve (customer + pending, both CUSTOMER):
 *   Dr source demand     amountDebited
 *   Cr pending USD       amountDebited
 *
 * USD capture principal:
 *   Dr pending USD       sourceAmount
 *   Cr treasury USD      sourceAmount
 *
 * USD capture fee:
 *   Dr pending USD       fee
 *   Cr fee clearing USD  fee
 *
 * USD fee income (SYSTEM + CORPORATE, no customer):
 *   Dr fee clearing USD  fee
 *   Cr corporate fee     fee
 *
 * USD FX:
 *   Dr treasury USD      sourceAmount
 *   Cr FX clearing USD   sourceAmount
 *
 * Destination FX (separate currency journal):
 *   Dr FX clearing DEST  destinationAmount
 *   Cr settlement DEST   destinationAmount
 *
 * Destination settle:
 *   Dr settlement DEST   destinationAmount
 *   Cr beneficiary DEST  destinationAmount
 *
 * USD and SAR are never balanced against each other.
 */
export function reservePlan(sourceAccountId: string, amountDebited: Money): PaymentJournalPlan {
  return {
    suffix: 'reserve',
    memo: 'PAYMENT_RESERVE',
    classBridge: DEMAND_DEPOSIT_TO_PENDING_SETTLEMENT,
    postings: [
      { accountId: sourceAccountId, direction: 'DEBIT', amount: amountDebited },
      { accountId: pendingAccountId(amountDebited.currency), direction: 'CREDIT', amount: amountDebited },
    ],
  };
}

export function releasePlan(sourceAccountId: string, amountDebited: Money): PaymentJournalPlan {
  return {
    suffix: 'release',
    memo: 'PAYMENT_RELEASE',
    classBridge: DEMAND_DEPOSIT_TO_PENDING_SETTLEMENT,
    postings: [
      { accountId: pendingAccountId(amountDebited.currency), direction: 'DEBIT', amount: amountDebited },
      { accountId: sourceAccountId, direction: 'CREDIT', amount: amountDebited },
    ],
  };
}

export function capturePrincipalPlan(sourceAmount: Money): PaymentJournalPlan {
  return {
    suffix: 'capture-principal',
    memo: 'PAYMENT_CAPTURE_PRINCIPAL',
    classBridge: PENDING_SETTLEMENT_TO_SIMULATED_FUNDING,
    postings: [
      { accountId: pendingAccountId(sourceAmount.currency), direction: 'DEBIT', amount: sourceAmount },
      { accountId: treasuryAccountId(sourceAmount.currency), direction: 'CREDIT', amount: sourceAmount },
    ],
  };
}

export function captureFeePlan(fee: Money): PaymentJournalPlan {
  return {
    suffix: 'capture-fee',
    memo: 'PAYMENT_CAPTURE_FEE',
    classBridge: PENDING_SETTLEMENT_TO_SIMULATED_FUNDING,
    postings: [
      { accountId: pendingAccountId(fee.currency), direction: 'DEBIT', amount: fee },
      { accountId: feeClearingAccountId(fee.currency), direction: 'CREDIT', amount: fee },
    ],
  };
}

export function feeIncomePlan(fee: Money): PaymentJournalPlan {
  return {
    suffix: 'fee-income',
    memo: 'PAYMENT_FEE_INCOME',
    classBridge: SIMULATED_FUNDING_TO_CORPORATE_OPERATING,
    postings: [
      { accountId: feeClearingAccountId(fee.currency), direction: 'DEBIT', amount: fee },
      { accountId: feeIncomeAccountId(fee.currency), direction: 'CREDIT', amount: fee },
    ],
  };
}

export function sourceFxPlan(sourceAmount: Money): PaymentJournalPlan {
  return {
    suffix: 'fx-debit',
    memo: 'PAYMENT_FX_SOURCE',
    postings: [
      { accountId: treasuryAccountId(sourceAmount.currency), direction: 'DEBIT', amount: sourceAmount },
      { accountId: fxClearingAccountId(sourceAmount.currency), direction: 'CREDIT', amount: sourceAmount },
    ],
  };
}

export function destinationFxPlan(destinationAmount: Money): PaymentJournalPlan {
  return {
    suffix: 'fx-credit',
    memo: 'PAYMENT_FX_DESTINATION',
    postings: [
      { accountId: fxClearingAccountId(destinationAmount.currency), direction: 'DEBIT', amount: destinationAmount },
      { accountId: settlementAccountId(destinationAmount.currency), direction: 'CREDIT', amount: destinationAmount },
    ],
  };
}

export function settlePlan(destinationAmount: Money): PaymentJournalPlan {
  return {
    suffix: 'settle',
    memo: 'PAYMENT_SETTLE_BENEFICIARY',
    postings: [
      { accountId: settlementAccountId(destinationAmount.currency), direction: 'DEBIT', amount: destinationAmount },
      {
        accountId: beneficiaryPayableAccountId(destinationAmount.currency),
        direction: 'CREDIT',
        amount: destinationAmount,
      },
    ],
  };
}

export function returnPrincipalPlan(sourceAccountId: string, sourceAmount: Money): PaymentJournalPlan {
  return {
    suffix: 'return-principal',
    memo: 'PAYMENT_RETURN_PRINCIPAL_SIMULATION_POLICY',
    classBridge: DEMAND_DEPOSIT_TO_SIMULATED_FUNDING,
    postings: [
      { accountId: treasuryAccountId(sourceAmount.currency), direction: 'DEBIT', amount: sourceAmount },
      { accountId: sourceAccountId, direction: 'CREDIT', amount: sourceAmount },
    ],
  };
}

export function returnDestinationSettlePlan(destinationAmount: Money): PaymentJournalPlan {
  return {
    suffix: 'return-settle',
    memo: 'PAYMENT_RETURN_DESTINATION',
    postings: [
      {
        accountId: beneficiaryPayableAccountId(destinationAmount.currency),
        direction: 'DEBIT',
        amount: destinationAmount,
      },
      { accountId: settlementAccountId(destinationAmount.currency), direction: 'CREDIT', amount: destinationAmount },
    ],
  };
}

export function returnDestinationFxPlan(destinationAmount: Money): PaymentJournalPlan {
  return {
    suffix: 'return-fx-credit',
    memo: 'PAYMENT_RETURN_FX_DESTINATION',
    postings: [
      { accountId: settlementAccountId(destinationAmount.currency), direction: 'DEBIT', amount: destinationAmount },
      { accountId: fxClearingAccountId(destinationAmount.currency), direction: 'CREDIT', amount: destinationAmount },
    ],
  };
}

export function returnSourceFxPlan(sourceAmount: Money): PaymentJournalPlan {
  return {
    suffix: 'return-fx-debit',
    memo: 'PAYMENT_RETURN_FX_SOURCE',
    postings: [
      { accountId: fxClearingAccountId(sourceAmount.currency), direction: 'DEBIT', amount: sourceAmount },
      { accountId: treasuryAccountId(sourceAmount.currency), direction: 'CREDIT', amount: sourceAmount },
    ],
  };
}

/**
 * Simulation return policy (not a legal obligation):
 * principal is returned at the original source amount; the explicit fee is retained.
 */
export const SIMULATION_RETURN_POLICY = 'RETAIN_FEE_RETURN_PRINCIPAL_AT_ORIGINAL_SOURCE_AMOUNT';

export function inboundPendingPlan(amount: Money): PaymentJournalPlan {
  return {
    suffix: 'inbound-pending',
    memo: 'INBOUND_PENDING_SETTLEMENT',
    classBridge: SIMULATED_FUNDING_TO_PENDING_SETTLEMENT,
    postings: [
      { accountId: treasuryAccountId(amount.currency), direction: 'DEBIT', amount },
      { accountId: pendingAccountId(amount.currency), direction: 'CREDIT', amount },
    ],
  };
}

export function walletDestinationCreditPlan(destinationAccountId: string, destinationAmount: Money): PaymentJournalPlan {
  return {
    suffix: 'wallet-credit',
    memo: 'WALLET_FX_DESTINATION_CREDIT',
    classBridge: DEMAND_DEPOSIT_TO_SIMULATED_FUNDING,
    postings: [
      { accountId: settlementAccountId(destinationAmount.currency), direction: 'DEBIT', amount: destinationAmount },
      { accountId: destinationAccountId, direction: 'CREDIT', amount: destinationAmount },
    ],
  };
}

export function inboundSettlePlan(destinationAccountId: string, amount: Money): PaymentJournalPlan {
  return {
    suffix: 'inbound-settle',
    memo: 'INBOUND_SETTLE_CUSTOMER',
    classBridge: DEMAND_DEPOSIT_TO_PENDING_SETTLEMENT,
    postings: [
      { accountId: pendingAccountId(amount.currency), direction: 'DEBIT', amount },
      { accountId: destinationAccountId, direction: 'CREDIT', amount },
    ],
  };
}

export function customerConversionSettlePlan(destinationAccountId: string, amount: Money): PaymentJournalPlan {
  return {
    suffix: 'fx-customer-credit',
    memo: 'FX_CONVERSION_CREDIT_CUSTOMER',
    classBridge: SIMULATED_FUNDING_TO_DEMAND_DEPOSIT,
    postings: [
      { accountId: settlementAccountId(amount.currency), direction: 'DEBIT', amount },
/**
 * Same-currency SunRey ledger transfer. No FX, no rail, no pending
 * settlement. Class bridge is attached only when the accounts differ.
 */
export function internalTransferPlan(
  sourceAccountId: string,
  destinationAccountId: string,
  amount: Money,
  classBridge?: ClassBridge,
): PaymentJournalPlan {
  return {
    suffix: 'internal-transfer',
    memo: 'INTERNAL_SUNREY_TRANSFER',
    ...(classBridge ? { classBridge } : {}),
    postings: [
      { accountId: sourceAccountId, direction: 'DEBIT', amount },
      { accountId: destinationAccountId, direction: 'CREDIT', amount },
    ],
  };
}
