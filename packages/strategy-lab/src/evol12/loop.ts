import { EVOL12_SCIENTIFIC_LOOP_STAGES, type Evol12ScientificLoopStage } from './taxonomy.ts';

const stageSet = new Set<string>(EVOL12_SCIENTIFIC_LOOP_STAGES);

/** Returns true when all EVOL12 loop stages are named exactly once (deterministic audit). */
export function assertScientificLoopDocumented(stages: readonly string[]): boolean {
  if (stages.length !== EVOL12_SCIENTIFIC_LOOP_STAGES.length) {
    return false;
  }
  const seen = new Set<string>();
  for (const s of stages) {
    if (!stageSet.has(s) || seen.has(s)) {
      return false;
    }
    seen.add(s);
  }
  return seen.size === EVOL12_SCIENTIFIC_LOOP_STAGES.length;
}

export function allEvol12LoopStages(): readonly Evol12ScientificLoopStage[] {
  return EVOL12_SCIENTIFIC_LOOP_STAGES;
}
