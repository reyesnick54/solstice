import type {
  LaunchFreezeDiff,
  LaunchFreezeDiffChange,
  LaunchFreezeDiffClass,
  ProductionLaunchCandidateFreeze,
} from './types.ts';

const FIELD_CLASS: Readonly<Record<string, LaunchFreezeDiffClass>> = Object.freeze({
  sourceCommit: 'SOFTWARE',
  sourceTreeHash: 'SOFTWARE',
  packageLockHash: 'SOFTWARE',
  mainnetRcId: 'SOFTWARE',
  mainnetRcHash: 'SOFTWARE',
  sbomHash: 'SOFTWARE',
  provenanceHash: 'SOFTWARE',
  architectureManifestHash: 'ARCHITECTURE',
  architectureIntegrityBaselineHash: 'ARCHITECTURE',
  economicRcId: 'ECONOMICS',
  economicRcHash: 'ECONOMICS',
  productionEconomicAuthorizationHash: 'ECONOMICS',
  productionParameterPackageHash: 'ECONOMICS',
  genesisCandidateId: 'GENESIS',
  genesisCandidateHash: 'GENESIS',
  genesisAllocationManifestHash: 'GENESIS',
  productionCeremonyPlanHash: 'GENESIS',
  validatorCandidateSetHash: 'VALIDATORS',
  cryptographicPolicyHash: 'CRYPTOGRAPHY',
  providerBindingSnapshotHash: 'PROVIDER',
  externalEvidenceSnapshotHash: 'LEGAL_EXTERNAL_EVIDENCE',
  operatingScopeSnapshotHash: 'OPERATING_SCOPE',
  databaseMigrationManifestHash: 'DATABASE',
  configurationBaselineHash: 'SECURITY',
  auditBundleHash: 'SECURITY',
  testReceiptBundleHash: 'TEST_EVIDENCE',
  adversarialCampaignHash: 'TEST_EVIDENCE',
  burnInReportHash: 'TEST_EVIDENCE',
  fullPlatformCandidateHash: 'TEST_EVIDENCE',
});

const COMPARE_FIELDS = Object.keys(FIELD_CLASS);

export function diffProductionLaunchCandidates(
  oldFreeze: ProductionLaunchCandidateFreeze,
  newFreeze: ProductionLaunchCandidateFreeze,
): LaunchFreezeDiff {
  const changes: LaunchFreezeDiffChange[] = [];
  for (const field of COMPARE_FIELDS) {
    const left = String((oldFreeze as unknown as Record<string, unknown>)[field] ?? '');
    const right = String((newFreeze as unknown as Record<string, unknown>)[field] ?? '');
    if (left !== right) {
      changes.push(
        Object.freeze({
          classification: FIELD_CLASS[field] ?? 'SOFTWARE',
          field,
          left,
          right,
        }),
      );
    }
  }
  return Object.freeze({
    leftFreezeId: oldFreeze.freezeId,
    rightFreezeId: newFreeze.freezeId,
    leftHash: oldFreeze.freezeHash,
    rightHash: newFreeze.freezeHash,
    changes: Object.freeze(changes),
    autoApproved: false,
  });
}

export function summarizeLaunchFreezeDiff(diff: LaunchFreezeDiff): string {
  if (diff.changes.length === 0) {
    return 'no constitutionally relevant changes';
  }
  return diff.changes.map((change) => `${change.classification}:${change.field}`).join(',');
}
