import type { InboundRailPayment } from './rail-inbound.ts';
import type { RailReturnRecord } from './rail-returns.ts';
import type { RailReconciliationResult } from './rail-reconciliation.ts';
import type { RailSubmission } from './rail-submission.ts';
import type { SettlementReport } from './rail-settlement-report.ts';
import type { CanonicalRailStatus } from './rail-types.ts';
import type { ProviderHealthRecord } from './rail-health.ts';

export type RailStatusHistoryEntry = {
  readonly railSubmissionId: string;
  readonly status: CanonicalRailStatus;
  readonly at: string;
  readonly payloadHash: string | null;
};

export class RailStore {
  private readonly submissions = new Map<string, RailSubmission>();
  private readonly byIdempotency = new Map<string, RailSubmission>();
  private readonly byPayment = new Map<string, RailSubmission>();
  private readonly history: RailStatusHistoryEntry[] = [];
  private readonly reports = new Map<string, SettlementReport>();
  private readonly returns = new Map<string, RailReturnRecord>();
  private readonly inbound = new Map<string, InboundRailPayment>();
  private readonly reconciliations = new Map<string, RailReconciliationResult>();
  private readonly health = new Map<string, ProviderHealthRecord>();

  saveSubmission(submission: RailSubmission): void {
    this.submissions.set(submission.railSubmissionId, submission);
    this.byIdempotency.set(submission.idempotencyKey, submission);
    this.byPayment.set(submission.paymentId, submission);
  }

  getSubmission(id: string): RailSubmission | undefined {
    return this.submissions.get(id);
  }

  getByIdempotency(key: string): RailSubmission | undefined {
    return this.byIdempotency.get(key);
  }

  getByPayment(paymentId: string): RailSubmission | undefined {
    return this.byPayment.get(paymentId);
  }

  appendHistory(entry: RailStatusHistoryEntry): void {
    this.history.push(Object.freeze({ ...entry }));
  }

  historyFor(railSubmissionId: string): readonly RailStatusHistoryEntry[] {
    return this.history.filter((row) => row.railSubmissionId === railSubmissionId);
  }

  saveReport(report: SettlementReport): void {
    this.reports.set(report.reportId, report);
  }

  getReport(id: string): SettlementReport | undefined {
    return this.reports.get(id);
  }

  listReports(): readonly SettlementReport[] {
    return [...this.reports.values()];
  }

  saveReturn(record: RailReturnRecord): void {
    this.returns.set(record.returnReference, record);
  }

  getReturn(id: string): RailReturnRecord | undefined {
    return this.returns.get(id);
  }

  saveInbound(row: InboundRailPayment): void {
    this.inbound.set(row.inboundId, row);
  }

  getInbound(id: string): InboundRailPayment | undefined {
    return this.inbound.get(id);
  }

  saveReconciliation(result: RailReconciliationResult): void {
    this.reconciliations.set(result.paymentId, result);
  }

  getReconciliation(paymentId: string): RailReconciliationResult | undefined {
    return this.reconciliations.get(paymentId);
  }

  saveHealth(record: ProviderHealthRecord): void {
    this.health.set(record.provider, record);
  }

  getHealth(provider: string): ProviderHealthRecord | undefined {
    return this.health.get(provider);
  }
}
