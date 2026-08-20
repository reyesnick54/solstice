/**
 * Code/constitution definitions for the 15 Chunk 143 parameter IDs.
 * Values are separate. This file does not choose production quantities.
 */

import { PRODUCTION_PARAMETER_IDS, type ProductionParameterId } from '../types.ts';

import {
  type ParameterValueKind,
  type ProductionParameterDefinition,
} from './types.ts';

const QUANTITY = 'QUANTITY' as const;
const RATIONAL = 'RATIONAL_CONVERSION' as const;
const CAP = 'CAP_SCHEDULE' as const;
const ISSUANCE = 'ISSUANCE_POLICY_REFERENCE' as const;
const GUARD = 'SUPPLY_GUARD_POLICY' as const;
const FEE = 'FEE_POLICY_REFERENCE' as const;
const BURN = 'BURN_POLICY_REFERENCE' as const;
const ALLOCATION = 'GENESIS_ALLOCATION_REFERENCE' as const;

function definition(
  parameterId: ProductionParameterId,
  valueKind: ParameterValueKind,
  assetScope: ProductionParameterDefinition['assetScope'],
  dependencies: readonly ProductionParameterId[],
  description: string,
): ProductionParameterDefinition {
  return Object.freeze({
    parameterId,
    valueKind,
    assetScope,
    required: true,
    dependencies: Object.freeze([...dependencies]),
    allowsZero: valueKind === QUANTITY || valueKind === CAP,
    requiresGovernance: true,
    requiresHumanReview: true,
    requiresExternalEvidence: parameterId === 'GENESIS_ALLOCATION_MANIFEST' || parameterId.endsWith('_CONVERSION'),
    productionCritical: true,
    description,
  });
}

export const PRODUCTION_PARAMETER_DEFINITIONS: readonly ProductionParameterDefinition[] = Object.freeze([
  definition(
    'SUNREY_MAXIMUM_SUPPLY',
    QUANTITY,
    'SUNREY_COIN',
    [],
    'Governed SunRey Coin maximum supply in bigint minor units. Unconfigured until humans select a value.',
  ),
  definition(
    'MOONREY_MAXIMUM_SUPPLY',
    QUANTITY,
    'MOONREY_COIN',
    [],
    'Governed MoonRey Coin maximum supply in bigint minor units. Unconfigured until humans select a value.',
  ),
  definition(
    'SUNREY_GENESIS_SUPPLY',
    QUANTITY,
    'SUNREY_COIN',
    ['SUNREY_MAXIMUM_SUPPLY'],
    'Governed SunRey Coin genesis supply. Requires a selected SunRey maximum-supply policy.',
  ),
  definition(
    'MOONREY_GENESIS_SUPPLY',
    QUANTITY,
    'MOONREY_COIN',
    ['MOONREY_MAXIMUM_SUPPLY'],
    'Governed MoonRey Coin genesis supply. Requires a selected MoonRey maximum-supply policy.',
  ),
  definition(
    'SUNREY_POST_GENESIS_ISSUANCE_POLICY',
    ISSUANCE,
    'SUNREY_COIN',
    [],
    'Reference to the existing SunRey post-genesis issuance policy. Not a mint.',
  ),
  definition(
    'MOONREY_POST_GENESIS_ISSUANCE_POLICY',
    ISSUANCE,
    'MOONREY_COIN',
    [],
    'Reference to the existing MoonRey post-genesis issuance policy. Not a mint.',
  ),
  definition(
    'SUNREY_CONTRIBUTION_TO_SETTLEMENT_CONVERSION',
    RATIONAL,
    'SUNREY_COIN',
    ['SUNREY_POST_GENESIS_ISSUANCE_POLICY'],
    'Exact rational conversion from contribution reference units to SunRey settlement. 1:1 is not inferred.',
  ),
  definition(
    'MOONREY_GPUV_TO_SETTLEMENT_CONVERSION',
    RATIONAL,
    'MOONREY_COIN',
    ['MOONREY_POST_GENESIS_ISSUANCE_POLICY'],
    'Exact rational conversion from GPUV to MoonRey settlement. 1 GPUV = 1 MoonRey is not inferred.',
  ),
  definition(
    'SUNREY_PER_PERIOD_CAPS',
    CAP,
    'SUNREY_COIN',
    [],
    'Optional SunRey cap schedule. Asset-specific packages decide which scopes apply.',
  ),
  definition(
    'MOONREY_PER_PERIOD_CAPS',
    CAP,
    'MOONREY_COIN',
    [],
    'Optional MoonRey cap schedule. Asset-specific packages decide which scopes apply.',
  ),
  definition(
    'GLOBAL_SUPPLY_GUARDS',
    GUARD,
    'SHARED',
    [],
    'Typed global supply-guard policy candidate. Does not duplicate AssetSupplyBook.',
  ),
  definition(
    'PER_CLASS_CAPS',
    CAP,
    'SHARED',
    [],
    'Per-class issuance cap schedule. Negative caps are rejected.',
  ),
  definition(
    'FEE_POLICY',
    FEE,
    'SHARED',
    [],
    'Reference to an existing fee policy version. This chunk does not choose production fee values.',
  ),
  definition(
    'BURN_POLICY',
    BURN,
    'SHARED',
    [],
    'Reference to an existing burn policy version. This chunk does not choose production burn values.',
  ),
  definition(
    'GENESIS_ALLOCATION_MANIFEST',
    ALLOCATION,
    'SHARED',
    ['SUNREY_GENESIS_SUPPLY', 'MOONREY_GENESIS_SUPPLY'],
    'Reference to a genesis allocation manifest. Nonzero lines require the matching genesis-supply policies.',
  ),
]);

export const EXPECTED_PARAMETER_VALUE_KIND: Readonly<Record<ProductionParameterId, ParameterValueKind>> =
  Object.freeze(
    Object.fromEntries(PRODUCTION_PARAMETER_DEFINITIONS.map((row) => [row.parameterId, row.valueKind])) as Record<
      ProductionParameterId,
      ParameterValueKind
    >,
  );

export function definitionFor(parameterId: ProductionParameterId): ProductionParameterDefinition {
  const found = PRODUCTION_PARAMETER_DEFINITIONS.find((row) => row.parameterId === parameterId);
  if (!found) {
    throw new TypeError(`unknown production parameter id: ${parameterId}`);
  }
  return found;
}

export function expectedValueKind(parameterId: ProductionParameterId): ParameterValueKind {
  return definitionFor(parameterId).valueKind;
}

export function allParameterDefinitionsExist(): boolean {
  return (
    PRODUCTION_PARAMETER_DEFINITIONS.length === PRODUCTION_PARAMETER_IDS.length &&
    PRODUCTION_PARAMETER_IDS.every((id) => PRODUCTION_PARAMETER_DEFINITIONS.some((row) => row.parameterId === id))
  );
}
