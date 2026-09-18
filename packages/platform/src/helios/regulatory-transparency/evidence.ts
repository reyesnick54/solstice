import type { EvidenceVault } from '../../../../evidence/src/vault.ts';
import type { SupervisoryExportRequest, SupervisoryExportPackage, RegulatoryChangeRequest } from './types.ts';

export function sealExportRequest(
  vault: EvidenceVault | undefined,
  request: SupervisoryExportRequest,
): string | null {
  if (!vault) return null;
  const record = vault.seal('HELIOS_SUPERVISORY_EXPORT_REQUEST', {
    exportRequestId: request.exportRequestId,
    exportMode: request.exportMode,
    approvalState: request.approvalState,
    scope: {
      jurisdictions: request.scope.jurisdictions,
      customerCount: request.scope.customerIds.length,
      artifactClasses: request.scope.artifactClasses,
    },
    grantsFinancialEffect: false,
    grantsExecutionAuthority: false,
  });
  return record.evidenceId;
}

export function sealExportPackage(
  vault: EvidenceVault | undefined,
  pkg: SupervisoryExportPackage,
): string | null {
  if (!vault) return null;
  const record = vault.seal('HELIOS_SUPERVISORY_EXPORT_PACKAGE', {
    packageId: pkg.packageId,
    exportRequestId: pkg.exportRequestId,
    packageHash: pkg.packageHash,
    manifestHash: pkg.manifest.manifestHash,
    artifactCount: pkg.artifacts.length,
    grantsFinancialEffect: false,
    grantsExecutionAuthority: false,
  });
  return record.evidenceId;
}

export function sealChangeRequest(
  vault: EvidenceVault | undefined,
  request: RegulatoryChangeRequest,
): string | null {
  if (!vault) return null;
  const record = vault.seal('HELIOS_REGULATORY_CHANGE_REQUEST', {
    changeRequestId: request.changeRequestId,
    state: request.state,
    officialSourceRef: request.officialSource.evidenceRef,
    grantsFinancialEffect: false,
    grantsExecutionAuthority: false,
  });
  return record.evidenceId;
}

export function sealPolicyActivation(
  vault: EvidenceVault | undefined,
  input: {
    readonly changeRequestId: string;
    readonly policyVersionRef: string;
    readonly activatedAt: string;
    readonly approverId: string;
  },
): string | null {
  if (!vault) return null;
  const record = vault.seal('HELIOS_POLICY_VERSION_ACTIVATED', {
    ...input,
    grantsFinancialEffect: false,
    grantsExecutionAuthority: false,
  });
  return record.evidenceId;
}

export function sealPolicyRollback(
  vault: EvidenceVault | undefined,
  input: {
    readonly changeRequestId: string;
    readonly retiredVersionRef: string;
    readonly rollbackVersionRef: string;
    readonly rolledBackAt: string;
  },
): string | null {
  if (!vault) return null;
  const record = vault.seal('HELIOS_POLICY_VERSION_ROLLBACK', {
    ...input,
    grantsFinancialEffect: false,
    grantsExecutionAuthority: false,
  });
  return record.evidenceId;
}
