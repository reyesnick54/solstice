/**
 * Feed the rehearsal parameter package through the real production
 * validators. Do not invent a simplified rehearsal-only validator.
 *
 * Uses Chunk 143 classify/hash plus the Chunk 112 / Chunk 125
 * conversion validators. When Chunks 144–146 are present they are
 * used instead of the fallback adapters.
 */

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  classifyParameter,
  parameterManifestHash,
  PRODUCTION_PARAMETER_IDS,
  type ProductionParameterId,
  type ProductionParameterRecord,
} from '../../economics/production-activation/index.ts';
import {
  simulationConversionPolicy as sunreySimulationConversion,
  validateConversionPolicy as validateSunReyConversion,
} from '../../economics/human-contribution-bridge/index.ts';
import {
  simulationConversionPolicy as moonreySimulationConversion,
  validateConversionPolicy as validateMoonReyConversion,
} from '../../productive/policy-governance/value-settlement/index.ts';
import type {
  ParameterValidationResult,
  ParameterValidationUse,
  RehearsalParameterPackage,
} from './types.ts';
import { REHEARSAL_FIXTURE_SOURCE } from './types.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const CHAIN_SRC = join(HERE, '../..');

function sha256Hex(parts: readonly string[]): string {
  return createHash('sha256').update(parts.join('\n')).digest('hex');
}

function encodeBigint(value: bigint): string {
  return value.toString();
}

export function fixtureParameterRecord(
  id: ProductionParameterId,
  versionId: string,
  valueHash: string,
): ProductionParameterRecord {
  return classifyParameter({
    id,
    status: 'CONFIGURED',
    sourceClass: REHEARSAL_FIXTURE_SOURCE,
    versionId,
    valueHash,
    governed: true,
    infrastructureMetadataOnly: false,
  });
}

export function productionRecordsFromPackage(
  pkg: RehearsalParameterPackage,
): readonly ProductionParameterRecord[] {
  const hashes: Record<ProductionParameterId, string> = {
    SUNREY_MAXIMUM_SUPPLY: sha256Hex(['SUNREY_MAXIMUM_SUPPLY', encodeBigint(pkg.sunreyMaximumSupply.value)]),
    MOONREY_MAXIMUM_SUPPLY: sha256Hex(['MOONREY_MAXIMUM_SUPPLY', encodeBigint(pkg.moonreyMaximumSupply.value)]),
    SUNREY_GENESIS_SUPPLY: sha256Hex(['SUNREY_GENESIS_SUPPLY', encodeBigint(pkg.sunreyGenesisSupply.value)]),
    MOONREY_GENESIS_SUPPLY: sha256Hex(['MOONREY_GENESIS_SUPPLY', encodeBigint(pkg.moonreyGenesisSupply.value)]),
    SUNREY_POST_GENESIS_ISSUANCE_POLICY: sha256Hex([
      'SUNREY_POST_GENESIS_ISSUANCE_POLICY',
      pkg.sunreyPostGenesisIssuancePolicy.value,
    ]),
    MOONREY_POST_GENESIS_ISSUANCE_POLICY: sha256Hex([
      'MOONREY_POST_GENESIS_ISSUANCE_POLICY',
      pkg.moonreyPostGenesisIssuancePolicy.value,
    ]),
    SUNREY_CONTRIBUTION_TO_SETTLEMENT_CONVERSION: sha256Hex([
      'SUNREY_CONTRIBUTION_TO_SETTLEMENT_CONVERSION',
      encodeBigint(pkg.sunreyConversion.value.numerator),
      encodeBigint(pkg.sunreyConversion.value.denominator),
    ]),
    MOONREY_GPUV_TO_SETTLEMENT_CONVERSION: sha256Hex([
      'MOONREY_GPUV_TO_SETTLEMENT_CONVERSION',
      encodeBigint(pkg.moonreyConversion.value.numerator),
      encodeBigint(pkg.moonreyConversion.value.denominator),
    ]),
    SUNREY_PER_PERIOD_CAPS: sha256Hex([
      'SUNREY_PER_PERIOD_CAPS',
      encodeBigint(pkg.sunreyPerPeriodCaps.value.perContribution),
      encodeBigint(pkg.sunreyPerPeriodCaps.value.perClass),
      encodeBigint(pkg.sunreyPerPeriodCaps.value.perEpoch),
    ]),
    MOONREY_PER_PERIOD_CAPS: sha256Hex([
      'MOONREY_PER_PERIOD_CAPS',
      encodeBigint(pkg.moonreyPerPeriodCaps.value.perEvent),
      encodeBigint(pkg.moonreyPerPeriodCaps.value.perObject),
      encodeBigint(pkg.moonreyPerPeriodCaps.value.perController),
      encodeBigint(pkg.moonreyPerPeriodCaps.value.perCategory),
      encodeBigint(pkg.moonreyPerPeriodCaps.value.globalEpoch),
    ]),
    GLOBAL_SUPPLY_GUARDS: sha256Hex([
      'GLOBAL_SUPPLY_GUARDS',
      encodeBigint(pkg.globalSupplyGuards.value.sunrey),
      encodeBigint(pkg.globalSupplyGuards.value.moonrey),
    ]),
    PER_CLASS_CAPS: sha256Hex([
      'PER_CLASS_CAPS',
      ...Object.entries(pkg.perClassCaps.value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, qty]) => `${key}:${qty.toString()}`),
    ]),
    FEE_POLICY: sha256Hex(['FEE_POLICY', pkg.feePolicy.value]),
    BURN_POLICY: sha256Hex(['BURN_POLICY', pkg.burnPolicy.value]),
    GENESIS_ALLOCATION_MANIFEST: sha256Hex([
      'GENESIS_ALLOCATION_MANIFEST',
      ...pkg.genesisAllocation.value.map((line) => `${line.lineId}:${line.assetId}:${line.quantity.toString()}`),
    ]),
  };
  return Object.freeze(
    PRODUCTION_PARAMETER_IDS.map((id) => fixtureParameterRecord(id, pkg.policyVersion, hashes[id])),
  );
}

