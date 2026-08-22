/**
 * Application facade for the Personal Economic Graph.
 * Not a second graph model, ledger, or execution engine.
 */
export {
  EconomicGraphService,
  InMemoryEconomicGraphStore,
  PegUpdatePipeline,
  applyPersonaSeed,
  authorizeGraphRead,
  type FinancialIntelligenceSnapshot,
  type GraphView,
  type GrowProfileView,
  type PersonalEconomicSnapshot,
} from '../../../packages/personal-economic-graph/src/index.ts';
