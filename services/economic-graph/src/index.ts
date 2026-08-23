/**
 * Application facade for the Personal Economic Graph.
 * Not a second graph model, ledger, or execution engine.
 */
export {
  EconomicGraphService,
  InMemoryEconomicGraphStore,
  PegUpdatePipeline,
  applyPersonaSeed,
  PEG_PERSONA_SEEDS,
  PEG_PERSONAS_ARE_SIMULATION_ONLY,
  authorizeGraphRead,
  asEconomicNodeId,
  type DeclaredGoalInput,
  type FinancialIntelligenceSnapshot,
  type GoalKind,
  type GoalStatus,
  type GraphView,
  type GrowProfileView,
  type PegPersonaId,
  type PersonalEconomicSnapshot,
  type SnapshotPresentationValuation,
  type SnapshotValuationPort,
} from '../../../packages/personal-economic-graph/src/index.ts';
