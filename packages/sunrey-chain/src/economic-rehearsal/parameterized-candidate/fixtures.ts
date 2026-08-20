/**
 * Deterministic rehearsal parameter package.
 *
 * Fixture values are chosen only so validators and rehearsal paths can
 * run. They are not recommended tokenomics, not a production proposal,
 * and have no economic meaning outside rehearsal.
 */

import { rehearsalAllocationManifest } from '../genesis.ts';
import {
  NO_PRODUCTION_ECONOMIC_MEANING,
  PARAMETERIZED_REHEARSAL_DISCLAIMER,
  PARAMETERIZED_REHEARSAL_SCHEMA_VERSION,
  REHEARSAL_FIXTURE_SOURCE,
  type RehearsalAllocationLine,
  type RehearsalParameterPackage,
  type RehearsalParameterValue,
} from './types.ts';

function meta() {
  return Object.freeze({
    sourceClass: REHEARSAL_FIXTURE_SOURCE,
    fixture: true as const,
    rehearsalOnly: true as const,
  });
}

function value<T>(id: string, versionId: string, raw: T): RehearsalParameterValue<T> {
  return Object.freeze({
    ...meta(),
    id,
    versionId,
    value: raw,
  });
}

const V1 = 'rehearsal.parameter-package.v1';
const V2 = 'rehearsal.parameter-package.v2';

function allocationLines(): readonly RehearsalAllocationLine[] {
  return Object.freeze(
    rehearsalAllocationManifest().lines.map((line) =>
      Object.freeze({
        ...meta(),
        lineId: line.lineId,
        assetId: line.asset,
        category: line.category,
        quantity: line.quantityMinorUnits,
        destination: line.destination,
      }),
    ),
  );
}

export function rehearsalParameterPackageV1(): RehearsalParameterPackage {
  const lines = allocationLines();
  const sunreyGenesis = lines
    .filter((line) => line.assetId === 'SUNREY_COIN')
    .reduce((sum, line) => sum + line.quantity, 0n);
  const moonreyGenesis = lines
    .filter((line) => line.assetId === 'MOONREY_COIN')
    .reduce((sum, line) => sum + line.quantity, 0n);
  return Object.freeze({
    ...meta(),
    schemaVersion: PARAMETERIZED_REHEARSAL_SCHEMA_VERSION,
    packageId: 'pkg.rehearsal.dual-economy.v1',
    policyVersion: V1,
    disclaimer: PARAMETERIZED_REHEARSAL_DISCLAIMER,
    sunreyMaximumSupply: value('SUNREY_MAXIMUM_SUPPLY', V1, 100_000_000n),
    moonreyMaximumSupply: value('MOONREY_MAXIMUM_SUPPLY', V1, 50_000_000n),
    sunreyGenesisSupply: value('SUNREY_GENESIS_SUPPLY', V1, sunreyGenesis),
    moonreyGenesisSupply: value('MOONREY_GENESIS_SUPPLY', V1, moonreyGenesis),
    sunreyPostGenesisIssuancePolicy: value(
      'SUNREY_POST_GENESIS_ISSUANCE_POLICY',
      V1,
      'AUTHORIZED_HUMAN_ECONOMIC_CONTRIBUTION',
    ),
    moonreyPostGenesisIssuancePolicy: value(
      'MOONREY_POST_GENESIS_ISSUANCE_POLICY',
      V1,
      'GOVERNED_VALUE_SIMULATION_V2',
    ),
    sunreyConversion: value('SUNREY_CONTRIBUTION_TO_SETTLEMENT_CONVERSION', V1, {
      numerator: 2n,
      denominator: 5n,
      perContributionCeiling: 400n,
      perClassCeiling: 1_200n,
      perEpochCeiling: 2_000n,
      globalSupplyGuard: 20_000_000n,
    }),
    moonreyConversion: value('MOONREY_GPUV_TO_SETTLEMENT_CONVERSION', V1, {
      numerator: 2n,
      denominator: 5n,
      perContributionCeiling: 800n,
      perEventCeiling: 1_200n,
      perObjectCeiling: 2_400n,
      perControllerCeiling: 3_200n,
      perCategoryEpochCeiling: 4_000n,
      globalEpochCeiling: 8_000n,
      globalSupplyGuard: 10_000_000n,
    }),
    sunreyPerPeriodCaps: value('SUNREY_PER_PERIOD_CAPS', V1, {
      perContribution: 400n,
      perClass: 1_200n,
      perEpoch: 2_000n,
    }),
    moonreyPerPeriodCaps: value('MOONREY_PER_PERIOD_CAPS', V1, {
      perEvent: 1_200n,
      perObject: 2_400n,
      perController: 3_200n,
      perCategory: 4_000n,
      globalEpoch: 8_000n,
    }),
    globalSupplyGuards: value('GLOBAL_SUPPLY_GUARDS', V1, {
      sunrey: 20_000_000n,
      moonrey: 10_000_000n,
    }),
    perClassCaps: value('PER_CLASS_CAPS', V1, {
      COMMUNITY_CONTRIBUTION: 1_200n,
      ENERGY: 4_000n,
    }),
    feePolicy: value('FEE_POLICY', V1, 'sunrey.fee-policy.rehearsal.v1'),
    burnPolicy: value('BURN_POLICY', V1, 'sunrey.burn-policy.rehearsal.v1'),
    genesisAllocation: value('GENESIS_ALLOCATION_MANIFEST', V1, lines),
    requireFinalizedHinAnchor: value('HIN_FINALIZED_ANCHOR_REQUIRED', V1, true),
  });
}

export function rehearsalParameterPackageV2(): RehearsalParameterPackage {
  const v1 = rehearsalParameterPackageV1();
  return Object.freeze({
    ...v1,
    packageId: 'pkg.rehearsal.dual-economy.v2',
    policyVersion: V2,
    sunreyConversion: value('SUNREY_CONTRIBUTION_TO_SETTLEMENT_CONVERSION', V2, {
      ...v1.sunreyConversion.value,
      numerator: 3n,
      denominator: 7n,
    }),
    moonreyConversion: value('MOONREY_GPUV_TO_SETTLEMENT_CONVERSION', V2, {
      ...v1.moonreyConversion.value,
      numerator: 3n,
      denominator: 7n,
    }),
  });
}

export function impossibleMaxSupplyPackage(issuedSunRey: bigint): RehearsalParameterPackage {
  const v1 = rehearsalParameterPackageV1();
  const tightened = issuedSunRey > 0n ? issuedSunRey - 1n : 0n;
  return Object.freeze({
    ...v1,
    packageId: 'pkg.rehearsal.dual-economy.impossible-max',
    policyVersion: 'rehearsal.parameter-package.impossible-max',
    sunreyMaximumSupply: value('SUNREY_MAXIMUM_SUPPLY', 'rehearsal.parameter-package.impossible-max', tightened),
  });
}

export const FIXTURE_PACKAGE_NOTES = Object.freeze([
  'NOT RECOMMENDED TOKENOMICS',
  'NOT A PRODUCTION PROPOSAL',
  'NO ECONOMIC MEANING OUTSIDE REHEARSAL',
  NO_PRODUCTION_ECONOMIC_MEANING,
]);
