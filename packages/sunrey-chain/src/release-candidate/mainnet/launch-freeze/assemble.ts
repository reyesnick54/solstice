import { ENVIRONMENT } from '../../../../../config/src/flags.ts';
import { collectCurrentRepositoryLaunchBindings } from './bindings.ts';
import { assembleReleaseBillOfMaterials } from './bom.ts';
import { hashLaunchFreezeMaterial } from './hash.ts';
import { validateLaunchFreezeInput } from './validate.ts';
import {
  CURRENT_LAUNCH_FREEZE_ID,
  LAUNCH_FREEZE_SCHEMA_VERSION,
  type LaunchFreezeEvaluation,
  type LaunchFreezeState,
  type LaunchReviewClass,
  type ProductionLaunchCandidateFreeze,
  type ProductionLaunchCandidateFreezeInput,
} from './types.ts';

export function deriveLaunchFreezeStatus(
  input: ProductionLaunchCandidateFreezeInput,
  blockers: readonly string[],
): LaunchFreezeState {
  if (input.supersededBy) {
    return 'SUPERSEDED';
  }
  if (input.rejected === true || blockers.includes('SECRET_VALUE_REJECTED') || blockers.includes('PRIVATE_KEY_REJECTED')) {
    return 'REJECTED';
  }
  if (blockers.includes('FLOATING_VERSION_REJECTED')) {
    return 'REJECTED';
  }
  if (blockers.includes('PRODUCTION_PARAMETERS_UNCONFIGURED')) {
    return 'AWAITING_PRODUCTION_PARAMETERS';
  }
  if (
    blockers.includes('EXTERNAL_EVIDENCE_INCOMPLETE') ||
    blockers.includes('EXTERNAL_EVIDENCE_EXPIRED') ||
    blockers.includes('EXTERNAL_EVIDENCE_REVOKED') ||
    blockers.includes('FIXTURE_EVIDENCE_CANNOT_SATISFY_PRODUCTION')
  ) {
    return 'AWAITING_EXTERNAL_EVIDENCE';
  }
  if (blockers.includes('HUMAN_AUTHORIZATION_INCOMPLETE')) {
    return 'AWAITING_HUMAN_AUTHORIZATION';
  }
  if (blockers.includes('ENGINEERING_NOT_VALIDATED')) {
    return 'INCOMPLETE';
  }
  if (
    input.requestFrozenForReview === true &&
    input.productionParametersComplete &&
    input.externalEvidenceComplete &&
    input.humanAuthorizationComplete &&
    !input.fixtureEvidenceUsed &&
    blockers.length === 0
  ) {
    return 'FROZEN_FOR_REVIEW';
  }
  if (input.engineeringValidated !== false) {
    return 'ENGINEERING_VALIDATED';
  }
  return 'DRAFT';
}

export function deriveLaunchReviewClass(input: ProductionLaunchCandidateFreezeInput): LaunchReviewClass {
  if (
    input.productionParametersComplete &&
    input.externalEvidenceComplete &&
    input.humanAuthorizationComplete &&
    !input.fixtureEvidenceUsed
  ) {
    return 'LAUNCH_REVIEW_READY';
  }
  return 'INCOMPLETE_REVIEW_CANDIDATE';
}

