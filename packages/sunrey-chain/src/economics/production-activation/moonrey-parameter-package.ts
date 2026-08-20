/**
 * Chunk 146 — MoonRey production issuance parameter package.
 *
 * Binds the Chunk 143 parameter identifiers. Does not choose real
 * MoonRey production tokenomics or activate issuance.
 */

import { encodeString, sha256Hex } from '../../validators/canonical.ts';
import { CANONICAL_MOONREY_ISSUANCE_CLASS } from '../../productive/policy-governance/value-settlement/production-candidate/types.ts';
import type { MoonReyProductionSettlementConversionPolicyCandidate } from '../../productive/policy-governance/value-settlement/production-candidate/types.ts';
import type { MoonReyProductiveValuePolicyCandidate } from '../../productive/policy-governance/value-function/production-candidate/types.ts';
import { PRODUCTION_PARAMETER_IDS, type ProductionParameterId } from './types.ts';

export const MOONREY_PRODUCTION_ISSUANCE_PACKAGE_ID = 'moonrey.production-issuance-parameter-package.v1' as const;
export const MOONREY_PRODUCTION_ISSUANCE_PACKAGE_DOMAIN = 'SUNREY_MOONREY_PRODUCTION_ISSUANCE_PACKAGE_V1' as const;
export const PRODUCTION_PARAMETER_UNCONFIGURED = 'UNCONFIGURED' as const;

export type UnconfiguredQuantity = typeof PRODUCTION_PARAMETER_UNCONFIGURED;

export type CategoryCapCandidate = {
  readonly category: string;
  readonly epochCeiling: bigint | UnconfiguredQuantity;
  readonly sourceClass: 'UNCONFIGURED' | 'REHEARSAL_ONLY' | 'PRODUCTION_CANDIDATE';
  readonly automaticEqualAllocation: false;
  readonly aiSelectedWeighting: false;
};

export type ControllerConcentrationControl = {
  readonly controllerId: string;
  readonly organizationId: string;
  readonly epochCeiling: bigint | UnconfiguredQuantity;
  readonly treatApisAsSeparateControllers: false;
};

export type MoonReyProductionIssuanceParameterPackage = {
  readonly packageId: string;
  readonly packageVersion: number;
  readonly MOONREY_MAXIMUM_SUPPLY: bigint | UnconfiguredQuantity;
  readonly MOONREY_GENESIS_SUPPLY: bigint | UnconfiguredQuantity;
  readonly MOONREY_POST_GENESIS_ISSUANCE_POLICY: typeof CANONICAL_MOONREY_ISSUANCE_CLASS;
  readonly MOONREY_GPUV_TO_SETTLEMENT_CONVERSION: MoonReyProductionSettlementConversionPolicyCandidate | UnconfiguredQuantity;
  readonly MOONREY_PER_PERIOD_CAPS: {
    readonly perContribution: bigint | UnconfiguredQuantity;
    readonly perEvent: bigint | UnconfiguredQuantity;
    readonly perObject: bigint | UnconfiguredQuantity;
    readonly perController: bigint | UnconfiguredQuantity;
    readonly perCategoryEpoch: bigint | UnconfiguredQuantity;
    readonly globalEpoch: bigint | UnconfiguredQuantity;
  };
  readonly PER_CLASS_CAPS: readonly CategoryCapCandidate[];
  readonly GLOBAL_SUPPLY_GUARDS: {
    readonly maximumSupplyGuard: true;
    readonly conversionCannotBypassMaximum: true;
    readonly genesisMustNotExceedMaximum: true;
  };
  readonly GENESIS_ALLOCATION_MANIFEST: string | UnconfiguredQuantity;
  readonly FEE_POLICY: string | UnconfiguredQuantity;
  readonly BURN_POLICY: string | UnconfiguredQuantity;
  readonly productiveValuePolicy: MoonReyProductiveValuePolicyCandidate | UnconfiguredQuantity;
  readonly controllerConcentration: readonly ControllerConcentrationControl[];
  readonly boundParameterIds: readonly ProductionParameterId[];
  readonly sourceClass: 'UNCONFIGURED' | 'REHEARSAL_ONLY' | 'PRODUCTION_CANDIDATE';
  readonly fixture: boolean;
  readonly packageHash: string;
  readonly productionActivated: false;
  readonly gpuvValuesSelected: false;
  readonly conversionSelected: false;
  readonly fixtureAuthorizesProduction: false;
  readonly gpuvEqualsMoonReyByDefinition: false;
  readonly legacyV1ProductionEligible: false;
  readonly canMint: false;
};

