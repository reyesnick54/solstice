import type { ResearchAllocationPolicy } from './types.ts';
import {
  HELIOS_EVOL13_META_EVOLUTION_BLOCKED,
  HELIOS_EVOL13_META_EVOLUTION_QUALIFIED,
} from './taxonomy.ts';

export type Evol13QualificationResult = {
  readonly ok: boolean;
  readonly marker: typeof HELIOS_EVOL13_META_EVOLUTION_QUALIFIED | typeof HELIOS_EVOL13_META_EVOLUTION_BLOCKED;
};

export function evaluateEvol13MetaEvolutionQualification(input: {
  readonly explorationBudgetBps: number;
  readonly maxOperatorShareBps: number;
}): Evol13QualificationResult {
  const explores = input.explorationBudgetBps >= 500 && input.explorationBudgetBps <= 5000;
  const caps = input.maxOperatorShareBps > 0 && input.maxOperatorShareBps < 10_000;
  const ok = explores && caps;
  return Object.freeze({
    ok,
    marker: ok ? HELIOS_EVOL13_META_EVOLUTION_QUALIFIED : HELIOS_EVOL13_META_EVOLUTION_BLOCKED,
  });
}

export function defaultEvol13ResearchAllocationPolicy(
  overrides: Partial<ResearchAllocationPolicy> = {},
): ResearchAllocationPolicy {
  return Object.freeze({
    kind: 'THOMPSON',
    explorationBudgetBps: 1500,
    maxOperatorShareBps: 8500,
    symmetricBetaPriorAlpha: 4,
    outcomeCreditDelayMs: 86_400_000,
    ucbExplorationCoefficient: 1.2,
    ...overrides,
  });
}
