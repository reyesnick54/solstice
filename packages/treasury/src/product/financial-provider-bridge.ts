/**
 * Phase D → Phase C treasury reconciliation bridge.
 *
 * Consumes a structural snapshot from payments production-adapters.
 * Does not import payment adapter implementations. Does not post journals.
 */

import { asUtcInstant } from '../../../domain/src/time.ts';
import { asProviderBalanceId } from '../ids.ts';
import type { ReconciliationProviderAdapter, ReconciliationWindow, ProviderStatement } from './adapter.ts';
import { freezeProviderReportedBalance, type ProviderReportedBalance } from './provider-balance.ts';
import type { ReportedFinancialRecord } from './reconciliation-engine.ts';
import type { SettlementRecord } from './settlement.ts';

export type FinancialProviderSnapshot = {
  readonly window: {
    readonly provider: string;
    readonly periodStart: string;
    readonly periodEnd: string;
    readonly sourceVersion: string;
  };
  readonly balance: {
    readonly provider: string;
    readonly externalAccount: string;
    readonly currency: string;
    readonly reportedMinor: bigint;
    readonly availableMinor: bigint | null;
    readonly reportedAt: string;
    readonly statementRef: string | null;
    readonly isCustomerLedgerBalance: false;
  } | null;
  readonly transactions: readonly {
    readonly recordId: string;
    readonly provider: string;
    readonly currency: string;
    readonly amountMinor: bigint;
    readonly externalRef: string;
    readonly statementRef: string | null;
    readonly occurredAt: string;
  }[];
  readonly statement: {
    readonly statementRef: string;
    readonly provider: string;
    readonly periodStart: string;
    readonly periodEnd: string;
    readonly present: boolean;
  };
  readonly providerBalanceIsLedgerAuthority: false;
};

export function treasuryAdapterFromFinancialSnapshot(
  snapshot: FinancialProviderSnapshot,
): ReconciliationProviderAdapter {
  return {
    fetchBalance(_window: ReconciliationWindow): ProviderReportedBalance | null {
      if (!snapshot.balance) {
        return null;
      }
      return freezeProviderReportedBalance({
        providerBalanceId: asProviderBalanceId(`pbal_${snapshot.balance.provider}_${snapshot.balance.externalAccount}`),
        provider: snapshot.balance.provider,
        externalAccount: snapshot.balance.externalAccount,
        currency: snapshot.balance.currency,
        reportedMinor: snapshot.balance.reportedMinor,
        availableMinor: snapshot.balance.availableMinor,
        reportedAt: asUtcInstant(snapshot.balance.reportedAt),
        statementRef: snapshot.balance.statementRef,
        evidenceSource: snapshot.window.sourceVersion,
      });
    },
    fetchTransactions(_window: ReconciliationWindow): readonly ReportedFinancialRecord[] {
      return snapshot.transactions.map((row) =>
        Object.freeze({
          recordId: row.recordId,
          provider: row.provider,
          currency: row.currency,
          amountMinor: row.amountMinor,
          externalRef: row.externalRef,
          statementRef: row.statementRef,
          occurredAt: asUtcInstant(row.occurredAt),
        }),
      );
    },
    fetchSettlementReport(_window: ReconciliationWindow): readonly SettlementRecord[] {
      return [];
    },
    fetchStatement(window: ReconciliationWindow): ProviderStatement {
      return Object.freeze({
        statementRef: snapshot.statement.statementRef,
        provider: snapshot.statement.provider,
        periodStart: snapshot.statement.periodStart,
        periodEnd: snapshot.statement.periodEnd,
        sourceVersion: window.sourceVersion,
        present: snapshot.statement.present,
      });
    },
    fetchReconciliationWindow(window: ReconciliationWindow): ReconciliationWindow {
      return Object.freeze({ ...window });
    },
  };
}
