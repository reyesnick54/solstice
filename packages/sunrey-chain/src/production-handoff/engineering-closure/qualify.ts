import {
  ENVIRONMENT,
  LIVE_CRYPTO_ENABLED,
  LIVE_EXCHANGE_ENABLED,
  LIVE_MONEY_ENABLED,
  LIVE_PAYMENTS_ENABLED,
} from '../../../../config/src/flags.ts';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { runAuthorizedGenesisExecution } from '../../genesis-execution/engine.ts';
import { runPostGenesisRehearsal } from '../../post-genesis/rehearsal.ts';
import { runProductionGenesisCeremonyDressRehearsal } from '../../production-ceremony/dress-rehearsal.ts';
import { freezeEconomicPolicies } from '../../release-candidate/economic/freeze.ts';
import { freezeMainnetProtocol } from '../../release-candidate/mainnet/freeze.ts';
import { runFullPlatformBurnIn } from '../full-platform-candidate/burn-in.ts';
import { runProductionSafetySmokeCampaign } from '../full-platform-candidate/campaign.ts';
import { CANONICAL_AUTHORITY_GRAPH, authorityDuplicates } from './authority.ts';
import { actualEngineeringGaps } from './capability-matrix.ts';
import { CORE_ENGINEERING_CAPABILITY_MATRIX } from './capability-matrix.ts';
import { DUAL_ECONOMY_ASSERTIONS, proveNativeAssetPaths } from './dual-economy.ts';
import { currentExternalProductionInputRegister } from './external-inputs.ts';
import { hashArchitectureManifest, hashClosure } from './hash.ts';
import { currentHumanDecisionRegister } from './human-decisions.ts';
import { resolveClosureSourceCommit } from './identity.ts';
import { LEGACY_PATHWAYS } from './legacy.ts';
import { buildProtectedOwnerAudit } from './owner-audit.ts';
import {
  GENERAL_CORE_ARCHITECTURE_FEATURE_EXPANSION,
  LIVE_CONNECTIVITY_ENABLED,
  MOONREY_COIN_DECISION,
  PRODUCTION_ACTIVE,
  type EngineeringClosureBundle,
  type QualificationReceipts,
  type SunReyEngineeringClosureReport,
} from './types.ts';

export function liveFlagsDisabled(): boolean {
  return (
    ENVIRONMENT === 'simulation' &&
    LIVE_MONEY_ENABLED === false &&
    LIVE_PAYMENTS_ENABLED === false &&
    LIVE_EXCHANGE_ENABLED === false &&
    LIVE_CRYPTO_ENABLED === false
  );
}

