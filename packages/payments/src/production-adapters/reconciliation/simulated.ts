/**
 * Simulated financial-provider reconciliation port. Same contract a
 * real vendor adapter must implement.
 */

import { asUtcInstant } from '../../../domain/src/time.ts';
import { Money } from '../../../money/src/money.ts';
import type {
  FinancialProviderReconciliationPort,
  FinancialReconciliationWindow,
  FinancialReportedBalance,
  FinancialReportedFee,
  FinancialReportedSettlement,
  FinancialReportedStatement,
  FinancialReportedTransaction,
} from './contract.ts';

export class SimulatedFinancialReconciliationAdapter implements FinancialProviderReconciliationPort {
  constructor(
    private readonly providerId: string,
    private readonly fixture: {
      readonly balanceMinor?: bigint;
      readonly currency?: string;
      readonly transactions?: readonly FinancialReportedTransaction[];
      readonly settlements?: readonly FinancialReportedSettlement[];
      readonly fees?: readonly FinancialReportedFee[];
      readonly statementPresent?: boolean;
    } = {},
  ) {}

  fetchBalance(window: FinancialReconciliationWindow): FinancialReportedBalance | null {
    return Object.freeze({
      provider: this.providerId,
      externalAccount: `ext_${this.providerId}`,
      currency: this.fixture.currency ?? 'USD',
      reportedMinor: this.fixture.balanceMinor ?? 0n,
      availableMinor: this.fixture.balanceMinor ?? 0n,
      reportedAt: asUtcInstant(window.periodEnd),
      statementRef: `stmt_${this.providerId}`,
      isCustomerLedgerBalance: false,
    });
  }

  fetchTransactions(_window: FinancialReconciliationWindow): readonly FinancialReportedTransaction[] {
    return this.fixture.transactions ?? [];
  }

  fetchSettlementReport(_window: FinancialReconciliationWindow): readonly FinancialReportedSettlement[] {
    return this.fixture.settlements ?? [];
  }

  fetchStatement(window: FinancialReconciliationWindow): FinancialReportedStatement {
    return Object.freeze({
      statementRef: `stmt_${this.providerId}_${window.periodEnd}`,
      provider: this.providerId,
      periodStart: window.periodStart,
      periodEnd: window.periodEnd,
      present: this.fixture.statementPresent !== false,
    });
  }

  fetchFees(_window: FinancialReconciliationWindow): readonly FinancialReportedFee[] {
    return (
      this.fixture.fees ?? [
        Object.freeze({
          feeRef: `fee_${this.providerId}`,
          provider: this.providerId,
          currency: this.fixture.currency ?? 'USD',
          amount: Money.fromMinorUnits(0n, this.fixture.currency ?? 'USD'),
          kind: 'PROVIDER_FEE',
        }),
      ]
    );
  }
}
