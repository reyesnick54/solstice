import { type Brand, brandAs } from '@solstice/domain';

export type Native06StrategyGenomeId = Brand<string, 'Native06StrategyGenomeId'>;
export type Native06StrategyGenomeVersion = Brand<string, 'Native06StrategyGenomeVersion'>;

export function asNative06StrategyGenomeId(value: string): Native06StrategyGenomeId {
  if (!value.startsWith('sgnm_') || value.length <= 'sgnm_'.length) {
    throw new TypeError('Native06StrategyGenomeId must start with sgnm_');
  }
  return brandAs<string, 'Native06StrategyGenomeId'>(value);
}

export function asNative06StrategyGenomeVersion(value: string): Native06StrategyGenomeVersion {
  if (value.length === 0) {
    throw new TypeError('Native06StrategyGenomeVersion must be a non-empty string');
  }
  return brandAs<string, 'Native06StrategyGenomeVersion'>(value);
}

export const NATIVE06_STRATEGY_GENOME_SCHEMA = 'helios.strategy-genome.bytex-native.v1' as const;

export const BYTEX_STRATEGY_DOCUMENT_SCHEMA_VERSION = '2.0' as const;
