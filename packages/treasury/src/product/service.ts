import type { Clock } from '../../../config/src/clock.ts';
import { assertSimulationOnly } from '../../../config/src/flags.ts';
import type { EvidenceVault } from '../../../evidence/src/vault.ts';
import type { DomainEventLog } from '../../../events/src/events.ts';
import type { Ledger } from '../../../ledger/src/journal.ts';
import { totalUsableLiquidity } from '../position.ts';
import type { TreasuryStore } from '../store.ts';
import {
  asDailyCloseId,
  asLiquidityViewId,
  asOperationalAlertId,
  asProviderBalanceId,
  asReconciliationBreakId,
  asReconciliationRunId,
  asSuspenseItemId,
} from '../ids.ts';
import {
  SimulationReconciliationAdapter,
  type ReconciliationProviderAdapter,
  type ReconciliationWindow,
} from './adapter.ts';
import { freezeOperationalAlert, type OperationalAlert } from './alerts.ts';
import {
  freezeReconciliationBreak,
  severityForConclusion,
  withBreakStatus,
  type BreakStatus,
  type ReconciliationBreak,
} from './breaks.ts';
import { freezeDailyCloseReport, type DailyCloseReport } from './daily-close.ts';
import { freezeLiquidityView, warningStateFor, type TreasuryLiquidityView } from './liquidity-view.ts';
import { freezeProviderReportedBalance, type ProviderReportedBalance } from './provider-balance.ts';
import {
  hashReconciliationInputs,
  reconcileExpectedToReported,
  type ExpectedFinancialRecord,
  type ReportedFinancialRecord,
} from './reconciliation-engine.ts';
import { runFromEngineResult, type ReconciliationRun } from './replay.ts';
import { freezeSettlementRecord, type SettlementRecord } from './settlement.ts';
import { FinancialControlStore } from './store.ts';
import { freezeSuspenseItem, isSuspenseAging, type SuspenseItem } from './suspense.ts';

export type FinancialClosePorts = {
  readonly customerLiabilityByCurrency: Readonly<Record<string, bigint>>;
  readonly ledgerControlByCurrency: Readonly<Record<string, bigint>>;
  readonly feeTotalsByCurrency?: Readonly<Record<string, bigint>>;
  readonly pendingHoldCount?: number;
  readonly fxLongByCurrency?: Readonly<Record<string, bigint>>;
  readonly fxShortByCurrency?: Readonly<Record<string, bigint>>;
};

const SUSPENSE_AGING_MS = 86_400_000n;
const LARGE_BREAK_MINOR = 10_000n;

export class FinancialControlService {
  readonly store: FinancialControlStore;
  private readonly clock: Clock;
  private readonly evidence: EvidenceVault;
  private readonly events: DomainEventLog;
  private readonly treasury: TreasuryStore;
  private readonly ledger: Ledger | undefined;
  private adapter: ReconciliationProviderAdapter;

  constructor(
    clock: Clock,
    evidence: EvidenceVault,
    events: DomainEventLog,
    treasury: TreasuryStore,
    options: {
      readonly store?: FinancialControlStore;
      readonly adapter?: ReconciliationProviderAdapter;
      readonly ledger?: Ledger;
    } = {},
  ) {
    assertSimulationOnly();
    this.clock = clock;
    this.evidence = evidence;
    this.events = events;
    this.treasury = treasury;
    this.store = options.store ?? new FinancialControlStore();
    this.adapter = options.adapter ?? new SimulationReconciliationAdapter();
    this.ledger = options.ledger;
  }

  useAdapter(adapter: ReconciliationProviderAdapter): void {
    this.adapter = adapter;
  }

  recordProviderBalance(row: ProviderReportedBalance): ProviderReportedBalance {
    const frozen = freezeProviderReportedBalance(row);
    this.store.putProviderBalance(frozen);
    return frozen;
  }

  recordSettlement(row: SettlementRecord): SettlementRecord {
    const frozen = freezeSettlementRecord(row);
    this.store.putSettlement(frozen);
    if (frozen.status === 'FAILED' || frozen.status === 'OVERDUE') {
      this.raiseAlert({
        kind: frozen.status === 'FAILED' ? 'FAILED_SETTLEMENT_BATCH' : 'SETTLEMENT_OVERDUE',
        severity: 'HIGH',
        domain: frozen.domain,
        provider: frozen.provider,
        currency: frozen.currency,
        amountMinor: frozen.netMinor,
        message: `settlement ${frozen.settlementId} is ${frozen.status}`,
        references: [frozen.settlementId],
      });
    }
    return frozen;
  }

