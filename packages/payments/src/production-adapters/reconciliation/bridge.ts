/**
 * Structural Phase C reconciliation snapshot.
 *
 * packages/payments must not import packages/treasury. The treasury
 * product layer maps this snapshot onto ReconciliationProviderAdapter.
 */

import type {
  FinancialProviderReconciliationPort,
  FinancialReconciliationWindow,
  FinancialReportedBalance,
  FinancialReportedFee,
  FinancialReportedSettlement,
  FinancialReportedStatement,
  FinancialReportedTransaction,
} from './contract.ts';

export type PhaseCReconciliationSnapshot = {
  readonly window: FinancialReconciliationWindow;
  readonly balance: FinancialReportedBalance | null;
  readonly transactions: readonly FinancialReportedTransaction[];
  readonly settlements: readonly FinancialReportedSettlement[];
  readonly statement: FinancialReportedStatement;
  readonly fees: readonly FinancialReportedFee[];
  readonly providerBalanceIsLedgerAuthority: false;
};

export function snapshotFinancialReconciliation(
  port: FinancialProviderReconciliationPort,
  window: FinancialReconciliationWindow,
): PhaseCReconciliationSnapshot {
  return Object.freeze({
    window: Object.freeze({ ...window }),
    balance: port.fetchBalance(window),
    transactions: port.fetchTransactions(window),
    settlements: port.fetchSettlementReport(window),
    statement: port.fetchStatement(window),
    fees: port.fetchFees(window),
    providerBalanceIsLedgerAuthority: false,
  });
}
