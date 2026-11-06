/**
 * HELIOS counterfactual learning — exports by milestone.
 */

export * from './cf04/index.ts';
export * from './cf05/index.ts';
export * from './cf06-distributional-ope/index.ts';
export * from './cf09/index.ts';

export {
  HELIOS_COUNTERFACTUAL_LEARNING_SCHEMA_VERSION,
  HELIOS_CF03_POLICY_PROPENSITY_QUALIFIED,
  STOCHASTIC_POLICY_ENVIRONMENTS,
  HELIOS_COUNTERFACTUAL_LEARNING_SCHEMA,
  HELIOS_COUNTERFACTUAL_LEARNING_AUTHORITY,
  HELIOS_COUNTERFACTUAL_LEARNING_V1_QUALIFIED,
  HELIOS_COUNTERFACTUAL_LEARNING_V1_BLOCKED,
  CF_WORK_PACKAGES,
  type PolicySupportState,
  type StochasticPolicyEnvironment,
  type CfWorkPackageId,
} from './taxonomy.ts';

export { asBehaviorPolicySnapshotId, type BehaviorPolicySnapshotId } from './ids.ts';
export type {
  ActionPropensityMass,
  BehaviorPolicySnapshot,
  DeterministicBehaviorPolicySnapshot,
  EffectiveSampleSize,
  ImportanceWeightDiagnostics,
  KLDivergenceDiagnostic,
  OverlapAssessment,
  PolicySupportStateGate,
  ProbabilityRational,
  PropensityExtremes,
  StochasticBehaviorPolicySnapshot,
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
export { HELIOS_CF07_SEQUENTIAL_OPE } from './cf07-sequential-ope.ts';
export { HELIOS_CF10_DECISION_ATTRIBUTION } from './cf10-decision-attribution.ts';
export { HELIOS_CF11_CONSERVATIVE_POLICY_IMPROVEMENT } from './cf11-conservative-policy-improvement.ts';
export { HELIOS_CF12_EVOLUTION_MEMORY } from './cf12-evolution-memory.ts';
export { HELIOS_CF13_AGENT_COMMITTEE } from './cf13-agent-committee.ts';