  placeInSuspense(input: Omit<SuspenseItem, 'status' | 'reviewedAt'> & { readonly status?: SuspenseItem['status'] }): SuspenseItem {
    const row = freezeSuspenseItem({
      ...input,
      status: input.status ?? 'REVIEW_REQUIRED',
      reviewedAt: null,
    });
    this.store.putSuspense(row);
    this.emit('TreasurySuspenseOpened', row.suspenseId, {
      suspenseId: row.suspenseId,
      amountMinor: row.amountMinor.toString(),
      currency: row.currency,
      reason: row.reason,
    });
    this.evidence.seal('TREASURY_SUSPENSE_OPENED', {
      suspenseId: row.suspenseId,
      amountMinor: row.amountMinor.toString(),
      currency: row.currency,
    });
    return row;
  }

  runReconciliation(input: {
    readonly runId: string;
    readonly window: ReconciliationWindow;
    readonly expected: readonly ExpectedFinancialRecord[];
    readonly reported?: readonly ReportedFinancialRecord[];
  }): { readonly run: ReconciliationRun; readonly replay: boolean; readonly breaks: readonly ReconciliationBreak[] } {
    const window = this.adapter.fetchReconciliationWindow(input.window);
    const statement = this.adapter.fetchStatement(window);
    if (!statement.present) {
      this.raiseAlert({
        kind: 'PROVIDER_STATEMENT_MISSING',
        severity: 'HIGH',
        domain: 'TREASURY',
        provider: window.provider,
        currency: null,
        amountMinor: null,
        message: `provider statement missing for ${window.provider}`,
        references: [window.periodStart, window.periodEnd],
      });
    }
    const reported = input.reported ?? this.adapter.fetchTransactions(window);
    const balance = this.adapter.fetchBalance(window);
    if (balance) {
      this.recordProviderBalance({
        ...balance,
        providerBalanceId: asProviderBalanceId(balance.providerBalanceId),
      });
    }
    const inputHash = hashReconciliationInputs(input.expected, reported);
    const existing = this.store.getRunByInputHash(window.provider, inputHash);
    if (existing) {
      const breaks = this.store.listBreaks().filter((row) => row.runId === existing.runId);
      return { run: existing, replay: true, breaks };
    }
    const result = reconcileExpectedToReported(input.expected, reported);
    const now = this.clock.now();
    const breaks: ReconciliationBreak[] = [];
    for (const pairing of result.pairings) {
      if (pairing.conclusion === 'MATCHED') {
        continue;
      }
      const breakRow = freezeReconciliationBreak({
        breakId: asReconciliationBreakId(`brk_${input.runId}_${pairing.expectedId ?? pairing.reportedId ?? 'unk'}`),
        runId: input.runId,
        type: pairing.conclusion,
        severity: severityForConclusion(pairing.conclusion),
        domain: 'TREASURY',
        amountMinor: pairing.amountMinor,
        currency: pairing.currency,
        provider: pairing.provider,
        internalReferences: pairing.expectedId ? [pairing.expectedId] : [],
        externalReferences: pairing.reportedId ? [pairing.reportedId] : [],
        status: pairing.conclusion === 'TIMING_DIFFERENCE' ? 'OPEN' : 'OPEN',
        owner: null,
        createdAt: now,
        resolvedAt: null,
        resolutionEvidence: null,
      });
      this.store.putBreak(breakRow);
      breaks.push(breakRow);
      if (breakRow.severity === 'CRITICAL' || (breakRow.amountMinor ?? 0n) >= LARGE_BREAK_MINOR) {
        this.raiseAlert({
          kind: 'LARGE_RECONCILIATION_BREAK',
          severity: breakRow.severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
          domain: 'TREASURY',
          provider: breakRow.provider,
          currency: breakRow.currency,
          amountMinor: breakRow.amountMinor,
          message: `reconciliation ${breakRow.type}`,
          references: [breakRow.breakId],
        });
      }
    }
    const run = runFromEngineResult({
      runId: asReconciliationRunId(input.runId),
      periodStart: window.periodStart as ReconciliationRun['periodStart'],
      periodEnd: window.periodEnd as ReconciliationRun['periodEnd'],
      provider: window.provider,
      sourceVersion: window.sourceVersion,
      result,
      breaks,
      createdAt: now,
    });
    this.store.putRun(run);
    this.emit('TreasuryReconciliationRunCompleted', run.runId, {
      runId: run.runId,
      inputHash: run.inputHash,
      matchedCount: run.matchedCount,
      breakCount: run.breakCount,
      replay: false,
    });
    this.evidence.seal('TREASURY_RECONCILIATION_RUN', {
      runId: run.runId,
      inputHash: run.inputHash,
      provider: run.provider,
      sourceVersion: run.sourceVersion,
      ledgerAdjusted: false,
    });
    return { run, replay: false, breaks };
  }

