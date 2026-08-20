/**
 * Current-repository and rehearsal-only fixtures.
 *
 * Current main reports real production parameters as UNCONFIGURED.
 * Rehearsal fixtures never become production candidates.
 */

import { PRODUCTION_CONVERSION_POLICY_STATUS } from '../../../economics/human-contribution-bridge/types.ts';
import { currentRepositorySnapshot } from '../../../economics/production-activation/fixtures.ts';
import { currentUnconfiguredParameters } from '../../../economics/production-activation/parameters.ts';
import type { ProductionEconomicActivationSnapshot } from '../../../economics/production-activation/types.ts';
import { emptyBook, supplyReconciles } from '../../../economics/supply.ts';
import { MONETARY_POLICY_VERSION_ID } from '../../../economics/types.ts';
import { FIRST_ECONOMIC_RC_ID } from '../types.ts';
import { FIRST_MAINNET_RC_ID } from '../../mainnet/types.ts';
import { CERTIFICATION_POLICY_VERSION } from '../../../oracle/production/certification/types.ts';
import {
  ECONOMIC_DATA_FABRIC_ID,
  ECONOMIC_DATA_FABRIC_VERSION,
} from '../../../oracle/production/economic-data-fabric/types.ts';
import { DEVELOPMENT_ATTRIBUTION_POLICY_ID } from '../../../productive/policy-governance/attribution/policy.ts';
import { PRODUCTION_VALUE_POLICY_STATUS } from '../../../productive/policy-governance/value-function/types.ts';
import { PRODUCTION_CONVERSION_STATUS } from '../../../productive/policy-governance/value-settlement/types.ts';
import { SOURCE_TAXONOMY_ID } from '../../../productive/source-taxonomy/types.ts';
import { NORMALIZATION_CONSTITUTION_VERSION } from '../../../units/constitution.ts';

import { bindExact, hashOf } from './bindings.ts';
import { assembleCandidateBundle, candidateBundleDefaults, type BundleHashInput } from './bundle.ts';
import { canonicalAuthorityInventory } from './reconcile.ts';
import type {
  ExactVersionBinding,
  LayerSeparationProof,
  MoonReyConstitutionBinding,
  ProductionEconomicConstitutionCandidateBundle,
  ProductionEconomicConstitutionSnapshot,
  RehearsalBinding,
  StressBinding,
  SunReyConstitutionBinding,
} from './types.ts';

const HEC_VERIFICATION_POLICY = 'sunrey-human-contribution-verification-engineering-v1' as const;
const HEC_ONTOLOGY = 'sunrey.human-contribution.ontology.v1' as const;
const HEC_VALUATION_POLICY_STATUS = 'UNCONFIGURED' as const;
const HIN_POLICY_VERSION = 'hin-policy-v1' as const;
const HIN_CHAIN_ANCHOR_CAPABILITY = 'hin.on-chain-anchor.engineering.v1' as const;
const EAR_VERIFICATION_POLICY = 'sunrey-economic-asset-verification-engineering-v1' as const;
const HUMAN_REFERENCE_UNIT = 'HUMAN_CONTRIBUTION_REFERENCE_UNIT' as const;

export function currentConstitutionBindings(): readonly ExactVersionBinding[] {
  return Object.freeze([
    bindExact('monetaryConstitution', MONETARY_POLICY_VERSION_ID),
    bindExact('parameterPackage', 'UNCONFIGURED'),
    bindExact('humanVerification', HEC_VERIFICATION_POLICY),
    bindExact('humanValuation', HEC_VALUATION_POLICY_STATUS),
    bindExact('sunreyConversion', PRODUCTION_CONVERSION_POLICY_STATUS),
    bindExact('sourceTaxonomy', SOURCE_TAXONOMY_ID),
    bindExact('unitConstitution', NORMALIZATION_CONSTITUTION_VERSION),
    bindExact('attribution', DEVELOPMENT_ATTRIBUTION_POLICY_ID),
    bindExact('productiveValue', PRODUCTION_VALUE_POLICY_STATUS),
    bindExact('moonreyConversion', PRODUCTION_CONVERSION_STATUS),
    bindExact('oracleCertification', CERTIFICATION_POLICY_VERSION),
    bindExact('economicDataFabric', `${ECONOMIC_DATA_FABRIC_ID}:${String(ECONOMIC_DATA_FABRIC_VERSION)}`),
    bindExact('fees', 'UNCONFIGURED'),
    bindExact('burns', 'UNCONFIGURED'),
    bindExact('genesis', 'UNCONFIGURED'),
    bindExact('supply', 'AssetSupplyBook'),
    bindExact('hinPolicy', HIN_POLICY_VERSION),
    bindExact('hinChainAnchor', HIN_CHAIN_ANCHOR_CAPABILITY),
    bindExact('economicAssetVerification', EAR_VERIFICATION_POLICY),
  ]);
}