export function unconfiguredMoonReyProductionIssuancePackage(): MoonReyProductionIssuanceParameterPackage {
  const draft = {
    packageId: MOONREY_PRODUCTION_ISSUANCE_PACKAGE_ID,
    packageVersion: 1,
    MOONREY_MAXIMUM_SUPPLY: PRODUCTION_PARAMETER_UNCONFIGURED,
    MOONREY_GENESIS_SUPPLY: PRODUCTION_PARAMETER_UNCONFIGURED,
    MOONREY_POST_GENESIS_ISSUANCE_POLICY: CANONICAL_MOONREY_ISSUANCE_CLASS,
    MOONREY_GPUV_TO_SETTLEMENT_CONVERSION: PRODUCTION_PARAMETER_UNCONFIGURED,
    MOONREY_PER_PERIOD_CAPS: Object.freeze({
      perContribution: PRODUCTION_PARAMETER_UNCONFIGURED,
      perEvent: PRODUCTION_PARAMETER_UNCONFIGURED,
      perObject: PRODUCTION_PARAMETER_UNCONFIGURED,
      perController: PRODUCTION_PARAMETER_UNCONFIGURED,
      perCategoryEpoch: PRODUCTION_PARAMETER_UNCONFIGURED,
      globalEpoch: PRODUCTION_PARAMETER_UNCONFIGURED,
    }),
    PER_CLASS_CAPS: Object.freeze([]),
    GLOBAL_SUPPLY_GUARDS: Object.freeze({
      maximumSupplyGuard: true,
      conversionCannotBypassMaximum: true,
      genesisMustNotExceedMaximum: true,
    }),
    GENESIS_ALLOCATION_MANIFEST: PRODUCTION_PARAMETER_UNCONFIGURED,
    FEE_POLICY: PRODUCTION_PARAMETER_UNCONFIGURED,
    BURN_POLICY: PRODUCTION_PARAMETER_UNCONFIGURED,
    productiveValuePolicy: PRODUCTION_PARAMETER_UNCONFIGURED,
    controllerConcentration: Object.freeze([]),
    boundParameterIds: PRODUCTION_PARAMETER_IDS.filter((id) => id.startsWith('MOONREY_') || id === 'GLOBAL_SUPPLY_GUARDS' || id === 'PER_CLASS_CAPS' || id === 'FEE_POLICY' || id === 'BURN_POLICY' || id === 'GENESIS_ALLOCATION_MANIFEST'),
    sourceClass: 'UNCONFIGURED' as const,
    fixture: false,
    productionActivated: false as const,
    gpuvValuesSelected: false as const,
    conversionSelected: false as const,
    fixtureAuthorizesProduction: false as const,
    gpuvEqualsMoonReyByDefinition: false as const,
    legacyV1ProductionEligible: false as const,
    canMint: false as const,
  };
  return Object.freeze({
    ...draft,
    packageHash: hashIssuancePackage(draft),
  });
}

export function rehearsalMoonReyProductionIssuancePackage(input: {
  readonly productiveValuePolicy: MoonReyProductiveValuePolicyCandidate;
  readonly conversion: MoonReyProductionSettlementConversionPolicyCandidate;
  readonly maximumSupply?: bigint;
  readonly genesisSupply?: bigint;
  readonly categoryCaps?: readonly CategoryCapCandidate[];
  readonly controllerConcentration?: readonly ControllerConcentrationControl[];
}): MoonReyProductionIssuanceParameterPackage {
  const draft = {
    ...unconfiguredMoonReyProductionIssuancePackage(),
    MOONREY_MAXIMUM_SUPPLY: input.maximumSupply ?? 1_000_000n,
    MOONREY_GENESIS_SUPPLY: input.genesisSupply ?? 0n,
    MOONREY_GPUV_TO_SETTLEMENT_CONVERSION: input.conversion,
    MOONREY_PER_PERIOD_CAPS: Object.freeze({
      perContribution: input.conversion.perContributionCeiling ?? 'UNCONFIGURED',
      perEvent: input.conversion.perEventCeiling ?? 'UNCONFIGURED',
      perObject: input.conversion.perObjectCeiling ?? 'UNCONFIGURED',
      perController: input.conversion.perControllerCeiling ?? 'UNCONFIGURED',
      perCategoryEpoch: input.conversion.perCategoryEpochCeiling ?? 'UNCONFIGURED',
      globalEpoch: input.conversion.globalEpochCeiling ?? 'UNCONFIGURED',
    }),
    PER_CLASS_CAPS: Object.freeze(input.categoryCaps ?? []),
    productiveValuePolicy: input.productiveValuePolicy,
    controllerConcentration: Object.freeze(input.controllerConcentration ?? []),
    sourceClass: 'REHEARSAL_ONLY' as const,
    fixture: true,
    gpuvValuesSelected: false as const,
    conversionSelected: false as const,
    fixtureAuthorizesProduction: false as const,
  };
  return Object.freeze({
    ...draft,
    packageHash: hashIssuancePackage(draft),
  });
}

export function hashIssuancePackage(
  pkg: Omit<MoonReyProductionIssuanceParameterPackage, 'packageHash'> | MoonReyProductionIssuanceParameterPackage,
): string {
  const { packageHash: _ignored, ...rest } = pkg as MoonReyProductionIssuanceParameterPackage;
  void _ignored;
  return sha256Hex(encodeString(`${MOONREY_PRODUCTION_ISSUANCE_PACKAGE_DOMAIN}|${stable(rest)}`));
}

function stable(value: unknown): string {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stable(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${key}:${stable(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
