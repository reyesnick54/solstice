import type {
  RegulatoryEvidencePackage,
  ReportingObligation,
  StructuredReportPackage,
} from './types.ts';
import type { ValidationFailureCode } from './taxonomy.ts';

export type ValidationResult = {
  readonly ok: boolean;
  readonly failures: readonly ValidationFailureCode[];
};

export function validateReportPackage(
  report: StructuredReportPackage,
  obligation: ReportingObligation,
  evidencePackage: RegulatoryEvidencePackage,
): ValidationResult {
  const failures: ValidationFailureCode[] = [];

  if (!report.reportType || !report.policyVersion) {
    failures.push('MISSING_REQUIRED_FIELD');
  }

  if (obligation.policyVersion === 'unknown' || !obligation.approvedPolicySourceRef) {
    failures.push('OBLIGATION_VERSION_UNKNOWN');
  }

  if (obligation.responsibleFiler === 'UNRESOLVED') {
    failures.push('RESPONSIBLE_FILER_UNRESOLVED');
  }

  for (const req of obligation.evidenceRequirementRefs) {
    const satisfied =
      evidencePackage.evidenceRefs.includes(req) ||
      evidencePackage.controlDecisions.kernelDecisionRef === req ||
      evidencePackage.controlDecisions.riskDecisionRef === req ||
      evidencePackage.financialRefs.orderId !== null;
    if (!satisfied && req !== 'ev_req_case_record') {
      failures.push('EVIDENCE_INCOMPLETE');
      break;
    }
  }

  if (!evidencePackage.capabilityPolicyVersion) {
    failures.push('POLICY_VERSION_MISSING');
  }

  const hasFinancialTruth =
    report.sections.some((s) => s.financialRecordRefs.length > 0) ||
    report.sections.some((s) => s.canonicalEventIds.length > 0);
  if (!hasFinancialTruth && obligation.triggerCategory === 'ORDER_TRADING_EVENT') {
    failures.push('FINANCIAL_RECONCILIATION_MISMATCH');
  }

  if (obligation.mappingStatus === 'UNMAPPED') {
    failures.push('CRITICAL_MISMATCH');
  }

  return Object.freeze({
    ok: failures.length === 0,
    failures: Object.freeze(failures),
  });
}

export function submissionStateAfterValidation(
  validation: ValidationResult,
): 'VALIDATION_REQUIRED' | 'READY_FOR_AUTHORIZED_SUBMISSION' {
  return validation.ok ? 'READY_FOR_AUTHORIZED_SUBMISSION' : 'VALIDATION_REQUIRED';
}