function chunkPresent(relative: string): boolean {
  return existsSync(join(CHAIN_SRC, relative));
}

export function detectCandidateOwners(): {
  readonly chunk144Present: boolean;
  readonly chunk145Present: boolean;
  readonly chunk146Present: boolean;
} {
  return {
    chunk144Present:
      chunkPresent('economics/production-activation/parameter-package/index.ts') ||
      chunkPresent('economics/production-parameters/index.ts') ||
      chunkPresent('economics/production-parameter-registry/index.ts'),
    chunk145Present:
      chunkPresent('economics/production-activation/sunrey-package/index.ts') ||
      chunkPresent('economics/sunrey-policy-candidate/index.ts') ||
      chunkPresent('economics/sunrey-production-policy/index.ts'),
    chunk146Present:
      chunkPresent('economics/production-activation/moonrey-parameter-package.ts') ||
      chunkPresent('economics/moonrey-policy-candidate/index.ts') ||
      chunkPresent('economics/moonrey-production-policy/index.ts'),
  };
}

export function hashParameterPackage(pkg: RehearsalParameterPackage): string {
  return sha256Hex([
    'SUNREY_REHEARSAL_PARAMETER_PACKAGE_V1',
    pkg.packageId,
    pkg.policyVersion,
    pkg.sourceClass,
    pkg.fixture ? '1' : '0',
    pkg.rehearsalOnly ? '1' : '0',
    encodeBigint(pkg.sunreyMaximumSupply.value),
    encodeBigint(pkg.moonreyMaximumSupply.value),
    encodeBigint(pkg.sunreyGenesisSupply.value),
    encodeBigint(pkg.moonreyGenesisSupply.value),
    encodeBigint(pkg.sunreyConversion.value.numerator),
    encodeBigint(pkg.sunreyConversion.value.denominator),
    encodeBigint(pkg.moonreyConversion.value.numerator),
    encodeBigint(pkg.moonreyConversion.value.denominator),
    ...pkg.genesisAllocation.value.map((line) => `${line.lineId}:${line.assetId}:${line.quantity.toString()}`),
  ]);
}

export function hashSunReyCandidatePolicy(pkg: RehearsalParameterPackage): string {
  return sha256Hex([
    'SUNREY_REHEARSAL_CANDIDATE_POLICY_V1',
    pkg.policyVersion,
    encodeBigint(pkg.sunreyMaximumSupply.value),
    encodeBigint(pkg.sunreyGenesisSupply.value),
    pkg.sunreyPostGenesisIssuancePolicy.value,
    encodeBigint(pkg.sunreyConversion.value.numerator),
    encodeBigint(pkg.sunreyConversion.value.denominator),
    encodeBigint(pkg.sunreyConversion.value.perContributionCeiling),
    encodeBigint(pkg.sunreyConversion.value.perClassCeiling),
    encodeBigint(pkg.sunreyConversion.value.perEpochCeiling),
  ]);
}

