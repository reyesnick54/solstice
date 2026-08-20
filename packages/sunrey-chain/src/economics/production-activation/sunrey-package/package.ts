/**
 * Assemble a SunRey production issuance parameter package.
 * Does not mint and does not mutate AssetSupplyBook.
 */

import { createHash } from 'node:crypto';

import type { HumanContributionProductionValuationPolicyCandidate } from '../../../../../human-economic-contribution/src/valuation/production-candidate/types.ts';
import type { SunReyProductionSettlementConversionPolicyCandidate } from '../../human-contribution-bridge/production-candidate/types.ts';

import { createPostGenesisIssuancePolicyCandidate } from './issuance-policy.ts';
import {
  NO_PRODUCTION_ECONOMIC_MEANING,
  REHEARSAL_FIXTURE,
  SUNREY_PRODUCTION_ISSUANCE_PACKAGE_ID,
  type NumericPolicyValue,
  type PolicyVersionBinding,
  type SunReyPostGenesisIssuancePolicyCandidate,
  type SunReyProductionIssuanceParameterPackage,
} from './types.ts';

export function unconfiguredNumeric(): NumericPolicyValue {
  return Object.freeze({ status: 'UNCONFIGURED', value: null });
}

export function configuredNumeric(value: bigint): NumericPolicyValue {
  if (typeof value !== 'bigint') {
    throw new TypeError('package numeric values must be bigint');
  }
  return Object.freeze({ status: 'CONFIGURED', value });
}

export function bindExact(key: string, versionId: string, contentHash?: string): PolicyVersionBinding {
  if (versionId.trim().toLowerCase() === 'latest') {
    throw new TypeError('package bindings cannot use latest');
  }
  return Object.freeze({
    key,
    versionId,
    contentHash:
      contentHash ??
      createHash('sha256').update(`SUNREY_ISSUANCE_PACKAGE_BINDING_V1:${key}:${versionId}`).digest('hex'),
  });
}

export const CURRENT_PACKAGE_BINDINGS: readonly PolicyVersionBinding[] = Object.freeze([
  bindExact('humanContributionOntology', 'sunrey-human-economic-contribution-taxonomy:1'),
  bindExact('verificationPolicy', 'sunrey-human-contribution-verification-engineering-v1'),
  bindExact('valuationPolicy', 'UNCONFIGURED'),
  bindExact('hinPolicy', 'hin-policy-v1'),
  bindExact('hinChainAnchorCapability', 'hin.on-chain-anchor.engineering.v1'),
  bindExact('economicAssetVerificationPolicy', 'sunrey-economic-asset-verification-engineering-v1'),
  bindExact('conversionPolicy', 'UNCONFIGURED'),
  bindExact('monetaryConstitution', 'sunrey.monetary.constitution.v1'),
  bindExact('supplyGuardPolicy', 'UNCONFIGURED'),
]);

export type PackageDraft = {
  readonly maximumSupply?: NumericPolicyValue;
  readonly genesisSupply?: NumericPolicyValue;
  readonly postGenesisIssuancePolicy?: SunReyPostGenesisIssuancePolicyCandidate;
  readonly contributionToSettlementConversion: SunReyProductionSettlementConversionPolicyCandidate;
  readonly valuationPolicy: HumanContributionProductionValuationPolicyCandidate;
  readonly perPeriodCaps?: NumericPolicyValue;
  readonly perClassCaps?: NumericPolicyValue;
  readonly globalSupplyGuards?: NumericPolicyValue;
  readonly genesisAllocationManifestRef?: PolicyVersionBinding;
  readonly feePolicyRef?: PolicyVersionBinding;
  readonly burnPolicyRef?: PolicyVersionBinding;
  readonly bindings?: readonly PolicyVersionBinding[];
  readonly sourceClass?: SunReyProductionIssuanceParameterPackage['sourceClass'];
  readonly fixture?: boolean;
};

