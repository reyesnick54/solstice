export {
  HELIOS_ALT06_PRODUCT_DEMAND_PLANE_SCHEMA,
  ALT06_FEATURE_IDS,
  ALT06_FORMULA_VERSION,
  HELIOS_ALT06_PRODUCT_DEMAND_QUALIFIED,
  HELIOS_ALT06_PRODUCT_DEMAND_BLOCKED,
  DEMAND_SUPPLY_IMBALANCE_KINDS,
  PRICING_POWER_SIGNAL_KINDS,
  type Alt06FeatureId,
  type DemandSupplyImbalanceKind,
  type PricingPowerSignalKind,
} from './taxonomy.ts';

export type {
  Alt06FeatureQuality,
  Alt06ComputedFeature,
  EmpiricalCalibrationSnapshot,
  PricingPowerSignal,
  DemandSupplyImbalanceState,
  Alt06ProductDemandFeaturePlane,
  Alt06ObservationStoreSnapshot,
} from './types.ts';

export {
  ALT06_PRODUCT_GRAPH_NODE_KINDS,
  ALT06_PRODUCT_GRAPH_EDGES,
  createAlt06ProductEntityGraph,
  type Alt06ProductGraphNode,
  type Alt06ProductGraphEdge,
  type ResolvedProductCorporateChain,
  type Alt06ProductEntityGraph,
} from './entity-graph.ts';

export { alt06DefaultEmpiricalCalibration } from './calibration.ts';
export { computeAlt06Features } from './features.ts';
export { derivePricingPowerSignal, deriveDemandSupplyImbalanceState } from './signals.ts';
export {
  Alt06ProductDemandFabric,
  createAlt06ProductDemandFabric,
  type Alt06ProductDemandFabricOptions,
} from './fabric.ts';

export {
  alt06DemoObservationBundle,
  ALT06_DEMO_SKU_CLASSIC,
  ALT06_DEMO_SKU_COMPETITOR,
  ALT06_DEMO_PRODUCT_NODE,
  alt06DemoEntityGraphNodes,
  alt06DemoEntityGraphEdges,
} from './fixtures.ts';

export {
  evaluateAlt06Qualification,
  runAlt06SelfChecks,
  type Alt06QualificationChecks,
  type Alt06QualificationResult,
} from './qualification.ts';