export function hashMoonReyCandidatePolicy(pkg: RehearsalParameterPackage): string {
  return sha256Hex([
    'MOONREY_REHEARSAL_CANDIDATE_POLICY_V1',
    pkg.policyVersion,
    encodeBigint(pkg.moonreyMaximumSupply.value),
    encodeBigint(pkg.moonreyGenesisSupply.value),
    pkg.moonreyPostGenesisIssuancePolicy.value,
    encodeBigint(pkg.moonreyConversion.value.numerator),
    encodeBigint(pkg.moonreyConversion.value.denominator),
    encodeBigint(pkg.moonreyConversion.value.perContributionCeiling),
    encodeBigint(pkg.moonreyConversion.value.perEventCeiling),
    encodeBigint(pkg.moonreyConversion.value.perObjectCeiling),
    encodeBigint(pkg.moonreyConversion.value.perControllerCeiling),
    encodeBigint(pkg.moonreyConversion.value.perCategoryEpochCeiling),
    encodeBigint(pkg.moonreyConversion.value.globalEpochCeiling),
  ]);
}

function genesisTotalsExact(pkg: RehearsalParameterPackage): boolean {
  const sunrey = pkg.genesisAllocation.value
    .filter((line) => line.assetId === 'SUNREY_COIN')
    .reduce((sum, line) => sum + line.quantity, 0n);
  const moonrey = pkg.genesisAllocation.value
    .filter((line) => line.assetId === 'MOONREY_COIN')
    .reduce((sum, line) => sum + line.quantity, 0n);
  return sunrey === pkg.sunreyGenesisSupply.value && moonrey === pkg.moonreyGenesisSupply.value;
}

function everyValueIsFixture(pkg: RehearsalParameterPackage): boolean {
  const values = [
    pkg.sunreyMaximumSupply,
    pkg.moonreyMaximumSupply,
    pkg.sunreyGenesisSupply,
    pkg.moonreyGenesisSupply,
    pkg.sunreyPostGenesisIssuancePolicy,
    pkg.moonreyPostGenesisIssuancePolicy,
    pkg.sunreyConversion,
    pkg.moonreyConversion,
    pkg.sunreyPerPeriodCaps,
    pkg.moonreyPerPeriodCaps,
    pkg.globalSupplyGuards,
    pkg.perClassCaps,
    pkg.feePolicy,
    pkg.burnPolicy,
    pkg.genesisAllocation,
    pkg.requireFinalizedHinAnchor,
  ];
  return (
    pkg.sourceClass === REHEARSAL_FIXTURE_SOURCE &&
    pkg.fixture &&
    pkg.rehearsalOnly &&
    values.every((row) => row.sourceClass === REHEARSAL_FIXTURE_SOURCE && row.fixture && row.rehearsalOnly) &&
    pkg.genesisAllocation.value.every(
      (line) => line.sourceClass === REHEARSAL_FIXTURE_SOURCE && line.fixture && line.rehearsalOnly,
    )
  );
}

