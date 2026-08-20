/**
 * Cross-policy reconciliation for a production economic constitution
 * candidate. Uses the existing Chunk 71 supply auditor. Does not
 * invent a second supply equation. Does not activate production.
 */

import { auditSupply } from '../../../economics/auditor.ts';
import { emptyBook, supplyReconciles, type AssetSupplyBook } from '../../../economics/supply.ts';
import { MONETARY_POLICY_VERSION_ID } from '../../../economics/types.ts';

import { rejectImplicitBindings } from './bindings.ts';
import { buildCompatibilityGraph } from './compatibility.ts';
import { duplicateParameterIds } from './requirements.ts';
import type {
  AuthorityOwnerRecord,
  ConstitutionComponentKey,
  EconomicPolicyCompatibilityGraph,
  ProductionEconomicConstitutionCandidateBundle,
  ProductionEconomicConstitutionChangeImpact,
  ProductionEconomicConstitutionReconciliation,
  ProductionEconomicConstitutionSnapshot,
} from './types.ts';
import { CANONICAL_AUTHORITIES } from './types.ts';

export function reconcileConstitution(
  snapshot: ProductionEconomicConstitutionSnapshot,
): ProductionEconomicConstitutionReconciliation {
  const failures: string[] = [];
  const implicit = rejectImplicitBindings(snapshot.bindings);
  if (implicit.length > 0) {
    failures.push(...implicit.map((row) => `implicit-version:${row}`));
  }
  const duplicates = duplicateParameterIds(snapshot.parameters);
  if (duplicates.length > 0) {
    failures.push(...duplicates.map((id) => `duplicate-parameter:${id}`));
  }

  const sunreyOk = reconcileSunRey(snapshot, failures);
  const moonreyOk = reconcileMoonRey(snapshot, failures);
  const conversionOk = reconcileConversion(snapshot, failures);
  const supplyOk = snapshot.supply.canonicalSupplyBook && snapshot.supply.sunreyReconciles && snapshot.supply.moonreyReconciles;
  if (!supplyOk) {
    failures.push('supply-reconciliation-failed');
  }
  if (snapshot.supply.hiddenPremint) {
    failures.push('hidden-premint');
  }
  if (snapshot.supply.faucetMigration) {
    failures.push('faucet-migration');
  }
  if (snapshot.supply.rehearsalBalanceMigration) {
    failures.push('rehearsal-balance-migration');
  }
  if (snapshot.supply.automaticApplicationLedgerMigration) {
    failures.push('automatic-app-ledger-migration');
  }
  const genesisOk = reconcileGenesis(snapshot, failures);
  reconcileMaxSupply(snapshot, failures);
  const layerSeparationOk = reconcileLayerSeparation(snapshot, failures);
  const authorityOk = reconcileAuthorities(snapshot.authorities, failures);
  const compatibility = compatibilityFrom(snapshot, implicit.length > 0);
  const compatibilityOk = compatibility.complete;
  if (!compatibilityOk) {
    failures.push('compatibility-graph-incomplete');
  }

  return Object.freeze({
    ok: failures.length === 0,
    sunreyOk,
    moonreyOk,
    supplyOk,
    genesisOk,
    conversionOk,
    compatibilityOk,
    authorityOk,
    layerSeparationOk,
    implicitVersionRejected: implicit.length > 0,
    failures: Object.freeze(failures),
  });
}

function reconcileSunRey(snapshot: ProductionEconomicConstitutionSnapshot, failures: string[]): boolean {
  const sunrey = snapshot.sunrey;
  let ok = true;
  if (sunrey.issuanceClass !== 'AUTHORIZED_HUMAN_ECONOMIC_CONTRIBUTION') {
    failures.push('sunrey-issuance-class');
    ok = false;
  }
  if (sunrey.supplyBook !== 'AssetSupplyBook') {
    failures.push('sunrey-supply-book');
    ok = false;
  }
  if (sunrey.valuationOutputDenomination !== sunrey.conversionInputDenomination) {
    failures.push('sunrey-denomination-mismatch');
    ok = false;
  }
  if (sunrey.conversionOutputAsset !== 'SUNREY_COIN') {
    failures.push('sunrey-conversion-output');
    ok = false;
  }
  if (sunrey.peveUsedAsValuation) {
    failures.push('peve-used-as-valuation');
    ok = false;
  }
  if (sunrey.legacyFixturePath && sunrey.productionEligible) {
    failures.push('legacy-sunrey-fixture-qualified');
    ok = false;
  }
  return ok;
}