export function hashIssuanceParameterPackage(
  pkg: Omit<SunReyProductionIssuanceParameterPackage, 'packageHash'>,
): string {
  const material = [
    'SUNREY_PRODUCTION_ISSUANCE_PARAMETER_PACKAGE_V1',
    pkg.packageId,
    String(pkg.schemaVersion),
    `${pkg.maximumSupply.status}:${pkg.maximumSupply.value?.toString() ?? ''}`,
    `${pkg.genesisSupply.status}:${pkg.genesisSupply.value?.toString() ?? ''}`,
    pkg.postGenesisIssuancePolicy.policyId,
    pkg.postGenesisIssuancePolicy.version,
    pkg.contributionToSettlementConversion.policyHash,
    pkg.valuationPolicy.policyHash,
    `${pkg.perPeriodCaps.status}:${pkg.perPeriodCaps.value?.toString() ?? ''}`,
    `${pkg.perClassCaps.status}:${pkg.perClassCaps.value?.toString() ?? ''}`,
    `${pkg.globalSupplyGuards.status}:${pkg.globalSupplyGuards.value?.toString() ?? ''}`,
    pkg.genesisAllocationManifestRef.versionId,
    pkg.feePolicyRef.versionId,
    pkg.burnPolicyRef.versionId,
    ...pkg.bindings.map((row) => `${row.key}:${row.versionId}:${row.contentHash}`),
    pkg.sourceClass,
    pkg.fixture ? '1' : '0',
    'productionActivated=false',
    'CHUNK_71_REMAINS_MONETARY_AUTHORITY=true',
  ].join('|');
  return createHash('sha256').update(material).digest('hex');
}

export function createSunReyProductionIssuanceParameterPackage(
  draft: PackageDraft,
): SunReyProductionIssuanceParameterPackage {
  const fixture = draft.fixture === true;
  const valuesConfigured =
    (draft.maximumSupply ?? unconfiguredNumeric()).status === 'CONFIGURED' &&
    (draft.genesisSupply ?? unconfiguredNumeric()).status === 'CONFIGURED' &&
    (draft.perPeriodCaps ?? unconfiguredNumeric()).status === 'CONFIGURED' &&
    (draft.perClassCaps ?? unconfiguredNumeric()).status === 'CONFIGURED' &&
    (draft.globalSupplyGuards ?? unconfiguredNumeric()).status === 'CONFIGURED';
  const assembled: Omit<SunReyProductionIssuanceParameterPackage, 'packageHash'> = {
    packageId: SUNREY_PRODUCTION_ISSUANCE_PACKAGE_ID,
    schemaVersion: 1,
    maximumSupply: draft.maximumSupply ?? unconfiguredNumeric(),
    genesisSupply: draft.genesisSupply ?? unconfiguredNumeric(),
    postGenesisIssuancePolicy: draft.postGenesisIssuancePolicy ?? createPostGenesisIssuancePolicyCandidate(),
    contributionToSettlementConversion: draft.contributionToSettlementConversion,
    valuationPolicy: draft.valuationPolicy,
    perPeriodCaps: draft.perPeriodCaps ?? unconfiguredNumeric(),
    perClassCaps: draft.perClassCaps ?? unconfiguredNumeric(),
    globalSupplyGuards: draft.globalSupplyGuards ?? unconfiguredNumeric(),
    genesisAllocationManifestRef: draft.genesisAllocationManifestRef ?? bindExact('GENESIS_ALLOCATION_MANIFEST', 'UNCONFIGURED'),
    feePolicyRef: draft.feePolicyRef ?? bindExact('FEE_POLICY', 'UNCONFIGURED'),
    burnPolicyRef: draft.burnPolicyRef ?? bindExact('BURN_POLICY', 'UNCONFIGURED'),
    bindings: Object.freeze([...(draft.bindings ?? CURRENT_PACKAGE_BINDINGS)]),
    sourceClass: draft.sourceClass ?? (fixture ? 'FIXTURE' : 'UNCONFIGURED'),
    fixture,
    rehearsalOnly: true,
    productionActivated: false,
    chunk71RemainsMonetaryAuthority: true,
    candidatePackageCanMint: false,
    fixtureAuthorizesProduction: false,
    rehearsalFixtureLabel: fixture ? REHEARSAL_FIXTURE : null,
    economicMeaning: fixture || !valuesConfigured ? NO_PRODUCTION_ECONOMIC_MEANING : 'UNCONFIGURED',
  };
  return Object.freeze({
    ...assembled,
    packageHash: hashIssuanceParameterPackage(assembled),
  });
}
