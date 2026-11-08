export {
  HELIOS_ALPHA01_FORWARD_EVIDENCE_DOMAIN_SCHEMA,
  HELIOS_ALPHA01_FORWARD_EVIDENCE_DOMAIN_AUTHORITY,
  HELIOS_ALPHA01_FORWARD_EVIDENCE_DOMAIN_QUALIFIED,
  HELIOS_ALPHA01_FORWARD_EVIDENCE_DOMAIN_BLOCKED,
  FORWARD_ALPHA_EVIDENCE_LANES,
  FORWARD_ALPHA_FORWARD_ONLY_LANES,
  FORWARD_ALPHA_STATUSES,
  FORWARD_ALPHA_ARCHITECTURE_TEST_CAPABLE_STATUSES,
  FORWARD_ALPHA_SYNTHETIC_FIXTURE_FORBIDDEN_STATUSES,
  FORWARD_ALPHA_DECISION_FAILURE_CODES,
} from './taxonomy.ts';
export type {
  ForwardAlphaEvidenceLane,
  ForwardAlphaForwardOnlyLane,
  ForwardAlphaStatus,
  ForwardAlphaArchitectureTestCapableStatus,
  ForwardAlphaDecisionFailureCode,
} from './taxonomy.ts';

export {
  FORWARD_ALPHA_CAMPAIGN_SCHEMA,
  asForwardAlphaCampaignId,
  asForwardAlphaStrategyId,
  asForwardAlphaDecisionId,
  asForwardAlphaObservationId,
  asForwardAlphaOutcomeId,
  asForwardAlphaEvidenceId,
  asForwardAlphaManifestId,
  forwardAlphaDecisionMaterial,
} from './ids.ts';
export type {
  ForwardAlphaCampaignId,
  ForwardAlphaStrategyId,
  ForwardAlphaDecisionId,
  ForwardAlphaObservationId,
  ForwardAlphaOutcomeId,
  ForwardAlphaEvidenceId,
  ForwardAlphaManifestId,
} from './ids.ts';

export type {
  ForwardAlphaStrategy,
  ForwardAlphaDecision,
  ForwardAlphaObservation,
  ForwardAlphaOutcome,
  ForwardAlphaEvidence,
  ForwardAlphaCampaign,
  ForwardAlphaForwardCampaignLane,
  ForwardAlphaManifest,
  ForwardAlphaDecisionIntegrityInput,
  ForwardAlphaDecisionIntegrityResult,
  ForwardAlphaDecisionFailure,
} from './types.ts';

export {
  assertEvidenceLanesDisjoint,
  assertCannotRelabelBacktestAsForward,
  assertCannotRelabelHistoricalReplayAsForward,
  isForwardAlphaEvidenceLane,
  lanePermitsForwardDecision,
} from './lane-separation.ts';
export type { EvidenceLaneMergeViolation } from './lane-separation.ts';

export { evaluateForwardAlphaDecisionIntegrity } from './forward-requirements.ts';

export {
  digestForwardAlphaFeatureVersions,
  digestForwardAlphaMarketDataSequence,
  sealForwardAlphaDecision,
  attachForwardAlphaOutcomeRef,
} from './seal.ts';

export { buildForwardAlphaManifest, aggregateForwardAlphaEvidence } from './manifest.ts';

export {
  evaluateAlpha01ForwardEvidenceDomainEngineering,
  alpha01EngineeringQualificationChecks,
  resolveForwardAlphaStatus,
  assertArchitectureTestStatusCap,
  assertSyntheticFixtureStatusAllowed,
} from './qualification.ts';
export type {
  Alpha01EngineeringQualificationChecks,
  Alpha01QualificationResult,
  ForwardAlphaStatusResolutionInput,
} from './qualification.ts';

export { buildAlpha01FixtureCampaign, buildAlpha01FixtureStrategy, buildAlpha01SyntheticFixtureManifest } from './fixtures.ts';

export {
  FORWARD_SHADOW_ALPHA01_EVIDENCE_LANE,
  forwardShadowRunToAlpha01CampaignRef,
  projectForwardShadowDecisionToForwardAlpha,
} from './adapters/forward-shadow.ts';

export {
  FORWARD_PAPER_ALPHA01_EVIDENCE_LANE,
  paperRunToAlpha01CampaignRef,
} from './adapters/paper.ts';

export {
  HELIOS_ALPHA17_CAMPAIGN_ORCHESTRATOR_SCHEMA,
  HELIOS_ALPHA17_CAMPAIGN_ORCHESTRATOR_QUALIFIED,
  HELIOS_ALPHA17_CAMPAIGN_ORCHESTRATOR_BLOCKED,
  CAMPAIGN_RUN_STATES,
  CAMPAIGN_LOOP_PHASES,
  CAMPAIGN_TRIGGER_KINDS,
  ForwardCampaignOrchestrator,
  ForwardCampaignOrchestratorStore,
  runCampaignRuntimePass,
  evaluateAlpha17CampaignOrchestratorQualification,
  buildSimulationCampaignRuntimePorts,
  sampleAlpha17CampaignId,
  acquireCampaignLease,
  commitCampaignCheckpoint,
  restoreCampaignFromCheckpoint,
  type CampaignRunState,
  type CampaignLoopPhase,
  type CampaignTriggerKind,
  type CampaignLease,
  type CampaignCheckpoint,
  type CampaignWorkItem,
  type CampaignRunContext,
  type CampaignRuntimeTickResult,
  type CampaignOrchestratorSnapshot,
  type ForwardCampaignRuntimePorts,
  type ForwardCampaignOrchestratorPorts,
  type Alpha17CampaignOrchestratorQualificationResult,
} from './campaign-orchestrator/index.ts';