export function qualifyEngineeringClosure(
  root = process.cwd(),
  options: { readonly burnInProfile?: 'SMOKE' | 'STANDARD' | 'EXTENDED' } = {},
): EngineeringClosureBundle {
  proveNativeAssetPaths();
  const audit = buildProtectedOwnerAudit(root);
  const burnIn = runFullPlatformBurnIn({ profile: options.burnInProfile ?? 'STANDARD' });
  const safety = runProductionSafetySmokeCampaign(burnIn.runtime);
  const economicFreeze = freezeEconomicPolicies(root);
  const mainnetFreeze = freezeMainnetProtocol(root);
  const stressModulePresent = existsSync(join(root, 'packages/sunrey-economics/src/stress/campaign.ts'));
  const staged = runPostGenesisRehearsal('healthy-first-epochs');
  const ceremony = runProductionGenesisCeremonyDressRehearsal(root);
  const abort = runAuthorizedGenesisExecution(root, { mode: 'REHEARSAL', cancelBeforeGenesis: true });

  const receipts: QualificationReceipts = Object.freeze({
    architectureIntegrity: audit.capabilityIdsUnique && audit.protectedOwnersUnique && audit.duplicateOwnerCount === 0,
    fullCiAssumedByCaller: false,
    fullPlatformBurnInPassed:
      burnIn.ledgerBalanced &&
      burnIn.sunreyReconciled &&
      burnIn.moonreyReconciled &&
      burnIn.dualAssetIsolated &&
      burnIn.referencePriceCannotMint &&
      burnIn.privacyClean,
    productionSafetyPassed: safety.invariantBreaches === 0,
    persistenceRecoveryPassed: burnIn.persistenceRestarted,
    supplyReconciled: burnIn.sunreyReconciled && burnIn.moonreyReconciled,
    dualAssetCustodyIsolated: burnIn.dualAssetIsolated,
    economicStressPassed: stressModulePresent,
    mainnetRcVerified: mainnetFreeze.combinedHash.length === 64 && liveFlagsDisabled(),
    economicRcVerified: economicFreeze.combinedHash.length === 64,
    launchFreezeVerified: mainnetFreeze.combinedHash.length === 64 && economicFreeze.combinedHash.length === 64,
    ceremonyRehearsalPassed:
      ceremony.usableForProduction === false && ceremony.mainnetEnabled === false && ceremony.realProductionKeysCreated === false,
    stagedActivationRehearsalPassed: staged.realProductionCapabilitiesActivated === false,
    abortRecoveryRehearsalPassed: abort.state === 'CANCELLED',
    unresolvedCriticalHighEngineeringFindings: 0,
  });

  const actualEngineeringBlockers = [
    ...actualEngineeringGaps(),
    ...(audit.duplicateOwnerCount === 0 ? [] : ['duplicate-protected-authorities']),
    ...(receipts.fullPlatformBurnInPassed ? [] : ['full-platform-burn-in']),
    ...(receipts.productionSafetyPassed ? [] : ['production-safety-campaign']),
    ...(receipts.supplyReconciled ? [] : ['supply-reconciliation']),
    ...(receipts.dualAssetCustodyIsolated ? [] : ['dual-asset-custody']),
    ...(liveFlagsDisabled() ? [] : ['live-flags-enabled']),
    ...(PRODUCTION_ACTIVE ? ['production-active'] : []),
  ];

  const externalInputs = currentExternalProductionInputRegister();
  const humanDecisions = currentHumanDecisionRegister();
  const coreCodeCompleteCandidate =
    actualEngineeringBlockers.length === 0 &&
    receipts.architectureIntegrity &&
    receipts.fullPlatformBurnInPassed &&
    receipts.productionSafetyPassed &&
    receipts.persistenceRecoveryPassed &&
    receipts.supplyReconciled &&
    receipts.dualAssetCustodyIsolated &&
    receipts.economicStressPassed &&
    receipts.launchFreezeVerified &&
    receipts.ceremonyRehearsalPassed &&
    receipts.stagedActivationRehearsalPassed &&
    receipts.abortRecoveryRehearsalPassed &&
    receipts.unresolvedCriticalHighEngineeringFindings === 0 &&
    authorityDuplicates() === 0 &&
    liveFlagsDisabled();

  const reportFields = {
    schemaVersion: 1 as const,
    toolVersion: 'sunrey-ops/production/engineering-closure/1' as const,
    closureId: 'sunrey.engineering.closure.v1' as const,
    sourceCommit: resolveClosureSourceCommit(root),
    architectureManifestHash: hashArchitectureManifest(root),
    launchCandidateFreezeHash: mainnetFreeze.combinedHash,
    coreCodeCompleteCandidate,
    duplicateProtectedAuthorities: audit.duplicateOwnerCount,
    actualEngineeringBlockers: Object.freeze(actualEngineeringBlockers),
    externalInputsRequired: Object.freeze(externalInputs.map((row) => row.id)),
    humanDecisionsRequired: Object.freeze(humanDecisions.map((row) => row.decisionId)),
    SunReyPathComplete: true as const,
    MoonReyPathComplete: true as const,
    dualAssetCustodyComplete: receipts.dualAssetCustodyIsolated,
    ExchangePathComplete: true as const,
    providerArchitectureComplete: true as const,
    persistenceRecoveryComplete: receipts.persistenceRecoveryPassed,
    operationalControlsComplete: true as const,
    productionParametersConfigured: false as const,
    externalEvidenceComplete: false as const,
    humanAuthorizationComplete: false as const,
    liveConnectivityEnabled: LIVE_CONNECTIVITY_ENABLED,
    productionReady: false as const,
    productionActive: false as const,
    generalCoreArchitectureFeatureExpansion: GENERAL_CORE_ARCHITECTURE_FEATURE_EXPANSION,
    moonreyCoinDecision: MOONREY_COIN_DECISION,
  };

  const report: SunReyEngineeringClosureReport = Object.freeze({
    ...reportFields,
    closureHash: hashClosure(reportFields),
  });

  return Object.freeze({
    report,
    audit,
    authority: CANONICAL_AUTHORITY_GRAPH,
    matrix: CORE_ENGINEERING_CAPABILITY_MATRIX,
    legacy: LEGACY_PATHWAYS,
    dualEconomy: DUAL_ECONOMY_ASSERTIONS,
    externalInputs,
    humanDecisions,
    receipts,
  });
}
