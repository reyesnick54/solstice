import { type Brand, brandAs } from '@solstice/domain';

export type StrategyGenomeId = Brand<string, 'StrategyGenomeId'>;
export type StrategyGenomeVersion = Brand<string, 'StrategyGenomeVersion'>;

export function asStrategyGenomeId(value: string): StrategyGenomeId {
  if (!value.startsWith('sgnm_') || value.length <= 'sgnm_'.length) {
    throw new TypeError('StrategyGenomeId must start with sgnm_');
  }
  return brandAs<string, 'StrategyGenomeId'>(value);
}

export function asStrategyGenomeVersion(value: string): StrategyGenomeVersion {
  if (value.length === 0) {
    throw new TypeError('StrategyGenomeVersion must be a non-empty string');
  }
  return brandAs<string, 'StrategyGenomeVersion'>(value);
}

export const STRATEGY_GENOME_SCHEMA = 'helios.strategy-genome.v1' as const;
