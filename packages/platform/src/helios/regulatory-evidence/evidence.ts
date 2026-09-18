import type { EvidenceVault } from '../../../../evidence/src/vault.ts';
import type { RegulatoryEvidencePackage, ReportingObligation, StructuredReportPackage } from './types.ts';

export function sealRegulatoryEvidencePackage(
  vault: EvidenceVault | undefined,
  pkg: RegulatoryEvidencePackage,
): string | null {
  if (!vault) {
    return null;
  }
  const sealed = vault.seal('HELIOS_REGULATORY_EVIDENCE_PACKAGE', {
    packageId: pkg.packageId,
    traceId: pkg.traceId,
    packageVersion: pkg.packageVersion,
    packageHash: pkg.packageHash,
    customerId: pkg.customerScope.customerId,
    workOrderId: pkg.workOrderId,
    actionEventRef: pkg.actionEventRef,
    jurisdiction: pkg.jurisdiction,
    legalEntityRef: pkg.legalEntityRef,
    capabilityPolicyVersion: pkg.capabilityPolicyVersion,
    obligationRefs: pkg.obligationRefs,
    evidenceRefs: pkg.evidenceRefs,
    reportabilityDetermination: pkg.reportabilityDetermination,
    reportingStatus: pkg.reportingStatus,
    grantsExecutionAuthority: false,
    grantsFinancialEffect: false,
    authorizesFinancialExecution: false,
  });
  return sealed.evidenceId;
}

export function sealReportingObligation(
  vault: EvidenceVault | undefined,
  obligation: ReportingObligation,
): string | null {
  if (!vault) {
    return null;
  }
  const sealed = vault.seal('HELIOS_REPORTING_OBLIGATION', {
    obligationId: obligation.obligationId,
    traceId: obligation.traceId,
    packageId: obligation.packageId,
    policyObligationRef: obligation.policyObligationRef,
    policyVersion: obligation.policyVersion,
    responsibleFiler: obligation.responsibleFiler,
    submissionState: obligation.submissionState,
    mappingStatus: obligation.mappingStatus,
    grantsExecutionAuthority: false,
    grantsFinancialEffect: false,
    authorizesFinancialExecution: false,
  });
  return sealed.evidenceId;
}

export function sealReportPackage(
  vault: EvidenceVault | undefined,
  report: StructuredReportPackage,
): string | null {
  if (!vault) {
    return null;
  }
  const sealed = vault.seal('HELIOS_REGULATORY_REPORT_PACKAGE', {
    reportPackageId: report.reportPackageId,
    obligationId: report.obligationId,
    traceId: report.traceId,
    revision: report.revision,
    submissionState: report.submissionState,
    policyVersion: report.policyVersion,
    canonicalEventIds: report.sections.flatMap((s) => [...s.canonicalEventIds]),
    financialRecordRefs: report.sections.flatMap((s) => [...s.financialRecordRefs]),
    grantsExecutionAuthority: false,
    grantsFinancialEffect: false,
    authorizesFinancialExecution: false,
    claimsFiled: false,
  });
  return sealed.evidenceId;
}
