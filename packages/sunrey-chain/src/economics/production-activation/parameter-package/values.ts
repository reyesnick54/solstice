/**
 * Typed parameter value constructors. Reject floats and unknown blobs.
 * Explicit 0n is not the same as missing.
 */

import type { NativeMonetaryAssetId } from '../../types.ts';
import type { ProductionParameterId } from '../types.ts';

import {
  NATIVE_PROTOCOL_PRECISION,
  PRECISION_REFERENCE,
  type BurnPolicyReferenceValue,
  type CapScheduleEntry,
  type CapScheduleValue,
  type CapScope,
  type FeePolicyReferenceValue,
  type GenesisAllocationLineCandidate,
  type GenesisAllocationReferenceValue,
  type GlobalSupplyGuardPolicyCandidate,
  type IssuancePolicyReferenceValue,
  type ParameterValueKind,
  type ProductionParameterValue,
  type QuantityParameterValue,
  type RationalConversionValue,
} from './types.ts';

export class ParameterValueError extends TypeError {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'ParameterValueError';
    this.code = code;
  }
}

export function assertBigintMinorUnits(value: unknown, label: string): asserts value is bigint {
  if (typeof value === 'number') {
    throw new ParameterValueError('FLOAT_QUANTITY_REJECTED', `${label} must be bigint minor units; number/float rejected`);
  }
  if (typeof value !== 'bigint') {
    throw new ParameterValueError('NON_BIGINT_QUANTITY', `${label} must be bigint minor units`);
  }
}

export function quantityValue(input: {
  readonly minorUnits: unknown;
  readonly assetId: NativeMonetaryAssetId;
}): QuantityParameterValue {
  assertBigintMinorUnits(input.minorUnits, 'quantity');
  return Object.freeze({
    kind: 'QUANTITY',
    minorUnits: input.minorUnits,
    precisionReference: PRECISION_REFERENCE,
    protocolPrecision: NATIVE_PROTOCOL_PRECISION,
    assetId: input.assetId,
  });
}

export function rationalConversionValue(input: {
  readonly numerator: unknown;
  readonly denominator: unknown;
}): RationalConversionValue {
  assertBigintMinorUnits(input.numerator, 'numerator');
  assertBigintMinorUnits(input.denominator, 'denominator');
  if (input.denominator === 0n) {
    throw new ParameterValueError('RATIONAL_DENOMINATOR_ZERO', 'conversion denominator must be > 0');
  }
  if (input.denominator < 0n) {
    throw new ParameterValueError('RATIONAL_DENOMINATOR_NEGATIVE', 'conversion denominator must be > 0');
  }
  return Object.freeze({
    kind: 'RATIONAL_CONVERSION',
    numerator: input.numerator,
    denominator: input.denominator,
  });
}

export function capScheduleValue(input: {
  readonly assetId: NativeMonetaryAssetId | 'SHARED';
  readonly caps: readonly {
    readonly scope: CapScope;
    readonly classOrCategory?: string | null;
    readonly quantityMinorUnits: unknown;
  }[];
}): CapScheduleValue {
  const caps: CapScheduleEntry[] = input.caps.map((row) => {
    assertBigintMinorUnits(row.quantityMinorUnits, `cap:${row.scope}`);
    return Object.freeze({
      scope: row.scope,
      classOrCategory: row.classOrCategory ?? null,
      quantityMinorUnits: row.quantityMinorUnits,
    });
  });
  return Object.freeze({
    kind: 'CAP_SCHEDULE',
    assetId: input.assetId,
    caps: Object.freeze(caps),
  });
}

export function issuancePolicyReference(input: {
  readonly assetId: NativeMonetaryAssetId;
  readonly policyVersion: string;
}): IssuancePolicyReferenceValue {
  return Object.freeze({
    kind: 'ISSUANCE_POLICY_REFERENCE',
    assetId: input.assetId,
    policyVersion: input.policyVersion,
  });
}

