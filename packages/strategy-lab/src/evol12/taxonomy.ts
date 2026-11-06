/**
 * HELIOS EVOL12 — LLM-guided evolutionary strategy scientist (typed contracts only).
 */

export const STRATEGY_SCIENTIST_AGENT_ROLE = 'STRATEGY_SCIENTIST' as const;

export const STRATEGY_SCIENTIST_GENOME_PROPOSAL_SCHEMA =
  'sunrey.helios.evol12.strategy-scientist-genome-proposal.v1' as const;

export const HELIOS_EVOL12_STRATEGY_SCIENTIST_QUALIFIED =
  'HELIOS_EVOL12_STRATEGY_SCIENTIST_QUALIFIED' as const;

export const HELIOS_EVOL12_STRATEGY_SCIENTIST_BLOCKED = 'HELIOS_EVOL12_STRATEGY_SCIENTIST_BLOCKED' as const;

export const EVOL12_SCIENTIFIC_LOOP_STAGES = Object.freeze([
  'HYPOTHESIS',
  'GENOME_PROPOSAL',
  'STATIC_VALIDATION',
  'AAF_DATASET',
  'CONTROLLED_EVALUATION',
  'FALSIFICATION',
  'ARCHIVE',
  'LEARNING_SUMMARY',
] as const);

export type Evol12ScientificLoopStage = (typeof EVOL12_SCIENTIFIC_LOOP_STAGES)[number];
