import type {
  LaunchFreezeObservation,
  LaunchFreezeStaleness,
  LaunchFreezeStalenessReason,
  ProductionLaunchCandidateFreeze,
} from './types.ts';

export function observationFromFreeze(freeze: ProductionLaunchCandidateFreeze): LaunchFreezeObservation {
  return Object.freeze({
    sourceCommit: freeze.sourceCommit,
    architectureManifestHash: freeze.architectureManifestHash,
    productionParameterPackageHash: freeze.productionParameterPackageHash,
    productionEconomicAuthorizationHash: freeze.productionEconomicAuthorizationHash,
    genesisCandidateHash: freeze.genesisCandidateHash,
    validatorCandidateSetHash: freeze.validatorCandidateSetHash,
    cryptographicPolicyHash: freeze.cryptographicPolicyHash,
    externalEvidenceSnapshotHash: freeze.externalEvidenceSnapshotHash,
    externalEvidenceExpired: freeze.blockers.includes('EXTERNAL_EVIDENCE_EXPIRED'),
    externalEvidenceRevoked: freeze.blockers.includes('EXTERNAL_EVIDENCE_REVOKED'),
    operatingScopeSnapshotHash: freeze.operatingScopeSnapshotHash,
    providerBindingSnapshotHash: freeze.providerBindingSnapshotHash,
    databaseMigrationManifestHash: freeze.databaseMigrationManifestHash,
    securityBundleHash: freeze.auditBundleHash,
    fullPlatformCandidateHash: freeze.fullPlatformCandidateHash,
  });
}

export function evaluateLaunchCandidateStaleness(
  freeze: ProductionLaunchCandidateFreeze,
  observation: LaunchFreezeObservation,
): LaunchFreezeStaleness {
  const reasons: LaunchFreezeStalenessReason[] = [];
  if (observation.sourceCommit !== freeze.sourceCommit) {
    reasons.push('SOURCE_COMMIT_CHANGED');
  }
  if (observation.architectureManifestHash !== freeze.architectureManifestHash) {
    reasons.push('ARCHITECTURE_MANIFEST_CHANGED');
  }
  if (observation.productionParameterPackageHash !== freeze.productionParameterPackageHash) {
    reasons.push('PARAMETER_PACKAGE_CHANGED');
  }
  if (observation.productionEconomicAuthorizationHash !== freeze.productionEconomicAuthorizationHash) {
    reasons.push('ECONOMIC_AUTHORIZATION_CHANGED');
  }
  if (observation.genesisCandidateHash !== freeze.genesisCandidateHash) {
    reasons.push('GENESIS_CHANGED');
  }
  if (observation.validatorCandidateSetHash !== freeze.validatorCandidateSetHash) {
    reasons.push('VALIDATOR_SET_CHANGED');
  }
  if (observation.cryptographicPolicyHash !== freeze.cryptographicPolicyHash) {
    reasons.push('CRYPTO_POLICY_CHANGED');
  }
  if (observation.externalEvidenceExpired) {
    reasons.push('EXTERNAL_EVIDENCE_EXPIRED');
  }
  if (observation.externalEvidenceRevoked) {
    reasons.push('EXTERNAL_EVIDENCE_REVOKED');
  }
  if (observation.operatingScopeSnapshotHash !== freeze.operatingScopeSnapshotHash) {
    reasons.push('OPERATING_SCOPE_CHANGED');
  }
  if (observation.providerBindingSnapshotHash !== freeze.providerBindingSnapshotHash) {
    reasons.push('PROVIDER_BINDING_CHANGED');
  }
  if (observation.databaseMigrationManifestHash !== freeze.databaseMigrationManifestHash) {
    reasons.push('DATABASE_MIGRATION_CHANGED');
  }
  if (observation.securityBundleHash !== freeze.auditBundleHash) {
    reasons.push('SECURITY_BUNDLE_CHANGED');
  }
  if (observation.fullPlatformCandidateHash !== freeze.fullPlatformCandidateHash) {
    reasons.push('FULL_PLATFORM_QUALIFICATION_CHANGED');
  }
  void observation.environmental;
  return Object.freeze({
    freezeHash: freeze.freezeHash,
    stale: reasons.length > 0,
    status: reasons.length > 0 ? ('STALE' as const) : ('CURRENT' as const),
    reasons: Object.freeze(reasons),
    environmentalMetricsIgnored: true,
  });
}
