import { type Brand, brandAs } from '@solstice/domain';

export type StrategyEvolutionPopulationId = Brand<string, 'StrategyEvolutionPopulationId'>;
export type StrategyEvolutionTrialId = Brand<string, 'StrategyEvolutionTrialId'>;
export type StrategyEvolutionGenerationId = Brand<string, 'StrategyEvolutionGenerationId'>;
export type StrategyGeneAttributionId = Brand<string, 'StrategyGeneAttributionId'>;

function asPrefixed<T extends string>(value: string, prefix: string, label: string): Brand<string, T> {
  if (!value.startsWith(prefix) || value.length <= prefix.length) {
    throw new TypeError(`${label} must start with ${prefix}`);
  }
  return brandAs<string, T>(value);
}

export function asStrategyEvolutionPopulationId(value: string): StrategyEvolutionPopulationId {
  return asPrefixed(value, 'sepop_', 'StrategyEvolutionPopulationId');
}

export function asStrategyEvolutionTrialId(value: string): StrategyEvolutionTrialId {
  return asPrefixed(value, 'sevt_', 'StrategyEvolutionTrialId');
}

export function asStrategyEvolutionGenerationId(value: string): StrategyEvolutionGenerationId {
  return asPrefixed(value, 'segen_', 'StrategyEvolutionGenerationId');
}

export function asStrategyGeneAttributionId(value: string): StrategyGeneAttributionId {
  return asPrefixed(value, 'sgattr_', 'StrategyGeneAttributionId');
}
