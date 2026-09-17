import { type Brand, brandAs } from '../../../domain/src/brand.ts';

export type StrategyCapsuleId = Brand<string, 'StrategyCapsuleId'>;
export type StrategyCapsuleVersion = Brand<string, 'StrategyCapsuleVersion'>;
export type StrategyEvaluationId = Brand<string, 'StrategyEvaluationId'>;
export type EvaluationDatasetManifestId = Brand<string, 'EvaluationDatasetManifestId'>;

function asPrefixed<T extends string>(value: string, prefix: string, label: string): Brand<string, T> {
  if (!value.startsWith(prefix) || value.length <= prefix.length) {
    throw new TypeError(`${label} must start with ${prefix}`);
  }
  return brandAs<string, T>(value);
}

function asNonEmpty<T extends string>(value: string, label: string): Brand<string, T> {
  if (value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return brandAs<string, T>(value);
}

export function asStrategyCapsuleId(value: string): StrategyCapsuleId {
  return asPrefixed(value, 'scap_', 'StrategyCapsuleId');
}

export function asStrategyCapsuleVersion(value: string): StrategyCapsuleVersion {
  return asNonEmpty(value, 'StrategyCapsuleVersion');
}

export function asStrategyEvaluationId(value: string): StrategyEvaluationId {
  return asPrefixed(value, 'seval_', 'StrategyEvaluationId');
}

export function asEvaluationDatasetManifestId(value: string): EvaluationDatasetManifestId {
  return asPrefixed(value, 'edmf_', 'EvaluationDatasetManifestId');
}
