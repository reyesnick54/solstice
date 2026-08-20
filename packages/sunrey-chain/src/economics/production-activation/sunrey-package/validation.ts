/**
 * Validate a SunRey issuance parameter package.
 *
 * Supply-cap checks are structural. AssetSupplyBook is never mutated.
 */

import { classifyParameter, unconfiguredParameter } from '../parameters.ts';
import type { ProductionParameterId, ProductionParameterRecord } from '../types.ts';
import { validateConversionPolicyCandidate } from '../../human-contribution-bridge/production-candidate/validation.ts';
import { validateValuationPolicyCandidate } from '../../../../../human-economic-contribution/src/valuation/production-candidate/validation.ts';

import { evaluateSunReyProductionPolicyCandidateReadiness } from './readiness.ts';
import {
  packageFailure,
  type PackageValidationResult,
  type SunReyProductionIssuanceParameterPackage,
} from './types.ts';

export function validateSunReyProductionIssuanceParameterPackage(
  pkg: SunReyProductionIssuanceParameterPackage,
): PackageValidationResult {
  if (pkg.productionActivated !== false || pkg.candidatePackageCanMint !== false) {
    return packageFailure('CANDIDATE_PACKAGE_CANNOT_MINT', 'candidate package cannot mint');
  }
  if (pkg.postGenesisIssuancePolicy.unrestrictedIssuance !== false) {
    return packageFailure('UNRESTRICTED_ISSUANCE_FORBIDDEN', 'unrestricted issuance is forbidden');
  }
  for (const binding of pkg.bindings) {
    if (binding.versionId.trim().toLowerCase() === 'latest') {
      return packageFailure('BINDING_LATEST_REJECTED', `binding '${binding.key}' cannot use latest`);
    }
  }
  if (pkg.fixture && pkg.sourceClass !== 'FIXTURE' && pkg.sourceClass !== 'REHEARSAL') {
    return packageFailure('FIXTURE_CANNOT_AUTHORIZE_PRODUCTION', 'fixture package cannot claim governed production');
  }
  const valuation = validateValuationPolicyCandidate(pkg.valuationPolicy);
  if (!valuation.ok) {
    return packageFailure('VALUES_UNCONFIGURED', valuation.message);
  }
  const conversion = validateConversionPolicyCandidate(pkg.contributionToSettlementConversion);
  if (!conversion.ok) {
    return packageFailure('VALUES_UNCONFIGURED', conversion.message);
  }
  if (
    pkg.genesisSupply.status === 'CONFIGURED' &&
    pkg.maximumSupply.status === 'CONFIGURED' &&
    pkg.genesisSupply.value > pkg.maximumSupply.value
  ) {
    return packageFailure('GENESIS_EXCEEDS_MAXIMUM_SUPPLY', 'genesis supply cannot exceed maximum supply');
  }
  if (
    pkg.perPeriodCaps.status === 'CONFIGURED' &&
    pkg.maximumSupply.status === 'CONFIGURED' &&
    pkg.perPeriodCaps.value > pkg.maximumSupply.value
  ) {
    return packageFailure('PERIOD_CAP_BYPASSES_GLOBAL_MAXIMUM', 'per-period caps cannot bypass global maximum');
  }
  if (
    pkg.contributionToSettlementConversion.perContributionCeiling.status === 'CONFIGURED' &&
    pkg.contributionToSettlementConversion.perEpochCeiling.status === 'CONFIGURED' &&
    pkg.contributionToSettlementConversion.perContributionCeiling.value >
      pkg.contributionToSettlementConversion.perEpochCeiling.value
  ) {
    return packageFailure('CONTRIBUTION_CAP_BYPASSES_EPOCH_CAP', 'per-contribution caps cannot bypass epoch caps');
  }
  if (
    pkg.perClassCaps.status === 'CONFIGURED' &&
    pkg.globalSupplyGuards.status === 'CONFIGURED' &&
    pkg.perClassCaps.value > pkg.globalSupplyGuards.value
  ) {
    return packageFailure('CLASS_CAP_BYPASSES_GLOBAL_GUARD', 'per-class caps cannot bypass global supply guard');
  }
  if (
    pkg.globalSupplyGuards.status === 'CONFIGURED' &&
    pkg.maximumSupply.status === 'CONFIGURED' &&
    pkg.globalSupplyGuards.value > pkg.maximumSupply.value
  ) {
    return packageFailure('PERIOD_CAP_BYPASSES_GLOBAL_MAXIMUM', 'global supply guard cannot exceed maximum supply');
  }
  return Object.freeze({
    ok: true,
    package: pkg,
    parameters: parametersFromSunReyPackage(pkg),
    readiness: evaluateSunReyProductionPolicyCandidateReadiness(pkg),
    mutatedSupplyBook: false,
  });
}

