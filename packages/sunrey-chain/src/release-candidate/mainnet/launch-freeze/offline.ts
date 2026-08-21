import { launchFreezeContainsPrivateKey, launchFreezeContainsSecret } from './hash.ts';
import { summarizeLaunchFreezeDiff } from './diff.ts';
import type { LaunchFreezeDiff, LaunchFreezeOfflinePackage, ProductionLaunchCandidateFreeze } from './types.ts';

export function buildLaunchFreezeOfflinePackage(
  freeze: ProductionLaunchCandidateFreeze,
  diff?: LaunchFreezeDiff,
): LaunchFreezeOfflinePackage {
  const payload: LaunchFreezeOfflinePackage = Object.freeze({
    kind: 'SUNREY_PRODUCTION_LAUNCH_FREEZE_OFFLINE_PACKAGE',
    freezeHash: freeze.freezeHash,
    componentHashes: Object.freeze({
      architectureManifestHash: freeze.architectureManifestHash,
      architectureIntegrityBaselineHash: freeze.architectureIntegrityBaselineHash,
      packageLockHash: freeze.packageLockHash,
      mainnetRcHash: freeze.mainnetRcHash,
      economicRcHash: freeze.economicRcHash,
      fullPlatformCandidateHash: freeze.fullPlatformCandidateHash,
      productionEconomicAuthorizationHash: freeze.productionEconomicAuthorizationHash,
      productionParameterPackageHash: freeze.productionParameterPackageHash,
      externalEvidenceSnapshotHash: freeze.externalEvidenceSnapshotHash,
      operatingScopeSnapshotHash: freeze.operatingScopeSnapshotHash,
      providerBindingSnapshotHash: freeze.providerBindingSnapshotHash,
      validatorCandidateSetHash: freeze.validatorCandidateSetHash,
      cryptographicPolicyHash: freeze.cryptographicPolicyHash,
      genesisCandidateHash: freeze.genesisCandidateHash,
      genesisAllocationManifestHash: freeze.genesisAllocationManifestHash,
      productionCeremonyPlanHash: freeze.productionCeremonyPlanHash,
      databaseMigrationManifestHash: freeze.databaseMigrationManifestHash,
      configurationBaselineHash: freeze.configurationBaselineHash,
      sbomHash: freeze.sbomHash,
      provenanceHash: freeze.provenanceHash,
      auditBundleHash: freeze.auditBundleHash,
      testReceiptBundleHash: freeze.testReceiptBundleHash,
      adversarialCampaignHash: freeze.adversarialCampaignHash,
      burnInReportHash: freeze.burnInReportHash,
    }),
    versions: Object.freeze({
      freezeId: freeze.freezeId,
      schemaVersion: String(freeze.schemaVersion),
      freezeVersion: String(freeze.freezeVersion),
      sourceCommit: freeze.sourceCommit,
      mainnetRcId: freeze.mainnetRcId,
      economicRcId: freeze.economicRcId,
      genesisCandidateId: freeze.genesisCandidateId,
      ...Object.fromEntries(
        freeze.bindings.map((row) => [row.componentId, `${row.schemaVersion}:${row.contentVersion}`]),
      ),
    }),
    diffSummary: diff ? summarizeLaunchFreezeDiff(diff) : 'no comparison supplied',
    blockerSummary: freeze.blockers.join(',') || 'none',
    rawSecretsPresent: false,
    asymmetricKeyMaterialPresent: false,
    confidentialLegalDocumentsPresent: false,
  });
  if (launchFreezeContainsSecret(payload) || launchFreezeContainsPrivateKey(payload)) {
    throw new TypeError('launch freeze offline package cannot contain secrets or private keys');
  }
  return payload;
}
