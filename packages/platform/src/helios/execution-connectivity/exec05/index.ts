export {
  EXEC05_SCHEMA,
  ROUTING_SELECTION_MODES,
  ROUTING_SCORE_COMPONENTS,
  ORDER_URGENCY_LEVELS,
  VENUE_HEALTH_STATES,
  ROUTING_DECISION_OUTCOMES,
  PROHIBITED_SOLE_REASONS,
  type RoutingSelectionMode,
  type RoutingScoreComponent,
  type OrderUrgencyLevel,
  type Exec05VenueHealthState,
  type RoutingDecisionOutcome,
  type ProhibitedSoleSelectionReason,
} from './taxonomy.ts';

export type {
  ExecutionVenueCandidate,
  DirectedOrderInstruction,
  ExecutionQualityEstimate,
  RoutingScorecard,
  RoutingScoreComponentContribution,
  SmartRoutingRequest,
  RoutingDecision,
  VenuePeriodicMetrics,
  BestExecutionEvidence,
} from './types.ts';

export {
  asSmartRoutingDecisionId,
  smartRoutingDecisionIdFor,
  bestExecutionEvidenceIdFor,
  type SmartRoutingDecisionId,
} from './ids.ts';

export { buildExecutionQualityEstimate, buildRoutingScorecard } from './scorecard.ts';
export { SmartOrderRouter } from './router.ts';
export { generateBestExecutionEvidence, type RouteReviewObservation } from './route-review.ts';
export { EXEC05_SANDBOX_VENUE_CANDIDATES } from './fixtures.ts';

export {
  HELIOS_EXEC05_SMART_ROUTING_QUALIFIED,
  HELIOS_EXEC05_SMART_ROUTING_BLOCKED,
  evaluateExec05SmartRoutingQualification,
  type Exec05QualificationChecks,
} from './qualification.ts';