export function parametersFromSunReyPackage(
  pkg: SunReyProductionIssuanceParameterPackage,
): readonly ProductionParameterRecord[] {
  const sourceClass = pkg.fixture ? 'FIXTURE' : pkg.sourceClass;
  const governed = sourceClass === 'GOVERNED_PRODUCTION_PARAMETER' && !pkg.fixture;
  const rows: ProductionParameterRecord[] = [
    parameterRow('SUNREY_MAXIMUM_SUPPLY', pkg.maximumSupply, sourceClass, governed, pkg.packageHash),
    parameterRow('SUNREY_GENESIS_SUPPLY', pkg.genesisSupply, sourceClass, governed, pkg.packageHash),
    parameterRow(
      'SUNREY_POST_GENESIS_ISSUANCE_POLICY',
      { status: 'CONFIGURED', value: 1n },
      sourceClass,
      governed,
      pkg.postGenesisIssuancePolicy.version,
    ),
    parameterRow(
      'SUNREY_CONTRIBUTION_TO_SETTLEMENT_CONVERSION',
      pkg.contributionToSettlementConversion.conversionNumerator,
      sourceClass,
      governed,
      pkg.contributionToSettlementConversion.policyHash,
    ),
    parameterRow('SUNREY_PER_PERIOD_CAPS', pkg.perPeriodCaps, sourceClass, governed, pkg.packageHash),
    parameterRow('PER_CLASS_CAPS', pkg.perClassCaps, sourceClass, governed, pkg.packageHash),
    parameterRow('GLOBAL_SUPPLY_GUARDS', pkg.globalSupplyGuards, sourceClass, governed, pkg.packageHash),
    parameterRow(
      'GENESIS_ALLOCATION_MANIFEST',
      pkg.genesisAllocationManifestRef.versionId === 'UNCONFIGURED'
        ? { status: 'UNCONFIGURED', value: null }
        : { status: 'CONFIGURED', value: 1n },
      sourceClass,
      governed,
      pkg.genesisAllocationManifestRef.contentHash,
    ),
    parameterRow(
      'FEE_POLICY',
      pkg.feePolicyRef.versionId === 'UNCONFIGURED' ? { status: 'UNCONFIGURED', value: null } : { status: 'CONFIGURED', value: 1n },
      sourceClass,
      governed,
      pkg.feePolicyRef.contentHash,
    ),
    parameterRow(
      'BURN_POLICY',
      pkg.burnPolicyRef.versionId === 'UNCONFIGURED' ? { status: 'UNCONFIGURED', value: null } : { status: 'CONFIGURED', value: 1n },
      sourceClass,
      governed,
      pkg.burnPolicyRef.contentHash,
    ),
  ];
  return Object.freeze(rows.map((row) => classifyParameter(row)));
}

function parameterRow(
  id: ProductionParameterId,
  value: { readonly status: 'UNCONFIGURED' | 'CONFIGURED'; readonly value: bigint | null },
  sourceClass: string,
  governed: boolean,
  hashSeed: string,
): ProductionParameterRecord {
  if (value.status !== 'CONFIGURED') {
    return unconfiguredParameter(id);
  }
  return Object.freeze({
    id,
    status: 'CONFIGURED',
    sourceClass,
    versionId: `candidate.${id}.v1`,
    valueHash: `${id}:${hashSeed}:${value.value?.toString() ?? ''}`,
    governed,
    infrastructureMetadataOnly: false,
  });
}