function reconcileMoonRey(snapshot: ProductionEconomicConstitutionSnapshot, failures: string[]): boolean {
  const moonrey = snapshot.moonrey;
  let ok = true;
  if (moonrey.issuanceClass !== 'VERIFIED_PRODUCTIVE_CONTRIBUTION') {
    failures.push('moonrey-issuance-class');
    ok = false;
  }
  if (moonrey.productiveValueOutputUnit !== 'GPUV' || moonrey.conversionInputUnit !== 'GPUV') {
    failures.push('moonrey-gpuv-unit-mismatch');
    ok = false;
  }
  if (moonrey.conversionOutputAsset !== 'MOONREY_COIN') {
    failures.push('moonrey-conversion-output');
    ok = false;
  }
  if (moonrey.gpuvEqualsMoonRey || moonrey.gpuvCanMint) {
    failures.push('gpuv-separation-violated');
    ok = false;
  }
  if (moonrey.legacyV1Path) {
    failures.push('moonrey-v1-not-production-eligible');
    if (moonrey.productionEligible) {
      failures.push('legacy-v1-qualified');
    }
    ok = false;
  }
  return ok;
}

function reconcileConversion(snapshot: ProductionEconomicConstitutionSnapshot, failures: string[]): boolean {
  const ok =
    snapshot.sunrey.valuationOutputDenomination === snapshot.sunrey.conversionInputDenomination &&
    snapshot.moonrey.productiveValueOutputUnit === 'GPUV' &&
    snapshot.moonrey.conversionInputUnit === 'GPUV' &&
    snapshot.moonrey.conversionOutputAsset === 'MOONREY_COIN';
  if (!ok) {
    failures.push('conversion-policy-reconciliation');
  }
  return ok;
}

function reconcileGenesis(snapshot: ProductionEconomicConstitutionSnapshot, failures: string[]): boolean {
  if (snapshot.genesis.hiddenAllocation) {
    failures.push('hidden-allocation');
  }
  if (snapshot.genesis.inheritedFaucet) {
    failures.push('inherited-faucet');
  }
  if (snapshot.genesis.migratedRehearsalBalance) {
    failures.push('migrated-rehearsal-balance');
  }
  if (snapshot.genesis.automaticAppLedgerMigration) {
    failures.push('automatic-app-ledger-migration');
  }
  if (snapshot.genesis.sunreyAllocationEqualsGenesis === false) {
    failures.push('sunrey-genesis-inconsistent');
  }
  if (snapshot.genesis.moonreyAllocationEqualsGenesis === false) {
    failures.push('moonrey-genesis-inconsistent');
  }
  return (
    !snapshot.genesis.hiddenAllocation &&
    !snapshot.genesis.inheritedFaucet &&
    !snapshot.genesis.migratedRehearsalBalance &&
    !snapshot.genesis.automaticAppLedgerMigration &&
    snapshot.genesis.sunreyAllocationEqualsGenesis !== false &&
    snapshot.genesis.moonreyAllocationEqualsGenesis !== false
  );
}

function reconcileMaxSupply(snapshot: ProductionEconomicConstitutionSnapshot, failures: string[]): void {
  if (snapshot.maxSupply.duplicateMaxSupplyField) {
    failures.push('duplicate-max-supply-field');
  }
  if (snapshot.maxSupply.sunreyConsistent === false) {
    failures.push('sunrey-max-supply-inconsistent');
  }
  if (snapshot.maxSupply.moonreyConsistent === false) {
    failures.push('moonrey-max-supply-inconsistent');
  }
}

