/**
 * ACCESS-16 — Access Capacity Reserve and Solvency Engine exports.
 */

export {
  ACCESS_SOLVENCY_SCHEMA,
  ACCESS_SOLVENCY_CHUNK,
  CAPACITY_TRANCHE_KINDS,
  SETTLEMENT_LIABILITY_STATES,
  RESERVE_POSITION_STATES,
  CONSUMER_AVAILABILITY_POSTURES,
  SOLVENCY_DIMENSIONS,
  RISK_HAIRCUT_KINDS,
  isExternalFundedTranche,
  isNativeTranche,
  type CapacityTrancheKind,
  type SettlementLiabilityState,
  type ReservePositionState,
  type ConsumerAvailabilityPosture,
  type SolvencyDimension,
  type RiskHaircutKind,
} from './taxonomy.ts';

export type {
  AccessCapacityTranche,
  AccessCapacityPoolWithTranches,
  ProviderSettlementLiability,
  SettlementReservePosition,
  SolvencySlice,
  RiskHaircutPolicy,
  EffectiveCapacityInput,
  EffectiveCapacityResult,
  PoolAdmissionInput,
  PoolAdmissionResult,
  ConsumerAvailabilityInput,
  ConsumerAvailabilityView,
  SolvencyEngineSnapshot,
} from './types.ts';

export {
  CANONICAL_RESERVE_OWNERS,
  aggregateReservePositions,
  InMemorySettlementReservePort,
  createSimulationSolvencyPorts,
  type CanonicalReserveOwner,
  type SettlementReserveReadPort,
  type LedgerReservePort,
  type TreasuryReservePort,
  type CustodyReservePort,
  type PaymentsReservePort,
  type ExchangeReservePort,
  type SolvencyPorts,
} from './ports.ts';

export { applyRiskHaircuts, simulationHaircutPolicy } from './haircuts.ts';
export { evaluatePoolAdmission } from './admission.ts';

export {
  canTransitionLiability,
  transitionLiability,
  createQuotedLiability,
  isActiveLiability,
  isConfirmedLiability,
  allLiabilityStates,
} from './liability-lifecycle.ts';

export {
  computeSolvencySlices,
  buildSolvencySnapshot,
  canFundExternalLiability,
  poolBackedUnits,
  nativeTrancheUnits,
  externalTrancheUnits,
  projectConsumerAvailability,
  AccessSolvencyEngine,
  type SolvencyPolicy,
  type SolvencyEngineInput,
} from './engine.ts';

export {
  ACCESS_SOLVENCY_INVARIANT_IDS,
  ACCESS_SOLVENCY_INVARIANT_STATEMENTS,
  checkSolvencyInvariants,
  type AccessSolvencyInvariantId,
  type SolvencyInvariantResult,
  type SolvencyInvariantInput,
} from './invariants.ts';

export {
  runStressScenario,
  runAllStressScenarios,
  ACCESS_16_STRESS_SCENARIOS,
  type StressScenarioId,
  type StressScenarioResult,
  type StressHarnessInput,
} from './stress.ts';
