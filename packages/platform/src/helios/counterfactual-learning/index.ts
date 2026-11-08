/**
 * HELIOS counterfactual learning — exports by milestone.
 */

export * from './cf04/index.ts';
export * from './cf05/index.ts';
export * from './cf06-distributional-ope/index.ts';
export * from './cf07-sequential-ope/index.ts';
export * from './cf09/index.ts';

export {
  CF_WORK_PACKAGES,
  COUNTERFACTUAL_ACTION_CLASSES,
  HELIOS_CF01_DECISION_LEDGER_BLOCKED,
  HELIOS_CF01_DECISION_LEDGER_QUALIFIED,
  HELIOS_CF01_DECISION_LEDGER_SCHEMA,
  HELIOS_CF03_POLICY_PROPENSITY_QUALIFIED,
  HELIOS_COUNTERFACTUAL_LEARNING_AUTHORITY,
  HELIOS_COUNTERFACTUAL_LEARNING_PROGRAM_SCHEMA,
  HELIOS_COUNTERFACTUAL_LEARNING_SCHEMA_VERSION,
  HELIOS_COUNTERFACTUAL_LEARNING_V1_BLOCKED,
  HELIOS_COUNTERFACTUAL_LEARNING_V1_QUALIFIED,
  POLICY_SUPPORT_STATES,
  STOCHASTIC_POLICY_ENVIRONMENTS,
  type CfWorkPackageId,
  type CounterfactualActionClass,
  type PolicySupportState,
  type StochasticPolicyEnvironment,
} from './taxonomy.ts';

export {
  digestCandidateActionSetContent,
  digestDecisionContext,
  sealDecisionEpisode,
} from './seal.ts';
export { evaluateCf01DecisionLedgerQualification, type Cf01QualificationResult } from './qualification-cf01.ts';

export { asBehaviorPolicySnapshotId, type BehaviorPolicySnapshotId } from './ids.ts';
export type {
  ActionPropensityMass,
  BehaviorPolicySnapshot,
  CandidateAction,
  CandidateActionSet,
  CounterfactualOutcomeAttachment,
  CounterfactualOutcomeKind,
  CounterfactualResearchManifest,
  DecisionContext,
  DecisionEpisode,
  DecisionEpisodeSeal,
  DecisionEvidenceSnapshot,
  DecisionPolicySnapshot,
  DecisionReason,
  DecisionReasonCode,
  DeterministicBehaviorPolicySnapshot,
  EarningsStateAtDecision,
  EffectiveSampleSize,
  ImportanceWeightDiagnostics,
  KLDivergenceDiagnostic,
  LiquidityStateAtDecision,
  MarketStateAtDecision,
  ObservedAction,
  OverlapAssessment,
  PolicySupportStateGate,
  PortfolioStateAtDecision,
  ProbabilityRational,
  PropensityExtremes,
  RejectedAction,
  RegimeStateAtDecision,
  RiskStateAtDecision,
  StochasticBehaviorPolicySnapshot,
  StrategyGenomeRef,
  TwinBindingRef,
  ValuationStateAtDecision,
} from './types.ts';
export {
  buildDeterministicBehaviorPolicySnapshot,
  buildStochasticBehaviorPolicySnapshot,
  behaviorPolicyProbabilities,
} from './build-snapshot.ts';
export { assessOverlapForOpe, klForwardNaturalLog } from './overlap-assessment.ts';
export { evaluateCf03PolicyPropensityQualification, type Cf03PolicyPropensityQualification } from './qualification.ts';

export { listCfWorkPackages, type CfWorkPackageRow } from './work-package-registry.ts';
export {
  evaluateCounterfactualLearningQualification,
  type CounterfactualLearningQualificationInput,
  type CounterfactualLearningQualificationResult,
} from './cf14-qualification.ts';

export { HELIOS_CF01_DECISION_LEDGER } from './cf01-decision-ledger.ts';
export { HELIOS_CF02_REJECTED_OPPORTUNITY_SHADOW_BOOK } from './cf02-rejected-opportunity-shadow-book.ts';
export { HELIOS_CF03_BEHAVIOR_POLICY_PROPENSITY } from './cf03-behavior-policy-propensity.ts';
export { HELIOS_CF10_DECISION_ATTRIBUTION } from './cf10-decision-attribution.ts';
export { HELIOS_CF11_CONSERVATIVE_POLICY_IMPROVEMENT } from './cf11-conservative-policy-improvement.ts';
export {
  HELIOS_ALPHA01_CF_FORWARD_EVIDENCE_BRIDGE_SCHEMA,
  toAlpha01CounterfactualForwardEvidenceRef,
  type Alpha01CounterfactualForwardEvidenceRef,
} from './alpha01-forward-evidence-bridge.ts';
export { HELIOS_CF12_EVOLUTION_MEMORY } from './cf12-evolution-memory.ts';
export { HELIOS_CF13_AGENT_COMMITTEE } from './cf13-agent-committee.ts';
