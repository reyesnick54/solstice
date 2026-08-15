import { type Brand, brandAs } from '../../../domain/src/brand.ts';

export type EconomicValueProfileId = Brand<string, 'EconomicValueProfileId'>;
export type EconomicValueSnapshotId = Brand<string, 'EconomicValueSnapshotId'>;
export type EconomicValueDimensionId = Brand<string, 'EconomicValueDimensionId'>;
export type AttributionEntryId = Brand<string, 'AttributionEntryId'>;
export type AttributionPeriodId = Brand<string, 'AttributionPeriodId'>;
export type AttributionGroupId = Brand<string, 'AttributionGroupId'>;
export type CounterfactualBaselineId = Brand<string, 'CounterfactualBaselineId'>;
export type ValuationFormulaVersion = Brand<string, 'ValuationFormulaVersion'>;
export type EconomicValueModelVersion = Brand<string, 'EconomicValueModelVersion'>;
export type DataContributionReferenceId = Brand<string, 'DataContributionReferenceId'>;
export type IndexPoints = Brand<bigint, 'IndexPoints'>;

const PREFIX = {
  EconomicValueProfileId: 'evp_',
  EconomicValueSnapshotId: 'evs_',
  EconomicValueDimensionId: 'evd_',
  AttributionEntryId: 'gae_',
  AttributionPeriodId: 'gap_',
  AttributionGroupId: 'gag_',
  CounterfactualBaselineId: 'cfb_',
  DataContributionReferenceId: 'dcr_',
} as const;

function brandPrefixed<Name extends keyof typeof PREFIX>(value: string, name: Name): Brand<string, Name> {
  if (value.length === 0 || !value.startsWith(PREFIX[name])) {
    throw new TypeError(`${name} must start with ${PREFIX[name]}`);
  }
  return brandAs<string, Name>(value);
}

export function asEconomicValueProfileId(value: string): EconomicValueProfileId {
  return brandPrefixed(value, 'EconomicValueProfileId');
}

export function asEconomicValueSnapshotId(value: string): EconomicValueSnapshotId {
  return brandPrefixed(value, 'EconomicValueSnapshotId');
}

export function asEconomicValueDimensionId(value: string): EconomicValueDimensionId {
  return brandPrefixed(value, 'EconomicValueDimensionId');
}

export function asAttributionEntryId(value: string): AttributionEntryId {
  return brandPrefixed(value, 'AttributionEntryId');
}

export function asAttributionPeriodId(value: string): AttributionPeriodId {
  return brandPrefixed(value, 'AttributionPeriodId');
}

export function asAttributionGroupId(value: string): AttributionGroupId {
  return brandPrefixed(value, 'AttributionGroupId');
}

export function asCounterfactualBaselineId(value: string): CounterfactualBaselineId {
  return brandPrefixed(value, 'CounterfactualBaselineId');
}

export function asDataContributionReferenceId(value: string): DataContributionReferenceId {
  return brandPrefixed(value, 'DataContributionReferenceId');
}

export function asValuationFormulaVersion(value: string): ValuationFormulaVersion {
  if (!/^peve-formula-v\d+$/.test(value)) {
    throw new TypeError('ValuationFormulaVersion must match peve-formula-vN');
  }
  return brandAs<string, 'ValuationFormulaVersion'>(value);
}

export function asEconomicValueModelVersion(value: string): EconomicValueModelVersion {
  if (!/^peve-model-v\d+$/.test(value)) {
    throw new TypeError('EconomicValueModelVersion must match peve-model-vN');
  }
  return brandAs<string, 'EconomicValueModelVersion'>(value);
}

export function asIndexPoints(value: bigint): IndexPoints {
  if (typeof value !== 'bigint') {
    throw new TypeError('IndexPoints admits only bigint; floating-point is forbidden');
  }
  if (value < 0n || value > 10000n) {
    throw new RangeError('IndexPoints must be in 0..10000 inclusive');
  }
  return brandAs<bigint, 'IndexPoints'>(value);
}

export function profileIdFor(subjectId: string): EconomicValueProfileId {
  return asEconomicValueProfileId(`evp_${subjectId}`);
}

export function snapshotIdFor(
  subjectId: string,
  generatedAt: string,
  modelVersion: string,
  sequence = 1,
): EconomicValueSnapshotId {
  return asEconomicValueSnapshotId(
    `evs_${subjectId}_${modelVersion}_${generatedAt.replace(/[:.]/g, '')}_s${String(sequence)}`,
  );
}

export function dimensionIdFor(kind: string, snapshotId: string): EconomicValueDimensionId {
  return asEconomicValueDimensionId(`evd_${kind.toLowerCase()}_${snapshotId.replace(/^evs_/, '')}`);
}

export function attributionEntryIdFor(sourceKey: string, realization: string): AttributionEntryId {
  return asAttributionEntryId(`gae_${realization.toLowerCase()}_${sourceKey}`);
}

export function attributionPeriodIdFor(from: string, to: string): AttributionPeriodId {
  return asAttributionPeriodId(`gap_${from.replace(/[:.]/g, '')}_${to.replace(/[:.]/g, '')}`);
}

export function attributionGroupIdFor(sourceKey: string): AttributionGroupId {
  return asAttributionGroupId(`gag_${sourceKey}`);
}

export function counterfactualIdFor(kind: string, key: string): CounterfactualBaselineId {
  return asCounterfactualBaselineId(`cfb_${kind.toLowerCase()}_${key}`);
}

export function dataContributionIdFor(key: string): DataContributionReferenceId {
  return asDataContributionReferenceId(`dcr_${key}`);
}
