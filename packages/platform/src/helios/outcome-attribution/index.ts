export {
  ATTRIBUTION_RESULT_KINDS,
  ATTRIBUTION_RULE_FLAGS,
  COST_BASIS_METHODS,
  FEE_CERTAINTY,
  FEE_TYPES,
  INCOME_TYPES,
  RESEARCH_COST_CLASSES,
  type AttributionResultKind,
  type CostBasisMethod,
  type FeeCertainty,
  type FeeType,
  type IncomeType,
  type ResearchCostClass,
} from './taxonomy.ts';
export type {
  CanonicalAttributionSourcePort,
  GrowIndependentOutcomeAttribution,
  GrowOutcomeEconomicEvent,
  GrowOutcomeFeeLine,
  GrowOutcomeFxContext,
  GrowOutcomeIncomeLine,
  GrowOutcomePerformanceSeriesPoint,
  GrowOutcomePositionAttribution,
  GrowOutcomeRealizedLine,
  GrowOutcomeReconciliation,
  GrowOutcomeResearchCostLine,
  GrowResearchSpendInput,
} from './types.ts';
export {
  buildIndependentGrowOutcomeAttribution,
  projectAttributionToPaperPerformance,
} from './engine.ts';
export {
  InMemoryGrowOutcomeAttributionStore,
  reconstructGrowOutcomeAttribution,
  type OutcomeAttributionStoreSnapshot,
} from './store.ts';

export const HELIOS_H25_INDEPENDENT_OUTCOME_ATTRIBUTION = 'HELIOS_H25_INDEPENDENT_OUTCOME_ATTRIBUTION' as const;