export function currentSunReyBinding(): SunReyConstitutionBinding {
  return Object.freeze({
    ontologyVersion: HEC_ONTOLOGY,
    ontologyHash: hashOf(HEC_ONTOLOGY),
    verificationPolicyVersion: HEC_VERIFICATION_POLICY,
    verificationPolicyHash: hashOf(HEC_VERIFICATION_POLICY),
    valuationPolicyVersion: HEC_VALUATION_POLICY_STATUS,
    valuationPolicyHash: hashOf(HEC_VALUATION_POLICY_STATUS),
    valuationOutputDenomination: HUMAN_REFERENCE_UNIT,
    conversionPolicyVersion: PRODUCTION_CONVERSION_POLICY_STATUS,
    conversionPolicyHash: hashOf(PRODUCTION_CONVERSION_POLICY_STATUS),
    conversionInputDenomination: HUMAN_REFERENCE_UNIT,
    conversionOutputAsset: 'SUNREY_COIN',
    settlementAuthorizationStatus: 'UNAVAILABLE',
    issuanceClass: 'AUTHORIZED_HUMAN_ECONOMIC_CONTRIBUTION',
    supplyBook: 'AssetSupplyBook',
    structurallyReady: true,
    productionEligible: false,
    legacyFixturePath: false,
    peveUsedAsValuation: false,
  });
}

export function currentMoonReyBinding(): MoonReyConstitutionBinding {
  return Object.freeze({
    sourceTaxonomyVersion: SOURCE_TAXONOMY_ID,
    sourceTaxonomyHash: hashOf(SOURCE_TAXONOMY_ID),
    unitConstitutionVersion: NORMALIZATION_CONSTITUTION_VERSION,
    unitConstitutionHash: hashOf(NORMALIZATION_CONSTITUTION_VERSION),
    attributionPolicyVersion: DEVELOPMENT_ATTRIBUTION_POLICY_ID,
    attributionPolicyHash: hashOf(DEVELOPMENT_ATTRIBUTION_POLICY_ID),
    productiveValuePolicyVersion: PRODUCTION_VALUE_POLICY_STATUS,
    productiveValuePolicyHash: hashOf(PRODUCTION_VALUE_POLICY_STATUS),
    productiveValueOutputUnit: 'GPUV',
    conversionPolicyVersion: PRODUCTION_CONVERSION_STATUS,
    conversionPolicyHash: hashOf(PRODUCTION_CONVERSION_STATUS),
    conversionInputUnit: 'GPUV',
    conversionOutputAsset: 'MOONREY_COIN',
    issuanceClass: 'VERIFIED_PRODUCTIVE_CONTRIBUTION',
    supplyBook: 'AssetSupplyBook',
    structurallyReady: true,
    productionEligible: false,
    legacyV1Path: false,
    gpuvEqualsMoonRey: false,
    gpuvCanMint: false,
  });
}

export function currentLayerSeparation(): LayerSeparationProof {
  return Object.freeze({
    humanCannotMasqueradeAsProductive: true,
    productiveCannotMasqueradeAsHuman: true,
    commonArbitraryEconomicScore: false,
    peveIsContributionValuation: false,
    peveIsSunReyQuantity: false,
    peveIsMoonReyQuantity: false,
    peveIsHumanWorth: false,
    peveIsCreditScore: false,
    gpuvIsPhysicalQuantity: false,
    gpuvIsFiat: false,
    gpuvIsMoonRey: false,
    gpuvIsExchangePrice: false,
    gpuvCanMint: false,
  });
}

export function currentRehearsalBinding(): RehearsalBinding {
  return Object.freeze({
    reportHash: hashOf('historical-economic-rehearsal:chunk-80'),
    schemaVersion: '1',
    policyStructureMatches: true,
    parameterPackageSchemaMatches: true,
    fixtureValuesMayDiffer: true,
    validatedUnselectedProductionValues: false,
    label: 'REHEARSAL_ONLY',
  });
}

export function currentStressBinding(): StressBinding {
  return Object.freeze({
    reportHash: hashOf('historical-economic-stress:chunk-76'),
    criticalInvariantsPassed: true,
    openHighOrCriticalFindings: false,
    supplyIntegrityHeld: true,
    replaySafetyHeld: true,
    capSafetyHeld: true,
    isExternalApproval: false,
  });
}

