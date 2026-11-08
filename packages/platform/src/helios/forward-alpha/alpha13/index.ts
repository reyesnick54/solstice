export {
  HELIOS_ALPHA13_PORTFOLIO_FORWARD_EVIDENCE_SCHEMA,
  STRATEGY_INTERACTION_KINDS,
  ALPHA_BREADTH_CLASSIFICATIONS,
  HELIOS_ALPHA13_PORTFOLIO_FORWARD_EVIDENCE_QUALIFIED,
  HELIOS_ALPHA13_PORTFOLIO_FORWARD_EVIDENCE_BLOCKED,
  type StrategyInteractionKind,
  type AlphaBreadthClassification,
} from './taxonomy.ts';

export type {
  ForwardStrategyLeg,
  ForwardStrategyPortfolio,
  PortfolioCapitalAllocation,
  StrategyCapitalDeployment,
  StrategyPositionLeg,
  CombinedInstrumentExposure,
  StrategyInteractionRecord,
  StrategyInteractionState,
  StrategyAttributionSlice,
  PortfolioForwardEvidence,
  AlphaBreadth,
} from './types.ts';

export { createForwardStrategyPortfolio } from './portfolio.ts';
export {
  buildPortfolioCapitalAllocation,
  assertNoCapitalDoubleCount,
  type PortfolioAllocationPolicy,
} from './allocation.ts';
export { buildStrategyInteractionState } from './interaction.ts';
export { buildPortfolioForwardEvidence } from './metrics.ts';
export { computeAlphaBreadth } from './alpha-breadth.ts';
export {
  evaluateAlpha13PortfolioForwardEvidenceQualification,
  defaultAlpha13QualificationPolicy,
  alpha13PortfolioForwardEvidenceMarker,
  type Alpha13QualificationPolicy,
  type Alpha13QualificationResult,
} from './qualification.ts';
export { runAlpha13PortfolioForwardEvidencePipeline } from './pipeline.ts';
export { alpha13DiversifiedLegs, alpha13OverlappingAaplLegs } from './fixtures.ts';
