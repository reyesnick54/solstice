export { CANONICAL_ACCESS_FABRIC, ACCESS_FABRIC_CHUNK, ACCESS_FABRIC_INVARIANTS, ACCESS_FABRIC_SCHEMA } from './fabric.ts';

export {
  ACCESS_PRODUCTIVE_CAPACITY_CHUNK,
  CAPACITY_FRESHNESS_STATES,
  CAPACITY_QUERY_KINDS,
  CAPACITY_REJECTION_CODES,
  CAPACITY_SLICE_SCHEMA,
  CAPACITY_SOURCE_CLASSES,
  CAPACITY_VERIFICATION_STATUSES,
  SERVICE_QUALITY_CLASSES,
  SIMULATION_FIXTURE_PREFIX,
  SIMULATION_OPERATOR_PREFIX,
  SIMULATION_PROVENANCE_PREFIX,
  type CapacityFreshnessState,
  type CapacityQueryKind,
  type CapacityRejectionCode,
  type CapacitySourceClass,
  type CapacityVerificationStatus,
  type ServiceQualityClass,
} from './productive-capacity/taxonomy.ts';

export type {
  CapacityFreshness,
  CapacityProvenanceRef,
  CapacityQueryFailure,
  CapacityQueryOutcome,
  CapacityRightsRestriction,
  CapacitySlice,
  CapacitySliceQuery,
  CapacitySliceQueryResult,
  CapacityUtilization,
  ProductiveCapacityPortSnapshot,
  UtilizationQuery,
  UtilizationQueryOutcome,
  UtilizationQueryResult,
} from './productive-capacity/types.ts';

export { assertReadOnlyPort, type ProductiveCapacityPort } from './productive-capacity/port.ts';

export {
  assessFreshness,
  filterCapacitySlices,
  hasProvenance,
  isExhausted,
  isStaleFreshness,
  matchesGeography,
  sortSlicesByAvailability,
  validateQueryWindow,
  validateSliceCapacity,
  windowsOverlap,
} from './productive-capacity/query.ts';

export {
  AIRLINE_TRANSPORT_SLICE,
  ENERGY_CAPACITY_SLICE,
  EXHAUSTED_VEHICLE_SLICE,
  FORD_MUSTANG_MIAMI_SLICE,
  FOOD_CAPACITY_SLICE,
  GPU_COMPUTE_SLICE,
  HOTEL_TOKYO_OCTOBER_SLICE,
  MARKETING_UNPROVENANCED_SLICE,
  ROBOT_HOUR_SLICE,
  SIMULATION_CAPACITY_FIXTURES,
  SIMULATION_NOW_UNIX_SECONDS,
  STALE_GPU_SLICE,
  ZERO_CAPACITY_SLICE,
  simulationCapacityFixtures,
} from './productive-capacity/fixtures.ts';

export {
  createSimulationProductiveCapacityAdapter,
  SimulationProductiveCapacityAdapter,
} from './productive-capacity/simulation-adapter.ts';

export {
  CanonicalProductiveCapacityAdapter,
  projectCanonicalCapacitySlices,
  type CanonicalProductiveCapacitySources,
} from './productive-capacity/canonical-adapter.ts';

export {
  createProductiveCapacityDiscovery,
  ProductiveCapacityDiscovery,
} from './productive-capacity/service.ts';