export function currentRepositoryConstitutionSnapshot(): ProductionEconomicConstitutionSnapshot {
  const sunreyBook = emptyBook('SUNREY_COIN', MONETARY_POLICY_VERSION_ID);
  const moonreyBook = emptyBook('MOONREY_COIN', MONETARY_POLICY_VERSION_ID);
  return Object.freeze({
    bindings: currentConstitutionBindings(),
    parameters: currentUnconfiguredParameters(),
    sunrey: currentSunReyBinding(),
    moonrey: currentMoonReyBinding(),
    supply: Object.freeze({
      canonicalSupplyBook: true,
      sunreyReconciles: supplyReconciles(sunreyBook),
      moonreyReconciles: supplyReconciles(moonreyBook),
      hiddenPremint: false,
      faucetMigration: false,
      rehearsalBalanceMigration: false,
      automaticApplicationLedgerMigration: false,
      genesisAllocationAuthorized: false,
      usedExistingChunk71Auditor: true,
    }),
    genesis: Object.freeze({
      sunreyAllocationEqualsGenesis: null,
      moonreyAllocationEqualsGenesis: null,
      hiddenAllocation: false,
      inheritedFaucet: false,
      migratedRehearsalBalance: false,
      automaticAppLedgerMigration: false,
    }),
    maxSupply: Object.freeze({
      sunreyConsistent: null,
      moonreyConsistent: null,
      duplicateMaxSupplyField: false,
    }),
    rehearsal: currentRehearsalBinding(),
    stress: currentStressBinding(),
    layerSeparation: currentLayerSeparation(),
    authorities: canonicalAuthorityInventory(),
    frozen: false,
    parameterSelectionComplete: false,
    humanGovernanceComplete: false,
    finalActivationAuthorization: false,
    actorKind: 'HUMAN',
  });
}

export function currentRepositoryBundleInput(
  firewallDecisionHash: string,
  root = process.cwd(),
): BundleHashInput {
  const defaults = candidateBundleDefaults(root);
  const sunrey = currentSunReyBinding();
  const moonrey = currentMoonReyBinding();
  return Object.freeze({
    ...defaults,
    economicRcId: FIRST_ECONOMIC_RC_ID,
    mainnetRcId: FIRST_MAINNET_RC_ID,
    monetaryConstitutionHash: hashOf(MONETARY_POLICY_VERSION_ID),
    parameterPackageHash: hashOf('parameter-package:UNCONFIGURED'),
    sunreyPolicyCandidateHash: hashOf('sunrey-policy-candidate:engineering-unconfigured'),
    sunreyValuationPolicyHash: sunrey.valuationPolicyHash,
    sunreyConversionPolicyHash: sunrey.conversionPolicyHash,
    moonreyPolicyCandidateHash: hashOf('moonrey-policy-candidate:engineering-unconfigured'),
    moonreyProductiveValuePolicyHash: moonrey.productiveValuePolicyHash,
    moonreyConversionPolicyHash: moonrey.conversionPolicyHash,
    sourceTaxonomyHash: moonrey.sourceTaxonomyHash,
    unitConstitutionHash: moonrey.unitConstitutionHash,
    attributionPolicyHash: moonrey.attributionPolicyHash,
    oracleCertificationPolicyHash: hashOf(CERTIFICATION_POLICY_VERSION),
    economicDataFabricHash: hashOf(`${ECONOMIC_DATA_FABRIC_ID}:${String(ECONOMIC_DATA_FABRIC_VERSION)}`),
    HINPolicyHash: hashOf(HIN_POLICY_VERSION),
    HINChainAnchorCapabilityHash: hashOf(HIN_CHAIN_ANCHOR_CAPABILITY),
    economicAssetVerificationHash: hashOf(EAR_VERIFICATION_POLICY),
    feePolicyHash: hashOf('fee-policy:UNCONFIGURED'),
    burnPolicyHash: hashOf('burn-policy:UNCONFIGURED'),
    supplyGuardHash: hashOf('supply-guard:UNCONFIGURED'),
    genesisAllocationManifestHash: hashOf('genesis-allocation:UNCONFIGURED'),
    rehearsalReportHash: currentRehearsalBinding().reportHash,
    stressReportHash: currentStressBinding().reportHash,
    firewallDecisionHash,
  });
}

export function currentRepositoryCandidateBundle(
  firewallDecisionHash: string,
  root = process.cwd(),
): ProductionEconomicConstitutionCandidateBundle {
  return assembleCandidateBundle(currentRepositoryBundleInput(firewallDecisionHash, root));
}

export function currentActivationSnapshot(): ProductionEconomicActivationSnapshot {
  return currentRepositorySnapshot();
}

export function withConstitutionSnapshot(
  base: ProductionEconomicConstitutionSnapshot,
  overlay: Partial<ProductionEconomicConstitutionSnapshot>,
): ProductionEconomicConstitutionSnapshot {
  return Object.freeze({ ...base, ...overlay });
}
