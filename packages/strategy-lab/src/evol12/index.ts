import { STRATEGY_SCIENTIST_AGENT_ROLE } from './taxonomy.ts';

export {
  STRATEGY_SCIENTIST_AGENT_ROLE,
  STRATEGY_SCIENTIST_GENOME_PROPOSAL_SCHEMA,
  HELIOS_EVOL12_STRATEGY_SCIENTIST_QUALIFIED,
  HELIOS_EVOL12_STRATEGY_SCIENTIST_BLOCKED,
  EVOL12_SCIENTIFIC_LOOP_STAGES,
} from './taxonomy.ts';
export type { Evol12ScientificLoopStage } from './taxonomy.ts';

export type {
  StrategyScientistAgent,
  StrategyRationale,
  ResearchHypothesis,
  MutationProposal,
  CrossoverProposal,
  NewFeatureHypothesis,
  GenomeProposalMechanism,
  GenomeProposalNoveltyMode,
  GenomeProposal,
  FailedStrategySummary,
  SuccessfulStrategySummary,
  OperatorProductivityRow,
  NicheMapEntry,
  ResearchGap,
  StrategyScientistResearchMemory,
  Evol12QualificationChecks,
  Evol12QualificationResult,
} from './types.ts';

export {
  validateGenomeProposal,
  evaluateEvol12StrategyScientistQualification,
} from './validate.ts';
export type { GenomeProposalValidationFailure } from './validate.ts';

export {
  checkNoveltyAgainstArchive,
  refinementParentHashesFromProposal,
} from './novelty.ts';
export type { NoveltyGateFailure } from './novelty.ts';

export { assertScientificLoopDocumented, allEvol12LoopStages } from './loop.ts';

export { buildEvol12SampleGenomeProposal } from './fixtures.ts';

export function buildStrategyScientistAgent(agentRef: string): import('./types.ts').StrategyScientistAgent {
  if (!agentRef.startsWith('agent/')) {
    throw new TypeError('StrategyScientist agentRef must start with agent/');
  }
  return Object.freeze({
    role: STRATEGY_SCIENTIST_AGENT_ROLE,
    agentRef,
  });
}
