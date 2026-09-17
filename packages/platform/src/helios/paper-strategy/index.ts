export {
  HELIOS_PAPER_STRATEGY_IDS,
  PAPER_CYCLE_OUTCOMES,
  PAPER_PROPOSAL_STATES,
  PAPER_POSITION_STATUSES,
  PAPER_ATTRIBUTION_CLASSES,
  VALIDATION_REASON_CODES,
  type HeliosPaperStrategyId,
  type PaperCycleOutcome,
  type PaperProposalState,
  type PaperPositionStatus,
  type PaperAttributionClass,
  type ValidationReasonCode,
} from './taxonomy.ts';
export {
  asHeliosPaperProposalId,
  asHeliosPaperPositionId,
  asHeliosPaperCycleId,
  paperProposalIdFor,
  paperPositionIdFor,
  paperCycleIdFor,
  type HeliosPaperProposalId,
  type HeliosPaperPositionId,
  type HeliosPaperCycleId,
} from './ids.ts';
export {
  HELIOS_PAPER_FILL_METHODOLOGY_VERSION,
  type HeliosPaperResearchResult,
  type HeliosStrategyDecision,
  type HeliosPaperGrowProposal,
  type HeliosPaperFillAssumptions,
  type HeliosPaperExecutionRecord,
  type HeliosPaperPosition,
  type HeliosPaperGrowResult,
  type HeliosPaperExecutionPort,
  type HeliosPaperRiskAssessment,
  type HeliosPaperRiskPort,
  type PaperStrategyRunInput,
  type PaperStrategyCloseInput,
  type PaperStrategyValidationResult,
  type PaperStrategyStoreSnapshot,
} from './types.ts';
export {
  HELIOS_H14_REFERENCE_PRICE_ENTRY_V1,
  DEFAULT_ENTRY_THRESHOLD_MINOR,
  DEFAULT_EXIT_THRESHOLD_MINOR,
  DEFAULT_ENTRY_QUANTITY_UNITS,
  evaluateReferencePriceEntryRule,
} from './strategy-rule.ts';
export { synthesizeDeterministicResearch } from './research.ts';
export { validatePaperStrategyInputs } from './validation.ts';
export { buildHeliosPaperProposal } from './proposal.ts';
export {
  computePaperFillAssumptions,
  grossNotionalFromAssumptions,
  netNotionalFromAssumptions,
  spreadCostFromAssumptions,
  slippageCostFromAssumptions,
} from './fill-model.ts';
export { InMemoryHeliosPaperStrategyStore } from './store.ts';
export {
  sealPaperStrategyEvidence,
  sealResearchPhase,
  sealProposalPhase,
  sealExecutionPhase,
  sealPositionPhase,
  sealGrowResultPhase,
} from './evidence.ts';
export { HeliosPaperGrowStrategyService, HELIOS_H14_PAPER_GROW_STRATEGY } from './service.ts';