export function assembleLaunchCandidateFreeze(
  input: ProductionLaunchCandidateFreezeInput,
): ProductionLaunchCandidateFreeze {
  if (ENVIRONMENT !== 'simulation') {
    throw new TypeError('launch freeze may only be assembled while ENVIRONMENT is simulation');
  }
  const blockers = validateLaunchFreezeInput(input);
  const status = deriveLaunchFreezeStatus(input, blockers);
  const freeze = Object.freeze({
    freezeId: input.freezeId,
    schemaVersion: LAUNCH_FREEZE_SCHEMA_VERSION,
    freezeVersion: input.freezeVersion ?? 1,
    status,
    reviewClass: deriveLaunchReviewClass(input),
    sourceCommit: input.sourceCommit,
    sourceTreeHash: input.sourceTreeHash,
    architectureManifestHash: input.architectureManifestHash,
    architectureIntegrityBaselineHash: input.architectureIntegrityBaselineHash,
    packageLockHash: input.packageLockHash,
    mainnetRcId: input.mainnetRcId,
    mainnetRcHash: input.mainnetRcHash,
    economicRcId: input.economicRcId,
    economicRcHash: input.economicRcHash,
    fullPlatformCandidateHash: input.fullPlatformCandidateHash,
    productionEconomicAuthorizationHash: input.productionEconomicAuthorizationHash,
    productionParameterPackageHash: input.productionParameterPackageHash,
    externalEvidenceSnapshotHash: input.externalEvidenceSnapshotHash,
    operatingScopeSnapshotHash: input.operatingScopeSnapshotHash,
    providerBindingSnapshotHash: input.providerBindingSnapshotHash,
    validatorCandidateSetHash: input.validatorCandidateSetHash,
    cryptographicPolicyHash: input.cryptographicPolicyHash,
    genesisCandidateId: input.genesisCandidateId,
    genesisCandidateHash: input.genesisCandidateHash,
    genesisAllocationManifestHash: input.genesisAllocationManifestHash,
    productionCeremonyPlanHash: input.productionCeremonyPlanHash,
    databaseMigrationManifestHash: input.databaseMigrationManifestHash,
    configurationBaselineHash: input.configurationBaselineHash,
    sbomHash: input.sbomHash,
    provenanceHash: input.provenanceHash,
    auditBundleHash: input.auditBundleHash,
    testReceiptBundleHash: input.testReceiptBundleHash,
    adversarialCampaignHash: input.adversarialCampaignHash,
    burnInReportHash: input.burnInReportHash,
    freezeHash: hashLaunchFreezeMaterial(input),
    bindings: Object.freeze([...input.bindings]),
    blockers,
    productionActivated: false as const,
    mainnetEnabled: false as const,
    liveConnectivityEnabled: false as const,
    freezeEqualsApproval: false as const,
    freezeEqualsActivation: false as const,
    supersededBy: input.supersededBy ?? null,
  });
  return freeze;
}

export function inputFromFreeze(freeze: ProductionLaunchCandidateFreeze): ProductionLaunchCandidateFreezeInput {
  return {
    freezeId: freeze.freezeId,
    freezeVersion: freeze.freezeVersion,
    sourceCommit: freeze.sourceCommit,
    sourceTreeHash: freeze.sourceTreeHash,
    architectureManifestHash: freeze.architectureManifestHash,
    architectureIntegrityBaselineHash: freeze.architectureIntegrityBaselineHash,
    packageLockHash: freeze.packageLockHash,
    mainnetRcId: freeze.mainnetRcId,
    mainnetRcHash: freeze.mainnetRcHash,
    economicRcId: freeze.economicRcId,
    economicRcHash: freeze.economicRcHash,
    fullPlatformCandidateHash: freeze.fullPlatformCandidateHash,
    productionEconomicAuthorizationHash: freeze.productionEconomicAuthorizationHash,
    productionParameterPackageHash: freeze.productionParameterPackageHash,
    externalEvidenceSnapshotHash: freeze.externalEvidenceSnapshotHash,
    operatingScopeSnapshotHash: freeze.operatingScopeSnapshotHash,
    providerBindingSnapshotHash: freeze.providerBindingSnapshotHash,
    validatorCandidateSetHash: freeze.validatorCandidateSetHash,
    cryptographicPolicyHash: freeze.cryptographicPolicyHash,
    genesisCandidateId: freeze.genesisCandidateId,
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
    bindings: freeze.bindings,
    productionParametersComplete: !freeze.blockers.includes('PRODUCTION_PARAMETERS_UNCONFIGURED'),
    externalEvidenceComplete: !freeze.blockers.includes('EXTERNAL_EVIDENCE_INCOMPLETE'),
    humanAuthorizationComplete: !freeze.blockers.includes('HUMAN_AUTHORIZATION_INCOMPLETE'),
    engineeringValidated: !freeze.blockers.includes('ENGINEERING_NOT_VALIDATED'),
    supersededBy: freeze.supersededBy,
    fixtureEvidenceUsed: freeze.blockers.includes('FIXTURE_EVIDENCE_CANNOT_SATISFY_PRODUCTION'),
  };
}