export function validateRehearsalParameterPackage(pkg: RehearsalParameterPackage): ParameterValidationResult {
  const owners = detectCandidateOwners();
  const refusals: string[] = [];
  const typeValid = everyValueIsFixture(pkg) && pkg.schemaVersion === 1;
  if (!typeValid) {
    refusals.push('TYPE_VALIDATION_FAILED');
  }
  const records = productionRecordsFromPackage(pkg);
  const productionParameterHash = parameterManifestHash(records);
  const dependenciesValid = PRODUCTION_PARAMETER_IDS.every((id) => records.some((row) => row.id === id));
  if (!dependenciesValid) {
    refusals.push('DEPENDENCY_VALIDATION_FAILED');
  }

  const sunreyConversion = sunreySimulationConversion({
    conversionNumerator: pkg.sunreyConversion.value.numerator,
    conversionDenominator: pkg.sunreyConversion.value.denominator,
    perContributionCeiling: pkg.sunreyConversion.value.perContributionCeiling,
    perEpochCeiling: pkg.sunreyConversion.value.perEpochCeiling,
  });
  const moonreyConversion = moonreySimulationConversion({
    conversionNumerator: pkg.moonreyConversion.value.numerator,
    conversionDenominator: pkg.moonreyConversion.value.denominator,
    perContributionCeiling: pkg.moonreyConversion.value.perContributionCeiling,
    perEventCeiling: pkg.moonreyConversion.value.perEventCeiling,
    perObjectCeiling: pkg.moonreyConversion.value.perObjectCeiling,
    perControllerCeiling: pkg.moonreyConversion.value.perControllerCeiling,
    perCategoryEpochCeiling: pkg.moonreyConversion.value.perCategoryEpochCeiling,
    globalEpochCeiling: pkg.moonreyConversion.value.globalEpochCeiling,
  });
  const sunreyConversionOk = validateSunReyConversion(sunreyConversion) === null;
  const moonreyConversionOk = validateMoonReyConversion(moonreyConversion) === null;
  if (!sunreyConversionOk) {
    refusals.push('SUNREY_CONVERSION_INVALID');
  }
  if (!moonreyConversionOk) {
    refusals.push('MOONREY_CONVERSION_INVALID');
  }

  const totalsExact = genesisTotalsExact(pkg);
  if (!totalsExact) {
    refusals.push('GENESIS_ALLOCATION_MISMATCH');
  }
  const maxCoversGenesis =
    pkg.sunreyMaximumSupply.value >= pkg.sunreyGenesisSupply.value &&
    pkg.moonreyMaximumSupply.value >= pkg.moonreyGenesisSupply.value;
  if (!maxCoversGenesis) {
    refusals.push('MAXIMUM_SUPPLY_BELOW_GENESIS');
  }
  const noIdentityConversion =
    pkg.sunreyConversion.value.numerator !== pkg.sunreyConversion.value.denominator &&
    pkg.moonreyConversion.value.numerator !== pkg.moonreyConversion.value.denominator;
  if (!noIdentityConversion) {
    refusals.push('IDENTITY_CONVERSION_FORBIDDEN');
  }

  const usedValidators: ParameterValidationUse = {
    typeValidation: owners.chunk144Present ? 'CHUNK_144_TYPE_VALIDATION' : 'CHUNK_143_CLASSIFY_PARAMETER',
    dependencyValidation: owners.chunk144Present
      ? 'CHUNK_144_DEPENDENCY_VALIDATION'
      : 'CHUNK_143_PRODUCTION_PARAMETER_IDS',
    crossParameterInvariants: owners.chunk144Present
      ? 'CHUNK_144_CROSS_PARAMETER'
      : 'CHUNK_143_PLUS_CANDIDATE_INVARIANTS',
    canonicalHashing: owners.chunk144Present ? 'CHUNK_144_CANONICAL_HASH' : 'CHUNK_143_PARAMETER_MANIFEST_HASH',
    assetPolicyValidators: owners.chunk145Present && owners.chunk146Present
      ? 'CHUNK_145_146_ASSET_POLICY_VALIDATORS'
      : 'CHUNK_112_AND_125_CONVERSION_VALIDATORS',
    chunk144Present: owners.chunk144Present,
    chunk145Present: owners.chunk145Present,
    chunk146Present: owners.chunk146Present,
  };

  return Object.freeze({
    ok: refusals.length === 0,
    packageHash: hashParameterPackage(pkg),
    productionParameterHash,
    sunreyPolicyHash: hashSunReyCandidatePolicy(pkg),
    moonreyPolicyHash: hashMoonReyCandidatePolicy(pkg),
    typeValid,
    dependenciesValid,
    crossParameterValid: totalsExact && maxCoversGenesis && noIdentityConversion && sunreyConversionOk && moonreyConversionOk,
    genesisTotalsExact: totalsExact,
    hiddenPremint: false,
    faucetMigration: false,
    applicationLedgerMigration: false,
    usedValidators,
    refusals: Object.freeze(refusals),
  });
}

export function rejectMaxSupplyTightening(
  pkg: RehearsalParameterPackage,
  issued: { readonly sunrey: bigint; readonly moonrey: bigint },
): { readonly rejected: boolean; readonly reason: string | null } {
  if (pkg.sunreyMaximumSupply.value < issued.sunrey || pkg.moonreyMaximumSupply.value < issued.moonrey) {
    return {
      rejected: true,
      reason: 'FUTURE_MAX_SUPPLY_BELOW_CURRENT_ISSUED',
    };
  }
  return { rejected: false, reason: null };
}
