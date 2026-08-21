import type { OperationalAlert } from './alerts.ts';
import type { ReconciliationBreak } from './breaks.ts';
import type { DailyCloseReport } from './daily-close.ts';
import type { TreasuryLiquidityView } from './liquidity-view.ts';
import type { ProviderReportedBalance } from './provider-balance.ts';
import type { ReconciliationRun } from './replay.ts';
import type { SettlementRecord } from './settlement.ts';
import type { SuspenseItem } from './suspense.ts';

export type FinancialControlSnapshot = {
  readonly providerBalances: readonly ProviderReportedBalance[];
  readonly settlements: readonly SettlementRecord[];
  readonly runs: readonly ReconciliationRun[];
  readonly breaks: readonly ReconciliationBreak[];
  readonly suspense: readonly SuspenseItem[];
  readonly closes: readonly DailyCloseReport[];
  readonly alerts: readonly OperationalAlert[];
  readonly liquidity: readonly TreasuryLiquidityView[];
};

export class FinancialControlStore {
  private readonly providerBalances = new Map<string, ProviderReportedBalance>();
  private readonly settlements = new Map<string, SettlementRecord>();
  private readonly runs = new Map<string, ReconciliationRun>();
  private readonly runsByHash = new Map<string, string>();
  private readonly breaks = new Map<string, ReconciliationBreak>();
  private readonly suspense = new Map<string, SuspenseItem>();
  private readonly closes = new Map<string, DailyCloseReport>();
  private readonly alerts = new Map<string, OperationalAlert>();
  private readonly liquidity = new Map<string, TreasuryLiquidityView>();

  putProviderBalance(row: ProviderReportedBalance): void {
    this.providerBalances.set(row.providerBalanceId, row);
  }

  listProviderBalances(): readonly ProviderReportedBalance[] {
    return [...this.providerBalances.values()];
  }

  putSettlement(row: SettlementRecord): void {
    this.settlements.set(row.settlementId, row);
  }

  getSettlement(id: string): SettlementRecord | undefined {
    return this.settlements.get(id);
  }

  listSettlements(): readonly SettlementRecord[] {
    return [...this.settlements.values()];
  }

  putRun(row: ReconciliationRun): void {
    this.runs.set(row.runId, row);
    this.runsByHash.set(`${row.provider}:${row.inputHash}`, row.runId);
  }

  getRun(id: string): ReconciliationRun | undefined {
    return this.runs.get(id);
  }

  getRunByInputHash(provider: string, inputHash: string): ReconciliationRun | undefined {
    const id = this.runsByHash.get(`${provider}:${inputHash}`);
    return id ? this.runs.get(id) : undefined;
  }

  listRuns(): readonly ReconciliationRun[] {
    return [...this.runs.values()];
  }

  putBreak(row: ReconciliationBreak): void {
    this.breaks.set(row.breakId, row);
  }

  getBreak(id: string): ReconciliationBreak | undefined {
    return this.breaks.get(id);
  }

  listBreaks(): readonly ReconciliationBreak[] {
    return [...this.breaks.values()];
  }

  listOpenBreaks(): readonly ReconciliationBreak[] {
    return this.listBreaks().filter((row) => row.status === 'OPEN' || row.status === 'INVESTIGATING' || row.status === 'ESCALATED');
  }

  putSuspense(row: SuspenseItem): void {
    this.suspense.set(row.suspenseId, row);
  }

  listSuspense(): readonly SuspenseItem[] {
    return [...this.suspense.values()];
  }

  listOpenSuspense(): readonly SuspenseItem[] {
    return this.listSuspense().filter((row) => row.status === 'OPEN' || row.status === 'REVIEW_REQUIRED');
  }

  putClose(row: DailyCloseReport): void {
    this.closes.set(row.closeId, row);
  }

  listCloses(): readonly DailyCloseReport[] {
    return [...this.closes.values()];
  }

  putAlert(row: OperationalAlert): void {
    this.alerts.set(row.alertId, row);
  }

  listAlerts(): readonly OperationalAlert[] {
    return [...this.alerts.values()];
  }

  putLiquidity(row: TreasuryLiquidityView): void {
    this.liquidity.set(row.currency, row);
  }

  listLiquidity(): readonly TreasuryLiquidityView[] {
    return [...this.liquidity.values()];
  }

  snapshot(): FinancialControlSnapshot {
    return Object.freeze({
      providerBalances: this.listProviderBalances(),
      settlements: this.listSettlements(),
      runs: this.listRuns(),
      breaks: this.listBreaks(),
      suspense: this.listSuspense(),
      closes: this.listCloses(),
      alerts: this.listAlerts(),
      liquidity: this.listLiquidity(),
    });
  }

  hydrate(snapshot: FinancialControlSnapshot): void {
    this.providerBalances.clear();
    this.settlements.clear();
    this.runs.clear();
    this.runsByHash.clear();
    this.breaks.clear();
    this.suspense.clear();
    this.closes.clear();
    this.alerts.clear();
    this.liquidity.clear();
    for (const row of snapshot.providerBalances) {
      this.putProviderBalance(row);
    }
    for (const row of snapshot.settlements) {
      this.putSettlement(row);
    }
    for (const row of snapshot.runs) {
      this.putRun(row);
    }
    for (const row of snapshot.breaks) {
      this.putBreak(row);
    }
    for (const row of snapshot.suspense) {
      this.putSuspense(row);
    }
    for (const row of snapshot.closes) {
      this.putClose(row);
    }
    for (const row of snapshot.alerts) {
      this.putAlert(row);
    }
    for (const row of snapshot.liquidity) {
      this.putLiquidity(row);
    }
  }
}