export function evaluateCurrentRepositoryLaunchFreeze(
  root = process.cwd(),
  options: Parameters<typeof collectCurrentRepositoryLaunchBindings>[1] = {},
): LaunchFreezeEvaluation {
  const collected = collectCurrentRepositoryLaunchBindings(root, options);
  const freeze = assembleLaunchCandidateFreeze({
    freezeId: CURRENT_LAUNCH_FREEZE_ID,
    freezeVersion: 1,
    sourceCommit: collected.sourceCommit,
    sourceTreeHash: collected.sourceTreeHash,
    architectureManifestHash: collected.architectureManifestHash,
    architectureIntegrityBaselineHash: collected.architectureIntegrityBaselineHash,
    packageLockHash: collected.packageLockHash,
    mainnetRcId: collected.mainnetRcId,
    mainnetRcHash: collected.mainnetRcHash,
    economicRcId: collected.economicRcId,
    economicRcHash: collected.economicRcHash,
    fullPlatformCandidateHash: collected.fullPlatformCandidateHash,
    productionEconomicAuthorizationHash: collected.productionEconomicAuthorizationHash,
    productionParameterPackageHash: collected.productionParameterPackageHash,
    externalEvidenceSnapshotHash: collected.evidence.snapshotHash,
    operatingScopeSnapshotHash: collected.operatingScope.snapshotHash,
    providerBindingSnapshotHash: collected.providers.snapshotHash,
    validatorCandidateSetHash: collected.validatorCandidateSetHash,
    cryptographicPolicyHash: collected.cryptographicPolicyHash,
    genesisCandidateId: collected.genesisCandidateId,
    genesisCandidateHash: collected.genesisCandidateHash,
    genesisAllocationManifestHash: collected.genesisAllocationManifestHash,
    productionCeremonyPlanHash: collected.productionCeremonyPlanHash,
    databaseMigrationManifestHash: collected.migrations.manifestHash,
    configurationBaselineHash: collected.configuration.baselineHash,
    sbomHash: collected.sbomHash,
    provenanceHash: collected.provenanceHash,
    auditBundleHash: collected.auditBundleHash,
    testReceiptBundleHash: collected.testReceiptBundleHash,
    adversarialCampaignHash: collected.adversarialCampaignHash,
    burnInReportHash: collected.burnInReportHash,
    bindings: collected.bindings,
    productionParametersComplete: collected.productionParametersComplete,
    externalEvidenceComplete: collected.externalEvidenceComplete,
    humanAuthorizationComplete: collected.humanAuthorizationComplete,
    engineeringValidated: collected.engineeringValidated,
    fixtureEvidenceUsed: collected.fixtureEvidenceUsed,
  });
  return Object.freeze({
    freeze,
    evidence: collected.evidence,
    operatingScope: collected.operatingScope,
    providers: collected.providers,
    migrations: collected.migrations,
    configuration: collected.configuration,
    bom: assembleReleaseBillOfMaterials(collected.bindings),
    productionParametersComplete: collected.productionParametersComplete,
    externalEvidenceComplete: collected.externalEvidenceComplete,
    humanAuthorizationComplete: collected.humanAuthorizationComplete,
    unconfiguredTokenomics: collected.unconfiguredTokenomics,
    productionActive: false,
  });
}

export function supersedeLaunchCandidateFreeze(
  previous: ProductionLaunchCandidateFreeze,
  nextInput: ProductionLaunchCandidateFreezeInput,
): {
  readonly previous: ProductionLaunchCandidateFreeze;
  readonly next: ProductionLaunchCandidateFreeze;
  readonly history: readonly string[];
  readonly historyPreserved: true;
} {
  const next = assembleLaunchCandidateFreeze({
    ...nextInput,
    freezeId: nextInput.freezeId,
    freezeVersion: (previous.freezeVersion ?? 1) + 1,
  });
  const superseded = assembleLaunchCandidateFreeze({
    ...inputFromFreeze(previous),
    supersededBy: next.freezeId,
  });
  return Object.freeze({
    previous: superseded,
    next,
    history: Object.freeze([previous.freezeHash, next.freezeHash]),
    historyPreserved: true,
  });
}
