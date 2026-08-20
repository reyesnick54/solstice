import type { UtcInstant } from '../../../../domain/src/time.ts';
import { openComplianceCase, type ComplianceCase } from '../cases.ts';
import type { ExternalCaseRecord } from './types.ts';

export type MappedExternalCase = {
  readonly case: ComplianceCase;
  readonly externalCaseId: string;
  readonly externalSystemIsCanonical: false;
};

/**
 * External case-management systems are not canonical compliance authority.
 * They map into the existing case fabric; Kernel / human operators remain decisive.
 */
export class FixtureCaseManagementAdapter {
  readonly #byExternalId = new Map<string, MappedExternalCase>();

  ingest(record: ExternalCaseRecord, now: UtcInstant, jurisdiction = 'GB'): MappedExternalCase {
    const existing = this.#byExternalId.get(record.externalCaseId);
    if (existing) {
      return existing;
    }
    const opened = openComplianceCase({
      caseType: 'AML_ALERT',
      reasonCodes: Object.freeze(['EXTERNAL_CASE_MAPPED', record.status]),
      originRefs: Object.freeze([`external-case:${record.externalCaseId}`]),
      subjectRef: record.assigneeRef ?? record.externalCaseId,
      jurisdiction,
      createdAt: now,
    });
    const mapped: MappedExternalCase = Object.freeze({
      case: opened,
      externalCaseId: record.externalCaseId,
      externalSystemIsCanonical: false,
    });
    this.#byExternalId.set(record.externalCaseId, mapped);
    return mapped;
  }
}

export function caseProviderIsCanonicalAuthority(): false {
  return false;
}