function reconcileLayerSeparation(snapshot: ProductionEconomicConstitutionSnapshot, failures: string[]): boolean {
  const layer = snapshot.layerSeparation;
  const ok =
    layer.humanCannotMasqueradeAsProductive &&
    layer.productiveCannotMasqueradeAsHuman &&
    !layer.commonArbitraryEconomicScore &&
    !layer.peveIsContributionValuation &&
    !layer.peveIsSunReyQuantity &&
    !layer.peveIsMoonReyQuantity &&
    !layer.peveIsHumanWorth &&
    !layer.peveIsCreditScore &&
    !layer.gpuvIsPhysicalQuantity &&
    !layer.gpuvIsFiat &&
    !layer.gpuvIsMoonRey &&
    !layer.gpuvIsExchangePrice &&
    !layer.gpuvCanMint;
  if (!ok) {
    failures.push('layer-separation');
  }
  return ok;
}

export function reconcileAuthorities(authorities: readonly AuthorityOwnerRecord[], failures: string[]): boolean {
  let ok = true;
  for (const row of authorities) {
    if (row.competingOwners.length > 0) {
      failures.push(`duplicate-authority:${row.domain}`);
      ok = false;
    }
  }
  return ok;
}

export function canonicalAuthorityInventory(): readonly AuthorityOwnerRecord[] {
  return Object.freeze([
    owner('MONETARY_ISSUANCE', CANONICAL_AUTHORITIES.MONETARY_ISSUANCE),
    owner('SUPPLY', CANONICAL_AUTHORITIES.SUPPLY),
    owner('HUMAN_VALUATION', CANONICAL_AUTHORITIES.HUMAN_CONTRIBUTION_VALUATION),
    owner('PRODUCTIVE_VALUE', CANONICAL_AUTHORITIES.PRODUCTIVE_VALUE_FUNCTION),
    owner('GPUV_CONVERSION', 'moonrey.productive-value.settlement-bridge.v2'),
    owner('SUNREY_CONVERSION', 'sunrey.human-contribution.monetary-bridge.v2'),
    owner('SOURCE_TAXONOMY', 'moonrey.source-taxonomy.v1'),
    owner('UNITS', 'sunrey.economic-unit.normalization.v1'),
    owner('ORACLE_CONSENSUS', CANONICAL_AUTHORITIES.ORACLE_CONSENSUS),
    owner('ECONOMIC_ASSET_REGISTRY', 'packages/economic-asset-registry'),
  ]);
}

function owner(domain: AuthorityOwnerRecord['domain'], canonicalOwner: string): AuthorityOwnerRecord {
  return Object.freeze({
    domain,
    canonicalOwner,
    competingOwners: Object.freeze([]),
  });
}

export function auditCanonicalSupply(books: readonly AssetSupplyBook[]): {
  readonly sunreyReconciles: boolean;
  readonly moonreyReconciles: boolean;
} {
  const sunrey = books.find((book) => book.assetId === 'SUNREY_COIN') ?? emptyBook('SUNREY_COIN', MONETARY_POLICY_VERSION_ID);
  const moonrey = books.find((book) => book.assetId === 'MOONREY_COIN') ?? emptyBook('MOONREY_COIN', MONETARY_POLICY_VERSION_ID);
  const report = auditSupply([sunrey, moonrey], MONETARY_POLICY_VERSION_ID);
  return Object.freeze({
    sunreyReconciles: supplyReconciles(sunrey) && report.ok,
    moonreyReconciles: supplyReconciles(moonrey) && report.ok,
  });
}

