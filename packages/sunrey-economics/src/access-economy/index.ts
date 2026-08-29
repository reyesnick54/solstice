/**
 * ACCESS-13 Access Economy simulation public surface.
 *
 * Owned by packages/sunrey-economics, the canonical economic simulation
 * laboratory. Not a second economics engine, ledger, Exchange, custody
 * system, entitlement engine, or monetary authority.
 */

export {
  ACCESS_CANONICAL_INTEGRATIONS,
  ACCESS_DECISION_OUTCOMES,
  ACCESS_ECONOMY_EVIDENCE_KINDS,
  ACCESS_ECONOMY_INVARIANT_IDS,
  ACCESS_ECONOMY_LABEL,
  ACCESS_ECONOMY_SCHEMA_VERSION,
  ACCESS_ECONOMY_TOOL_VERSION,
  ACCESS_FABRIC_QUALIFICATION_STATE,
  ACCESS_REFUSAL_OUTCOMES,
  ACCESS_SCARCITY_DIMENSIONS,
  ACCESS_SCARCITY_MODES,
  ACCESS_SHOCK_KINDS,
  ACCESS_SIM_SCENARIO_IDS,
  FORBIDDEN_ACCESS_ASSET_TOKENS,
  FORBIDDEN_ACCESS_EVIDENCE_KEYS,
  type AccessDecisionOutcome,
  type AccessEconomyEvidenceKind,
  type AccessEconomyInvariantId,
  type AccessScarcityDimension,
  type AccessScarcityMode,
  type AccessShockKind,
  type AccessSimScenarioId,
} from './ids.ts';

export type {
  AccessCapacityLedgerRow,
  AccessCapacityPool,
  AccessDecision,
  AccessDemandProfile,
  AccessEconomyQualificationReport,
  AccessEconomyScenario,
  AccessEconomyScenarioResult,
  AccessEvidenceSummary,
  AccessInvariantResult,
  AccessLegalEligibility,
  AccessPolicyChange,
  AccessPoolTemplate,
  AccessRequest,
  AccessRequestOrigin,
  SimulatedAuthorityReference,
} from './types.ts';

export {
  ACCESS_ECONOMY_CATALOG,
  accessCatalogComplete,
  accessScenarioById,
  accessScenarioIds,
} from './catalog.ts';

export { ACCESS_SIM_EPOCH_START, buildCapacityPools, buildRequests, macroReport, simInstant } from './capacity.ts';
export { allocate, type AllocationOutcome } from './allocation.ts';
export { AccessSimulationEvidence, assertSealablePayload } from './evidence.ts';
export { ACCESS_INVARIANT_STATEMENTS, checkAccessInvariants, type AccessInvariantInput } from './invariants.ts';
export { executeAccessScenario, runAccessEconomyScenario } from './engine.ts';
export {
  REMAINING_LEGAL_GATES,
  REMAINING_REAL_WORLD_PROVIDER_REQUIREMENTS,
  REMAINING_SIMULATED_DEPENDENCIES,
  qualifyAccessEconomy,
  renderAccessQualification,
} from './qualification.ts';
export { runAccessEconomyCommand } from './cli.ts';
export { runAccessEconomyDemo } from './demo.ts';
