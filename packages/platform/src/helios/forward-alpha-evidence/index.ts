export {
  ALPHA_EVIDENCE_SOURCE_KINDS,
  ALPHA_WORK_PACKAGES,
  FORWARD_ALPHA_REALITY_STATUSES,
  FORWARD_EVIDENCE_PROVENANCE,
  HELIOS_FORWARD_ALPHA_EVIDENCE_SCHEMA,
  HELIOS_FORWARD_ALPHA_EVIDENCE_V1_BLOCKED,
  HELIOS_FORWARD_ALPHA_EVIDENCE_V1_QUALIFIED,
  INVESTMENT_PERFORMANCE_PROOF_STATUSES,
  type AlphaEvidenceSourceKind,
  type AlphaWorkPackageId,
  type ForwardAlphaRealityStatus,
  type ForwardEvidenceProvenance,
  type InvestmentPerformanceProofStatus,
} from './taxonomy.ts';

export type {
  AlphaRealityGateInput,
  AlphaWorkPackageRow,
  ForwardAlphaDecisionRecord,
  ForwardAlphaRealityGateResult,
  PreRegisteredStatisticalPolicy,
} from './types.ts';

export {
  AlphaRealityGate,
  architectureMarkerImpliesAlphaProven,
  defaultSimulationRealityGateInput,
  resolveAlphaRealityGate,
} from './reality-gate.ts';

export {
  clampRealityStatusForSourceKind,
  isInvestmentPerformanceProofStatus,
  sourceKindForbiddenForPerformanceProof,
} from './synthetic-guard.ts';

export {
  alphaWorkPackageBlockers,
  alphaWorkPackagesQualified,
  buildAlphaWorkPackageRegistry,
} from './work-package-registry.ts';

export { assertForwardAlphaProductionPosture } from './production-posture.ts';

export {
  evaluateForwardAlphaEvidenceQualification,
  type ForwardAlphaEvidenceQualificationInput,
  type ForwardAlphaEvidenceQualificationResult,
} from './alpha15-qualification.ts';

export { HELIOS_ALPHA01_EVIDENCE_DOMAIN } from './alpha01-evidence-domain.ts';
export { HELIOS_ALPHA02_PRE_REGISTRATION } from './alpha02-pre-registration.ts';
export { HELIOS_ALPHA03_PREQUENTIAL_EVALUATION } from './alpha03-prequential-evaluation.ts';
export { HELIOS_ALPHA04_SHADOW_CAPITAL } from './alpha04-shadow-capital.ts';
export { HELIOS_ALPHA05_BENCHMARK_ATTRIBUTION } from './alpha05-benchmark-attribution.ts';
export { HELIOS_ALPHA06_EXECUTION_REALISM } from './alpha06-execution-realism.ts';
export { HELIOS_ALPHA07_SEQUENTIAL_INFERENCE } from './alpha07-sequential-inference.ts';
export { HELIOS_ALPHA08_MULTIPLE_TESTING_FIREWALL } from './alpha08-multiple-testing-firewall.ts';
export { HELIOS_ALPHA09_RISK_TAIL } from './alpha09-risk-tail-metrics.ts';
export { HELIOS_ALPHA10_REGIME_ROBUSTNESS } from './alpha10-regime-robustness.ts';
export { HELIOS_ALPHA11_DECAY_DETECTION } from './alpha11-decay-detection.ts';
export { HELIOS_ALPHA12_CAPACITY } from './alpha12-capacity.ts';
export { HELIOS_ALPHA13_PORTFOLIO_EVIDENCE } from './alpha13-portfolio-evidence.ts';
export { HELIOS_ALPHA14_EVIDENCE_COMMITTEE } from './alpha14-evidence-committee.ts';
