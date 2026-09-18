import type { CustomerId } from '../../../../domain/src/customer.ts';
import type {
  RegulatoryEvidencePackageId,
  RegulatoryTraceId,
  ReportPackageId,
  ReportingObligationId,
} from './ids.ts';
import type {
  RegulatoryEvidencePackage,
  RegulatoryEvidenceStoreSnapshot,
  ReportingObligation,
  StructuredReportPackage,
  SubmissionAcknowledgement,
  TriggerEvent,
} from './types.ts';

export class InMemoryRegulatoryEvidenceStore {
  private readonly packages = new Map<RegulatoryEvidencePackageId, RegulatoryEvidencePackage>();
  private readonly obligations = new Map<ReportingObligationId, ReportingObligation>();
  private readonly reportPackages = new Map<ReportPackageId, StructuredReportPackage>();
  private readonly submissions: SubmissionAcknowledgement[] = [];
  private readonly triggers = new Map<string, TriggerEvent>();
  private readonly idempotencyKeys = new Set<string>();

  putPackage(pkg: RegulatoryEvidencePackage): void {
    if (this.packages.has(pkg.packageId)) {
      throw new Error(`package already exists: ${pkg.packageId}`);
    }
    this.packages.set(pkg.packageId, pkg);
  }

  getPackage(packageId: RegulatoryEvidencePackageId): RegulatoryEvidencePackage | null {
    return this.packages.get(packageId) ?? null;
  }

  packagesForTrace(traceId: RegulatoryTraceId): readonly RegulatoryEvidencePackage[] {
    return Object.freeze([...this.packages.values()].filter((p) => p.traceId === traceId));
  }

  latestPackageForTrace(traceId: RegulatoryTraceId): RegulatoryEvidencePackage | null {
    const packages = this.packagesForTrace(traceId);
    if (packages.length === 0) {
      return null;
    }
    return packages.reduce((latest, current) =>
      current.packageVersion > latest.packageVersion ? current : latest,
    );
  }

  putObligation(obligation: ReportingObligation): void {
    if (this.obligations.has(obligation.obligationId)) {
      throw new Error(`obligation already exists: ${obligation.obligationId}`);
    }
    this.obligations.set(obligation.obligationId, obligation);
  }

  updateObligation(obligation: ReportingObligation): void {
    this.obligations.set(obligation.obligationId, obligation);
  }

  getObligation(obligationId: ReportingObligationId): ReportingObligation | null {
    return this.obligations.get(obligationId) ?? null;
  }

  obligationsForTrace(traceId: RegulatoryTraceId): readonly ReportingObligation[] {
    return Object.freeze([...this.obligations.values()].filter((o) => o.traceId === traceId));
  }

  obligationsForCustomer(customerId: CustomerId): readonly ReportingObligation[] {
    const traceIds = new Set(
      [...this.packages.values()]
        .filter((p) => p.customerScope.customerId === customerId)
        .map((p) => p.traceId),
    );
    return Object.freeze(
      [...this.obligations.values()].filter((o) => traceIds.has(o.traceId)),
    );
  }

  putReportPackage(report: StructuredReportPackage): void {
    if (this.reportPackages.has(report.reportPackageId)) {
      throw new Error(`report package already exists: ${report.reportPackageId}`);
    }
    this.reportPackages.set(report.reportPackageId, report);
  }

  updateReportPackage(report: StructuredReportPackage): void {
    this.reportPackages.set(report.reportPackageId, report);
  }

  getReportPackage(reportPackageId: ReportPackageId): StructuredReportPackage | null {
    return this.reportPackages.get(reportPackageId) ?? null;
  }

  reportPackagesForObligation(obligationId: ReportingObligationId): readonly StructuredReportPackage[] {
    return Object.freeze(
      [...this.reportPackages.values()].filter((r) => r.obligationId === obligationId),
    );
  }

  addSubmission(submission: SubmissionAcknowledgement): void {
    this.submissions.push(submission);
  }

  submissionsForObligation(obligationId: ReportingObligationId): readonly SubmissionAcknowledgement[] {
    return Object.freeze(this.submissions.filter((s) => s.obligationId === obligationId));
  }

  putTrigger(trigger: TriggerEvent): void {
    if (this.triggers.has(trigger.idempotencyKey)) {
      return;
    }
    this.triggers.set(trigger.idempotencyKey, trigger);
  }

  getTriggerByIdempotencyKey(key: string): TriggerEvent | null {
    return this.triggers.get(key) ?? null;
  }

  markIdempotencyKey(key: string): boolean {
    if (this.idempotencyKeys.has(key)) {
      return false;
    }
    this.idempotencyKeys.add(key);
    return true;
  }

  hasIdempotencyKey(key: string): boolean {
    return this.idempotencyKeys.has(key);
  }

  snapshot(): RegulatoryEvidenceStoreSnapshot {
    return Object.freeze({
      packages: Object.freeze([...this.packages.values()]),
      obligations: Object.freeze([...this.obligations.values()]),
      reportPackages: Object.freeze([...this.reportPackages.values()]),
      submissions: Object.freeze([...this.submissions]),
      triggers: Object.freeze([...this.triggers.values()]),
      processedIdempotencyKeys: Object.freeze([...this.idempotencyKeys]),
    });
  }

  restore(snapshot: RegulatoryEvidenceStoreSnapshot): void {
    this.packages.clear();
    this.obligations.clear();
    this.reportPackages.clear();
    this.submissions.length = 0;
    this.triggers.clear();
    this.idempotencyKeys.clear();
    for (const pkg of snapshot.packages) {
      this.packages.set(pkg.packageId, pkg);
    }
    for (const obligation of snapshot.obligations) {
      this.obligations.set(obligation.obligationId, obligation);
    }
    for (const report of snapshot.reportPackages) {
      this.reportPackages.set(report.reportPackageId, report);
    }
    this.submissions.push(...snapshot.submissions);
    for (const trigger of snapshot.triggers) {
      this.triggers.set(trigger.idempotencyKey, trigger);
    }
    for (const key of snapshot.processedIdempotencyKeys) {
      this.idempotencyKeys.add(key);
    }
  }
}