  resolveBreak(
    breakId: string,
    status: Extract<BreakStatus, 'RESOLVED' | 'ACCEPTED_TIMING_DIFFERENCE' | 'ESCALATED' | 'INVESTIGATING'>,
    evidence: string,
  ): ReconciliationBreak {
    const existing = this.store.getBreak(breakId);
    if (!existing) {
      throw new Error('RECONCILIATION_BREAK_NOT_FOUND');
    }
    const next = withBreakStatus(existing, status, this.clock.now(), evidence);
    this.store.putBreak(next);
    this.evidence.seal('TREASURY_RECONCILIATION_BREAK_UPDATED', {
      breakId: next.breakId,
      status: next.status,
      ledgerAdjusted: false,
    });
    return next;
  }

  liquidityView(): readonly TreasuryLiquidityView[] {
    const byCurrency = new Map<string, { available: bigint; outgoing: bigint; incoming: bigint; unsettled: bigint; provider: bigint | null }>();
    for (const position of this.treasury.listPositions()) {
      const current = byCurrency.get(position.currency) ?? {
        available: 0n,
        outgoing: 0n,
        incoming: 0n,
        unsettled: 0n,
        provider: null,
      };
      current.available += totalUsableLiquidity(position).minorUnits;
      current.outgoing += position.pendingOutbound.minorUnits;
      current.incoming += position.pendingInbound.minorUnits;
      current.unsettled += position.reserved.minorUnits;
      byCurrency.set(position.currency, current);
    }
    for (const settlement of this.store.listSettlements()) {
      const current = byCurrency.get(settlement.currency) ?? {
        available: 0n,
        outgoing: 0n,
        incoming: 0n,
        unsettled: 0n,
        provider: null,
      };
      if (settlement.status === 'EXPECTED' || settlement.status === 'SUBMITTED') {
        current.outgoing += settlement.netMinor;
        current.unsettled += settlement.netMinor;
      }
      byCurrency.set(settlement.currency, current);
    }
    for (const balance of this.store.listProviderBalances()) {
      const current = byCurrency.get(balance.currency) ?? {
        available: 0n,
        outgoing: 0n,
        incoming: 0n,
        unsettled: 0n,
        provider: null,
      };
      current.provider = (current.provider ?? 0n) + balance.reportedMinor;
      byCurrency.set(balance.currency, current);
    }
    const views: TreasuryLiquidityView[] = [];
    for (const [currency, row] of byCurrency) {
      const warning = warningStateFor({
        internalAvailableMinor: row.available,
        expectedOutgoingSettlementMinor: row.outgoing,
        unsettledObligationMinor: row.unsettled,
      });
      const view = freezeLiquidityView({
        viewId: asLiquidityViewId(`tlv_${currency}`),
        currency,
        internalAvailableMinor: row.available,
        expectedOutgoingSettlementMinor: row.outgoing,
        expectedIncomingSettlementMinor: row.incoming,
        providerReportedMinor: row.provider,
        unsettledObligationMinor: row.unsettled,
        warningState: warning,
        asOf: this.clock.now(),
      });
      this.store.putLiquidity(view);
      views.push(view);
      if (warning === 'INSUFFICIENT' || warning === 'NEGATIVE') {
        this.raiseAlert({
          kind: 'INSUFFICIENT_TREASURY_LIQUIDITY',
          severity: warning === 'NEGATIVE' ? 'CRITICAL' : 'HIGH',
          domain: 'TREASURY',
          provider: null,
          currency,
          amountMinor: row.available,
          message: `treasury liquidity ${warning} for ${currency}`,
          references: [view.viewId],
        });
      }
    }
    return Object.freeze(views);
  }