export function globalSupplyGuardCandidate(input: {
  readonly assetId: NativeMonetaryAssetId | 'SHARED';
  readonly maximumSupplyRef?: ProductionParameterId | null;
  readonly genesisSupplyRef?: ProductionParameterId | null;
  readonly postGenesisIssuanceEnabled?: boolean | 'UNCONFIGURED';
  readonly preventIssuanceAboveMaximum?: boolean;
  readonly preventNegativeSupply?: boolean;
  readonly preventHiddenPremint?: boolean;
  readonly preventFaucetMigration?: boolean;
  readonly preventRehearsalBalanceMigration?: boolean;
  readonly preventAutomaticApplicationLedgerMigration?: boolean;
  readonly reconciliationRequiredBeforeIssuance?: boolean;
  readonly issuedSupplyObserved?: bigint | 'UNCONFIGURED';
}): GlobalSupplyGuardPolicyCandidate {
  if (input.issuedSupplyObserved !== undefined && input.issuedSupplyObserved !== 'UNCONFIGURED') {
    assertBigintMinorUnits(input.issuedSupplyObserved, 'issuedSupplyObserved');
  }
  return Object.freeze({
    kind: 'SUPPLY_GUARD_POLICY',
    assetId: input.assetId,
    maximumSupplyRef: input.maximumSupplyRef ?? null,
    genesisSupplyRef: input.genesisSupplyRef ?? null,
    postGenesisIssuanceEnabled: input.postGenesisIssuanceEnabled ?? 'UNCONFIGURED',
    supplyBookAuthority: 'CHUNK_71_ASSET_SUPPLY_BOOK',
    preventIssuanceAboveMaximum: input.preventIssuanceAboveMaximum !== false,
    preventNegativeSupply: input.preventNegativeSupply !== false,
    preventHiddenPremint: input.preventHiddenPremint !== false,
    preventFaucetMigration: input.preventFaucetMigration !== false,
    preventRehearsalBalanceMigration: input.preventRehearsalBalanceMigration !== false,
    preventAutomaticApplicationLedgerMigration: input.preventAutomaticApplicationLedgerMigration !== false,
    reconciliationRequiredBeforeIssuance: input.reconciliationRequiredBeforeIssuance !== false,
    issuedSupplyObserved: input.issuedSupplyObserved ?? 'UNCONFIGURED',
  });
}

export function feePolicyReference(policyVersion: string): FeePolicyReferenceValue {
  return Object.freeze({
    kind: 'FEE_POLICY_REFERENCE',
    policyVersion,
  });
}

export function burnPolicyReference(policyVersion: string): BurnPolicyReferenceValue {
  return Object.freeze({
    kind: 'BURN_POLICY_REFERENCE',
    policyVersion,
  });
}

export function genesisAllocationReference(input: {
  readonly manifestRef: string;
  readonly lines?: readonly GenesisAllocationLineCandidate[];
  readonly totalByAsset?: { readonly SUNREY_COIN: bigint; readonly MOONREY_COIN: bigint };
}): GenesisAllocationReferenceValue {
  const lines = (input.lines ?? []).map((line) => {
    assertBigintMinorUnits(line.quantityMinorUnits, 'allocation.quantity');
    return Object.freeze({ ...line });
  });
  return Object.freeze({
    kind: 'GENESIS_ALLOCATION_REFERENCE',
    manifestRef: input.manifestRef,
    lines: Object.freeze(lines),
    totalByAsset: Object.freeze({
      SUNREY_COIN: input.totalByAsset?.SUNREY_COIN ?? 0n,
      MOONREY_COIN: input.totalByAsset?.MOONREY_COIN ?? 0n,
    }),
  });
}

export function isQuantityValue(value: ProductionParameterValue): value is QuantityParameterValue {
  return value.kind === 'QUANTITY';
}

export function valueKindOf(value: ProductionParameterValue | null): ParameterValueKind | null {
  return value?.kind ?? null;
}

export function missingQuantityUnconfigured(): null {
  return null;
}
