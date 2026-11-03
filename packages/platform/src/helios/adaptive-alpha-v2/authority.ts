import type { AdaptiveAlphaFailure, AdaptiveAlphaGateVerdict } from './types.ts';

export type AdaptiveAlphaActorKind = 'HUMAN_REVIEWER' | 'QUALIFICATION_SERVICE' | 'AGENT' | 'GENOME_MUTATOR';

/** Agents and Strategy Genome mutators may not waive AAF failures or change thresholds. */
export function assertAdaptiveAlphaActorMayCertify(actorKind: AdaptiveAlphaActorKind): AdaptiveAlphaFailure | null {
  if (actorKind === 'AGENT' || actorKind === 'GENOME_MUTATOR') {
    return Object.freeze({
      code: 'AAF_AGENT_SELF_QUALIFY_FORBIDDEN',
      message: 'AI agents and Strategy Genome mutation systems cannot mark strategies AAF-qualified',
      gate: 'REPRODUCIBILITY',
      severity: 'BLOCKING',
    });
  }
  return null;
}

export function rejectAgentWaiveOfGate(input: {
  readonly actorKind: AdaptiveAlphaActorKind;
  readonly verdict: AdaptiveAlphaGateVerdict;
}): AdaptiveAlphaFailure | null {
  if (input.verdict.status !== 'FAIL') {
    return null;
  }
  if (input.actorKind === 'AGENT' || input.actorKind === 'GENOME_MUTATOR') {
    return Object.freeze({
      code: 'AAF_AGENT_WAIVE_FORBIDDEN',
      message: `Actor may not waive mandatory gate failure: ${input.verdict.gate}`,
      gate: input.verdict.gate,
      severity: 'BLOCKING',
    });
  }
  return null;
}
