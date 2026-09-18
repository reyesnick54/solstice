import { sha256Hex } from '../../../../security/src/hash.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';
import { reportPackageIdFor } from './ids.ts';
import type {
  RegulatoryEvidencePackage,
  ReportingObligation,
  ReportPackageSection,
  StructuredReportPackage,
} from './types.ts';
import type { SubmissionLifecycleState } from './taxonomy.ts';

export function generateStructuredReportPackage(input: {
  readonly obligation: ReportingObligation;
  readonly evidencePackage: RegulatoryEvidencePackage;
  readonly revision: number;
  readonly now: UtcInstant;
  readonly supersedesReportPackageId?: string | null;
  readonly correctionReason?: string | null;
  readonly narrativeSummary?: string | null;
}): StructuredReportPackage {
  const { obligation, evidencePackage, revision, now } = input;
  const reportPackageId = reportPackageIdFor(obligation.obligationId, revision);

  const sections: ReportPackageSection[] = [
    Object.freeze({
      sectionId: 'customer_context',
      title: 'Customer Context',
      canonicalEventIds: Object.freeze([evidencePackage.actionEventRef]),
      financialRecordRefs: Object.freeze([]),
      complianceDecisionRefs: Object.freeze([]),
      providerEvidenceRefs: Object.freeze([]),
      policyVersion: evidencePackage.capabilityPolicyVersion,
      capturedAt: now,
      narrativeSummary: input.narrativeSummary ?? null,
    }),
    Object.freeze({
      sectionId: 'control_decisions',
      title: 'Control Decisions',
      canonicalEventIds: Object.freeze(
        [
          evidencePackage.controlDecisions.riskDecisionRef,
          evidencePackage.controlDecisions.kernelDecisionRef,
          evidencePackage.controlDecisions.envelopeId,
        ].filter((v): v is string => v !== null),
      ),
      financialRecordRefs: Object.freeze([]),
      complianceDecisionRefs: Object.freeze(
        [
          evidencePackage.controlDecisions.kernelDecisionRef,
          evidencePackage.controlDecisions.riskDecisionRef,
        ].filter((v): v is string => v !== null),
      ),
      providerEvidenceRefs: Object.freeze([]),
      policyVersion: obligation.policyVersion,
      capturedAt: now,
      narrativeSummary: null,
    }),
    Object.freeze({
      sectionId: 'financial_lifecycle',
      title: 'Financial Lifecycle',
      canonicalEventIds: Object.freeze(
        [
          evidencePackage.financialRefs.orderId,
          evidencePackage.financialRefs.acknowledgementRef,
          evidencePackage.financialRefs.reconciliationRef,
        ].filter((v): v is string => v !== null),
      ),
      financialRecordRefs: Object.freeze([
        ...(evidencePackage.financialRefs.orderId ? [evidencePackage.financialRefs.orderId] : []),
        ...evidencePackage.financialRefs.fillRefs,
        ...evidencePackage.financialRefs.feeRefs,
        ...evidencePackage.financialRefs.settlementRefs,
        ...(evidencePackage.financialRefs.withdrawalRef ? [evidencePackage.financialRefs.withdrawalRef] : []),
      ]),
      complianceDecisionRefs: Object.freeze([]),
      providerEvidenceRefs: Object.freeze(
        evidencePackage.authorityContext.providerId
          ? [`provider_ev_${evidencePackage.authorityContext.providerId}`]
          : [],
      ),
      policyVersion: obligation.policyVersion,
      capturedAt: now,
      narrativeSummary: null,
    }),
  ];

  const body = {
    reportPackageId,
    obligationId: obligation.obligationId,
    revision,
    sections,
    policyVersion: obligation.policyVersion,
  };

  const packageHash = sha256Hex(JSON.stringify(body));

  const report: StructuredReportPackage = Object.freeze({
    reportPackageId,
    obligationId: obligation.obligationId,
    packageId: evidencePackage.packageId,
    traceId: evidencePackage.traceId,
    revision,
    reportType: obligation.reportType,
    policyVersion: obligation.policyVersion,
    responsibleFiler: obligation.responsibleFiler,
    sections: Object.freeze(sections),
    validationFailures: Object.freeze([]),
    submissionState: 'DRAFT' as SubmissionLifecycleState,
    generatedAt: now,
    supersedesReportPackageId: (input.supersedesReportPackageId ?? null) as StructuredReportPackage['supersedesReportPackageId'],
    correctionReason: input.correctionReason ?? null,
    packageHash,
  });

  return report;
}
