/**
 * Structural test fixtures. Every value is fixture: true and
 * REHEARSAL_FIXTURE or ENGINEERING_SIMULATION.
 *
 * These may pass structural validation. They do not pass production
 * governance and are not recommended tokenomics.
 */

import { PRODUCTION_PARAMETER_IDS, type ProductionParameterId } from '../types.ts';

import { expectedValueKind } from './definitions.ts';
import {
  PRODUCTION_PARAMETER_PACKAGE_SCHEMA_VERSION,
  type ProductionEconomicParameterPackageInput,
  type ProductionParameterCandidateInput,
  type ProductionParameterValue,
} from './types.ts';
import {
  burnPolicyReference,
  capScheduleValue,
  feePolicyReference,
  genesisAllocationReference,
  globalSupplyGuardCandidate,
  issuancePolicyReference,
  quantityValue,
  rationalConversionValue,
} from './values.ts';

export const FIXTURE_CREATED_AT = '2026-01-01T00:00:00.000Z' as const;

export function fixtureQuantity(assetId: 'SUNREY_COIN' | 'MOONREY_COIN', minorUnits = 0n) {
  return quantityValue({ assetId, minorUnits });
}

function fixtureValue(id: ProductionParameterId): ProductionParameterValue {
  switch (id) {
    case 'SUNREY_MAXIMUM_SUPPLY':
    case 'SUNREY_GENESIS_SUPPLY':
      return fixtureQuantity('SUNREY_COIN', 0n);
    case 'MOONREY_MAXIMUM_SUPPLY':
    case 'MOONREY_GENESIS_SUPPLY':
      return fixtureQuantity('MOONREY_COIN', 0n);
    case 'SUNREY_POST_GENESIS_ISSUANCE_POLICY':
      return issuancePolicyReference({
        assetId: 'SUNREY_COIN',
        policyVersion: 'sunrey.issuance.sunrey_coin.constitution.v1',
      });
    case 'MOONREY_POST_GENESIS_ISSUANCE_POLICY':
      return issuancePolicyReference({
        assetId: 'MOONREY_COIN',
        policyVersion: 'sunrey.issuance.moonrey_coin.constitution.v1',
      });
    case 'SUNREY_CONTRIBUTION_TO_SETTLEMENT_CONVERSION':
    case 'MOONREY_GPUV_TO_SETTLEMENT_CONVERSION':
      return rationalConversionValue({ numerator: 3n, denominator: 7n });
    case 'SUNREY_PER_PERIOD_CAPS':
      return capScheduleValue({ assetId: 'SUNREY_COIN', caps: [] });
    case 'MOONREY_PER_PERIOD_CAPS':
      return capScheduleValue({ assetId: 'MOONREY_COIN', caps: [] });
    case 'GLOBAL_SUPPLY_GUARDS':
      return globalSupplyGuardCandidate({
        assetId: 'SHARED',
        maximumSupplyRef: 'SUNREY_MAXIMUM_SUPPLY',
        genesisSupplyRef: 'SUNREY_GENESIS_SUPPLY',
      });
    case 'PER_CLASS_CAPS':
      return capScheduleValue({ assetId: 'SHARED', caps: [] });
    case 'FEE_POLICY':
      return feePolicyReference('sunrey.fees.production-candidate.v1');
    case 'BURN_POLICY':
      return burnPolicyReference('sunrey.burn.sunrey_coin.v1');
    case 'GENESIS_ALLOCATION_MANIFEST':
      return genesisAllocationReference({
        manifestRef: 'fixture.genesis-allocation.unallocated',
        lines: [],
      });
    default: {
      const _never: never = id;
      throw new TypeError(`unhandled parameter id: ${String(_never)}`);
    }
  }
}

export function fixtureCandidate(
  parameterId: ProductionParameterId,
  options?: {
    readonly value?: ProductionParameterValue | null;
    readonly versionId?: string;
    readonly sourceClass?: 'REHEARSAL_FIXTURE' | 'ENGINEERING_SIMULATION';
    readonly alias?: string | null;
    readonly supersedesVersion?: string | null;
    readonly humanApprovalReferences?: readonly string[];
    readonly externalEvidenceReferences?: readonly string[];
    readonly governanceReference?: string | null;
  },
): ProductionParameterCandidateInput {
  const value = options && 'value' in options ? options.value ?? null : fixtureValue(parameterId);
  return Object.freeze({
    parameterId,
    value,
    valueKind: expectedValueKind(parameterId),
    versionId: options?.versionId ?? `fixture.${parameterId}.v1`,
    sourceClass: options?.sourceClass ?? 'REHEARSAL_FIXTURE',
    createdAt: FIXTURE_CREATED_AT,
    effectiveHeightCandidate: null,
    supersedesVersion: options?.supersedesVersion ?? null,
    governanceReference: options?.governanceReference ?? null,
    externalEvidenceReferences: Object.freeze([...(options?.externalEvidenceReferences ?? [])]),
    humanApprovalReferences: Object.freeze([...(options?.humanApprovalReferences ?? [])]),
    fixture: true,
    rehearsalOnly: true,
    alias: options?.alias ?? null,
  });
}

export function fixturePackageInput(
  parameters: readonly ProductionParameterCandidateInput[],
  options?: {
    readonly packageId?: string;
    readonly packageVersion?: string;
  },
): ProductionEconomicParameterPackageInput {
  return Object.freeze({
    packageId: options?.packageId ?? 'pkg.fixture.partial.v1',
    schemaVersion: PRODUCTION_PARAMETER_PACKAGE_SCHEMA_VERSION,
    packageVersion: options?.packageVersion ?? 'fixture.v1',
    sourceCommit: 'fixture.not-a-production-commit',
    parameters: Object.freeze([...parameters]),
    bindings: Object.freeze([]),
    governanceEvidence: Object.freeze([]),
    externalEvidence: Object.freeze([]),
    humanEvidence: Object.freeze([]),
    supersedes: null,
    supersededBy: null,
  });
}

export function completeFixturePackageInput(
  overrides: Partial<Record<ProductionParameterId, string>> = {},
): ProductionEconomicParameterPackageInput {
  return fixturePackageInput(
    PRODUCTION_PARAMETER_IDS.map((id) =>
      fixtureCandidate(id, {
        versionId: `fixture.${id}.${overrides[id] ?? 'v1'}`,
      }),
    ),
    { packageId: 'pkg.fixture.complete.v1', packageVersion: 'fixture.complete.v1' },
  );
}

export function partialDemoPackageInput(): ProductionEconomicParameterPackageInput {
  return fixturePackageInput(
    [
      fixtureCandidate('SUNREY_MAXIMUM_SUPPLY', {
        versionId: 'fixture.SUNREY_MAXIMUM_SUPPLY.explicit-zero.demo',
        sourceClass: 'REHEARSAL_FIXTURE',
      }),
    ],
    { packageId: 'pkg.fixture.demo.partial.v1', packageVersion: 'fixture.demo.partial.v1' },
  );
}
