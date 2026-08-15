/**
 * Application facade for the Personal Economic Graph.
 * Not a second graph model, ledger, or execution engine.
 */
export {
  EconomicGraphService,
  InMemoryEconomicGraphStore,
  authorizeGraphRead,
  type GraphView,
  type PersonalEconomicSnapshot,
} from '../../../packages/personal-economic-graph/src/index.ts';
