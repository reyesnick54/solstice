import { asUtcInstant } from '../../../domain/src/time.ts';
import { asProviderBalanceId } from '../ids.ts';
import { freezeProviderReportedBalance, type ProviderReportedBalance } from './provider-balance.ts';
import type { ReportedFinancialRecord } from './reconciliation-engine.ts';
import type { SettlementRecord } from './settlement.ts';

export type ReconciliationWindow = {
  readonly provider: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly sourceVersion: string;
};

export type ProviderStatement = {
  readonly statementRef: string;
  readonly provider: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly sourceVersion: string;
  readonly present: boolean;
};

export type ReconciliationProviderAdapter = {
  fetchBalance(window: ReconciliationWindow): ProviderReportedBalance | null;
  fetchTransactions(window: ReconciliationWindow): readonly ReportedFinancialRecord[];
  fetchSettlementReport(window: ReconciliationWindow): readonly SettlementRecord[];
  fetchStatement(window: ReconciliationWindow): ProviderStatement;
  fetchReconciliationWindow(window: ReconciliationWindow): ReconciliationWindow;
};

export const SIMULATION_RECON_SOURCE_VERSION = 'sim-recon-adapter-v1';

export type SimulationAdapterFixture = {
  readonly provider: string;
  readonly balances?: readonly ProviderReportedBalance[];
  readonly transactions?: readonly ReportedFinancialRecord[];
  readonly settlements?: readonly SettlementRecord[];
  readonly missingStatement?: boolean;
  readonly mismatchAmountMinor?: bigint;
};

/**
 * Deterministic sandbox adapter. Real provider implementations are Phase D.
 */
export class SimulationReconciliationAdapter implements ReconciliationProviderAdapter {
  private readonly fixtures: readonly SimulationAdapterFixture[];

  constructor(fixtures: readonly SimulationAdapterFixture[] = []) {
    this.fixtures = fixtures;
  }

  fetchBalance(window: ReconciliationWindow): ProviderReportedBalance | null {
    const fixture = this.fixtures.find((row) => row.provider === window.provider);
    if (fixture?.balances?.[0]) {
      return fixture.balances[0];
    }
    return freezeProviderReportedBalance({
      providerBalanceId: asProviderBalanceId(`pbal_${window.provider}_${window.periodEnd}`),
      provider: window.provider,
      externalAccount: `ext_${window.provider}`,
      currency: 'USD',
      reportedMinor: 0n,
      availableMinor: 0n,
      reportedAt: asUtcInstant(window.periodEnd),
      statementRef: `stmt_${window.provider}`,
      evidenceSource: SIMULATION_RECON_SOURCE_VERSION,
    });
  }

  fetchTransactions(window: ReconciliationWindow): readonly ReportedFinancialRecord[] {
    const fixture = this.fixtures.find((row) => row.provider === window.provider);
    const rows = fixture?.transactions ?? [];
    if (fixture?.mismatchAmountMinor !== undefined && rows.length > 0) {
      const first = rows[0]!;
      return Object.freeze([
        { ...first, amountMinor: fixture.mismatchAmountMinor },
        ...rows.slice(1),
      ]);
    }
    return rows;
  }

  fetchSettlementReport(window: ReconciliationWindow): readonly SettlementRecord[] {
    const fixture = this.fixtures.find((row) => row.provider === window.provider);
    return fixture?.settlements ?? [];
  }

  fetchStatement(window: ReconciliationWindow): ProviderStatement {
    const fixture = this.fixtures.find((row) => row.provider === window.provider);
    return Object.freeze({
      statementRef: `stmt_${window.provider}_${window.periodEnd}`,
      provider: window.provider,
      periodStart: window.periodStart,
      periodEnd: window.periodEnd,
      sourceVersion: window.sourceVersion,
      present: fixture?.missingStatement !== true,
    });
  }

  fetchReconciliationWindow(window: ReconciliationWindow): ReconciliationWindow {
    return Object.freeze({
      ...window,
      sourceVersion: window.sourceVersion || SIMULATION_RECON_SOURCE_VERSION,
    });
  }
}

export function controlledMismatchFixture(
  provider: string,
  matched: ReportedFinancialRecord,
  mismatchedMinor: bigint,
): SimulationAdapterFixture {
  return {
    provider,
    transactions: [matched],
    mismatchAmountMinor: mismatchedMinor,
  };
}
