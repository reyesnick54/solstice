export {
  HELIOS_EVOL13_STRATEGY_EVOLUTION_SCHEMA,
  HELIOS_EVOL13_META_EVOLUTION_QUALIFIED,
  HELIOS_EVOL13_META_EVOLUTION_BLOCKED,
  RESEARCH_STRATEGY_NICHES,
  STRATEGY_EVOLUTION_OPERATORS,
  EVOL13_ALLOCATION_POLICIES,
  type ResearchStrategyNiche,
  type StrategyEvolutionOperatorId,
  type Evol13AllocationPolicyKind,
} from './taxonomy.ts';

export type {
  OperatorEvolutionRunEvent,
  OperatorPerformanceLedger,
  OperatorCreditState,
  NicheOperatorPerformance,
  ResearchAllocationPolicy,
  ResearchComputeAllocation,
  H20Evol13ProductivityFactor,
} from './types.ts';

export { createInMemoryOperatorPerformanceLedger } from './ledger.ts';

export {
  buildOperatorCreditState,
  buildNicheOperatorPerformance,
  operatorProductivityScoreBps,
  bridgeH20MarginalCostWithOperatorProductivity,
} from './credit.ts';

export { allocateResearchCompute, maxOperatorAllocationShareBps } from './allocation.ts';

export {
  evaluateEvol13MetaEvolutionQualification,
  defaultEvol13ResearchAllocationPolicy,
  type Evol13QualificationResult,
} from './qualification.ts';

export { sampleBeta, sampleGamma, betaPosteriorMean } from './stats.ts';
