import type { UtcInstant } from '../../../domain/src/time.ts';
import { assignCase, openComplianceCase, type ComplianceCase } from '../compliance/cases.ts';
import type { CaseState } from '../compliance/types.ts';

export const CASE_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type CasePriority = (typeof CASE_PRIORITIES)[number];

export type RegulatedCaseRecord = {
  readonly caseId: string;
  readonly detectorFactRefs: readonly string[];
  readonly customerAccountRefs: readonly string[];
  readonly accessControlled: true;
  readonly priority: CasePriority;
  readonly status: CaseState;
  readonly assignedHumanReviewer: string | null;
  readonly evidenceRefs: readonly string[];
  readonly legalGuilt: false;
  readonly createdAt: UtcInstant;
};

export type CaseManagementAcceptance = {
  readonly accepted: boolean;
  readonly providerRef: string;
  readonly caseId: string;
  readonly reasonCodes: readonly string[];
};

export type CaseManagementPort = {
  open(input: {
    readonly detectorFactRefs: readonly string[];
    readonly customerAccountRefs: readonly string[];
    readonly priority: CasePriority;
    readonly subjectRef: string;
    readonly jurisdiction: string;
    readonly evidenceRefs: readonly string[];
    readonly createdAt: UtcInstant;
  }): RegulatedCaseRecord;
  assign(caseId: string, humanReviewer: string): RegulatedCaseRecord;
  exportCase(caseId: string): RegulatedCaseRecord | null;
  accept(record: RegulatedCaseRecord): CaseManagementAcceptance;
};

export class InMemoryCaseManagementPort implements CaseManagementPort {
  readonly #cases = new Map<string, { record: RegulatedCaseRecord; compliance: ComplianceCase }>();

  open(input: {
    readonly detectorFactRefs: readonly string[];
    readonly customerAccountRefs: readonly string[];
    readonly priority: CasePriority;
    readonly subjectRef: string;
    readonly jurisdiction: string;
    readonly evidenceRefs: readonly string[];
    readonly createdAt: UtcInstant;
  }): RegulatedCaseRecord {
    const compliance = openComplianceCase({
      caseType: 'AML_ALERT',
      reasonCodes: ['SURVEILLANCE_CANDIDATE'],
      originRefs: input.detectorFactRefs,
      subjectRef: input.subjectRef,
      jurisdiction: input.jurisdiction,
      createdAt: input.createdAt,
    });
    const record: RegulatedCaseRecord = Object.freeze({
      caseId: compliance.caseId,
      detectorFactRefs: Object.freeze([...input.detectorFactRefs]),
      customerAccountRefs: Object.freeze([...input.customerAccountRefs]),
      accessControlled: true,
      priority: input.priority,
      status: compliance.status,
      assignedHumanReviewer: null,
      evidenceRefs: Object.freeze([...input.evidenceRefs]),
      legalGuilt: false,
      createdAt: input.createdAt,
    });
    this.#cases.set(record.caseId, { record, compliance });
    return record;
  }

  assign(caseId: string, humanReviewer: string): RegulatedCaseRecord {
    const current = this.#cases.get(caseId);
    if (!current) {
      throw new TypeError(`unknown case '${caseId}'`);
    }
    const compliance = assignCase(current.compliance, humanReviewer);
    const record = Object.freeze({
      ...current.record,
      status: compliance.status,
      assignedHumanReviewer: humanReviewer,
    });
    this.#cases.set(caseId, { record, compliance });
    return record;
  }

  exportCase(caseId: string): RegulatedCaseRecord | null {
    return this.#cases.get(caseId)?.record ?? null;
  }

  accept(record: RegulatedCaseRecord): CaseManagementAcceptance {
    return Object.freeze({
      accepted: this.#cases.has(record.caseId),
      providerRef: 'sandbox-case-management',
      caseId: record.caseId,
      reasonCodes: Object.freeze(this.#cases.has(record.caseId) ? ['ACCEPTED'] : ['UNKNOWN_CASE']),
    });
  }
}