export function compatibilityFrom(
  snapshot: ProductionEconomicConstitutionSnapshot,
  implicitRejected: boolean,
): EconomicPolicyCompatibilityGraph {
  const byKey = new Map(snapshot.bindings.map((row) => [row.key, row]));
  const node = (key: string, fallback: string) => {
    const found = byKey.get(key);
    return {
      versionId: found?.versionId ?? fallback,
      contentHash: found?.contentHash ?? fallback,
    };
  };
  const nodes: Record<ConstitutionComponentKey, { readonly versionId: string; readonly contentHash: string }> = {
    monetaryConstitution: node('monetaryConstitution', snapshot.sunrey.ontologyVersion),
    parameterPackage: node('parameterPackage', 'UNCONFIGURED'),
    humanVerification: node('humanVerification', snapshot.sunrey.verificationPolicyVersion),
    humanValuation: node('humanValuation', snapshot.sunrey.valuationPolicyVersion),
    sunreyConversion: node('sunreyConversion', snapshot.sunrey.conversionPolicyVersion),
    sourceTaxonomy: node('sourceTaxonomy', snapshot.moonrey.sourceTaxonomyVersion),
    unitConstitution: node('unitConstitution', snapshot.moonrey.unitConstitutionVersion),
    attribution: node('attribution', snapshot.moonrey.attributionPolicyVersion),
    productiveValue: node('productiveValue', snapshot.moonrey.productiveValuePolicyVersion),
    moonreyConversion: node('moonreyConversion', snapshot.moonrey.conversionPolicyVersion),
    oracleCertification: node('oracleCertification', 'bound'),
    economicDataFabric: node('economicDataFabric', 'bound'),
    fees: node('fees', 'UNCONFIGURED'),
    burns: node('burns', 'UNCONFIGURED'),
    genesis: node('genesis', 'UNCONFIGURED'),
    supply: node('supply', 'AssetSupplyBook'),
  };
  return buildCompatibilityGraph({
    nodes,
    sunrey: snapshot.sunrey,
    moonrey: snapshot.moonrey,
    implicitRejected,
  });
}

export function analyzeEconomicConstitutionChange(
  oldBundle: ProductionEconomicConstitutionCandidateBundle,
  newBundle: ProductionEconomicConstitutionCandidateBundle,
): ProductionEconomicConstitutionChangeImpact {
  return Object.freeze({
    supplyChanged: oldBundle.supplyGuardHash !== newBundle.supplyGuardHash,
    genesisChanged: oldBundle.genesisAllocationManifestHash !== newBundle.genesisAllocationManifestHash,
    sunreyValuationChanged: oldBundle.sunreyValuationPolicyHash !== newBundle.sunreyValuationPolicyHash,
    sunreyConversionChanged: oldBundle.sunreyConversionPolicyHash !== newBundle.sunreyConversionPolicyHash,
    moonreyProductiveValueChanged: oldBundle.moonreyProductiveValuePolicyHash !== newBundle.moonreyProductiveValuePolicyHash,
    moonreyConversionChanged: oldBundle.moonreyConversionPolicyHash !== newBundle.moonreyConversionPolicyHash,
    capsChanged:
      oldBundle.parameterPackageHash !== newBundle.parameterPackageHash &&
      (oldBundle.sunreyPolicyCandidateHash !== newBundle.sunreyPolicyCandidateHash ||
        oldBundle.moonreyPolicyCandidateHash !== newBundle.moonreyPolicyCandidateHash),
    feesChanged: oldBundle.feePolicyHash !== newBundle.feePolicyHash,
    burnsChanged: oldBundle.burnPolicyHash !== newBundle.burnPolicyHash,
    oracleDependenciesChanged:
      oldBundle.oracleCertificationPolicyHash !== newBundle.oracleCertificationPolicyHash ||
      oldBundle.economicDataFabricHash !== newBundle.economicDataFabricHash,
    hinDependenciesChanged:
      oldBundle.HINPolicyHash !== newBundle.HINPolicyHash ||
      oldBundle.HINChainAnchorCapabilityHash !== newBundle.HINChainAnchorCapabilityHash,
    economicConstitutionHashChanged: oldBundle.economicConstitutionHash !== newBundle.economicConstitutionHash,
    silentlyActivates: false,
  });
}