  dailyClose(input: {
    readonly closeId: string;
    readonly periodStart: string;
    readonly periodEnd: string;
    readonly ports: FinancialClosePorts;
  }): DailyCloseReport {
    const liquidity = this.liquidityView();
    const currencies = new Set<string>([
      ...Object.keys(input.ports.customerLiabilityByCurrency),
      ...Object.keys(input.ports.ledgerControlByCurrency),
      ...liquidity.map((row) => row.currency),
    ]);
    const totals = [...currencies].sort().map((currency) =>
      Object.freeze({
        currency,
        customerLiabilityMinor: input.ports.customerLiabilityByCurrency[currency] ?? 0n,
        ledgerControlMinor: input.ports.ledgerControlByCurrency[currency] ?? 0n,
        providerExpectedMinor: this.store
          .listSettlements()
          .filter((row) => row.currency === currency)
          .reduce((sum, row) => sum + row.netMinor, 0n),
        providerReportedMinor:
          this.store
            .listProviderBalances()
            .filter((row) => row.currency === currency)
            .reduce((sum: bigint | null, row) => (sum ?? 0n) + row.reportedMinor, null as bigint | null),
        feesMinor: input.ports.feeTotalsByCurrency?.[currency] ?? 0n,
        fxLongMinor: input.ports.fxLongByCurrency?.[currency] ?? 0n,
        fxShortMinor: input.ports.fxShortByCurrency?.[currency] ?? 0n,
      }),
    );
    for (const item of this.store.listOpenSuspense()) {
      if (isSuspenseAging(item, this.clock.now(), SUSPENSE_AGING_MS)) {
        this.raiseAlert({
          kind: 'SUSPENSE_AGING',
          severity: 'MEDIUM',
          domain: item.domain,
          provider: item.provider,
          currency: item.currency,
          amountMinor: item.amountMinor,
          message: `suspense ${item.suspenseId} is aging`,
          references: [item.suspenseId],
        });
      }
    }
    const report = freezeDailyCloseReport({
      closeId: asDailyCloseId(input.closeId),
      periodStart: input.periodStart as DailyCloseReport['periodStart'],
      periodEnd: input.periodEnd as DailyCloseReport['periodEnd'],
      generatedAt: this.clock.now(),
      legalSufficiency: 'NOT_A_REGULATORY_REPORT',
      currencyTotals: totals,
      ledgerJournalCount: this.ledger?.listJournals().length ?? 0,
      reconciliationBreaks: this.store.listOpenBreaks(),
      openSuspense: this.store.listOpenSuspense(),
      unsettledSettlementCount: this.store
        .listSettlements()
        .filter((row) => row.status === 'EXPECTED' || row.status === 'SUBMITTED' || row.status === 'PARTIAL').length,
      pendingHoldCount: input.ports.pendingHoldCount ?? 0,
      liquidity,
      notes: Object.freeze([
        'Deterministic non-production daily close',
        'Not a legally sufficient regulatory report',
        'Ledger was not adjusted to force a match',
      ]),
    });
    this.store.putClose(report);
    this.emit('TreasuryDailyCloseCompleted', report.closeId, {
      closeId: report.closeId,
      currencies: totals.map((row) => row.currency),
      breakCount: report.reconciliationBreaks.length,
    });
    this.evidence.seal('TREASURY_DAILY_CLOSE', {
      closeId: report.closeId,
      legalSufficiency: report.legalSufficiency,
    });
    return report;
  }

  private raiseAlert(input: Omit<OperationalAlert, 'alertId' | 'status' | 'createdAt' | 'references'> & { readonly references: readonly string[] }): OperationalAlert {
    const row = freezeOperationalAlert({
      alertId: asOperationalAlertId(`talert_${input.kind}_${input.references[0] ?? this.clock.now()}`),
      ...input,
      status: 'OPEN',
      createdAt: this.clock.now(),
    });
    this.store.putAlert(row);
    this.emit('TreasuryOperationalAlertRaised', row.alertId, {
      alertId: row.alertId,
      kind: row.kind,
      severity: row.severity,
    });
    return row;
  }

  private emit(eventType: string, aggregateId: string, payload: Record<string, unknown>): void {
    this.events.append({
      eventType: eventType as never,
      schemaVersion: 1,
      occurredAt: this.clock.now(),
      payload,
      aggregateType: 'treasury',
      aggregateId,
    } as never);
  }
}

export function unusedSuspenseId(suffix: string): ReturnType<typeof asSuspenseItemId> {
  return asSuspenseItemId(`susp_${suffix}`);
}
