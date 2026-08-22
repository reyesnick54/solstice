/**
 * Financial-provider reconciliation contract.
 *
 * A real provider integration is incomplete if money can be sent but
 * cannot be reconciled. Provider balances are evidence, not Ledger
 * authority. This port is structurally compatible with Phase C
 * ReconciliationProviderAdapter without importing packages/treasury.
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { Money } from '../../../../money/src/money.ts';

export type FinancialReconciliationWindow = {
  readonly provider: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly sourceVersion: string;
};

export type FinancialReportedBalance = {
  readonly provider: string;
  readonly externalAccount: string;
  readonly currency: string;
  readonly reportedMinor: bigint;
  readonly availableMinor: bigint | null;
  readonly reportedAt: UtcInstant;
  readonly statementRef: string | null;
  readonly isCustomerLedgerBalance: false;
};

export type FinancialReportedTransaction = {
  readonly recordId: string;
  readonly provider: string;
  readonly currency: string;
  readonly amountMinor: bigint;
  readonly externalRef: string;
  readonly statementRef: string | null;
  readonly occurredAt: UtcInstant;
};

export type FinancialReportedSettlement = {
  readonly settlementRef: string;
  readonly provider: string;
  readonly currency: string;
  readonly grossMinor: bigint;
  readonly feeMinor: bigint;
  readonly netMinor: bigint;
  readonly status: string;
};

export type FinancialReportedStatement = {
  readonly statementRef: string;
  readonly provider: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly present: boolean;
};

export type FinancialReportedFee = {
  readonly feeRef: string;
  readonly provider: string;
  readonly currency: string;
  readonly amount: Money;
  readonly kind: string;
};

export type FinancialProviderReconciliationPort = {
  fetchBalance(window: FinancialReconciliationWindow): FinancialReportedBalance | null;
  fetchTransactions(window: FinancialReconciliationWindow): readonly FinancialReportedTransaction[];
  fetchSettlementReport(window: FinancialReconciliationWindow): readonly FinancialReportedSettlement[];
  fetchStatement(window: FinancialReconciliationWindow): FinancialReportedStatement;
  fetchFees(window: FinancialReconciliationWindow): readonly FinancialReportedFee[];
};

export function incompleteWithoutReconciliation(input: {
  readonly canSubmit: boolean;
  readonly canReconcile: boolean;
}): { readonly integrationComplete: false; readonly reason: string } | { readonly integrationComplete: true } {
  if (input.canSubmit && !input.canReconcile) {
    return {
      integrationComplete: false,
      reason: 'provider_can_send_money_but_cannot_reconcile',
    };
  }
  if (!input.canReconcile) {
    return { integrationComplete: false, reason: 'reconciliation_contract_required' };
  }
  return { integrationComplete: true };
}
