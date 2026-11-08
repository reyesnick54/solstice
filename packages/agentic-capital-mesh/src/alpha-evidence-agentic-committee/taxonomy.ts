export const ALPHA_EVIDENCE_COMMITTEE_SCHEMA =
  'sunrey.helios.alpha14.agentic-alpha-evidence-committee.v1' as const;

export const HELIOS_ALPHA14_AGENTIC_EVIDENCE_COMMITTEE =
  'HELIOS_ALPHA14_AGENTIC_EVIDENCE_COMMITTEE' as const;
export const HELIOS_ALPHA14_AGENTIC_EVIDENCE_COMMITTEE_QUALIFIED =
  'HELIOS_ALPHA14_AGENTIC_EVIDENCE_COMMITTEE_QUALIFIED' as const;
export const HELIOS_ALPHA14_AGENTIC_EVIDENCE_COMMITTEE_BLOCKED =
  'HELIOS_ALPHA14_AGENTIC_EVIDENCE_COMMITTEE_BLOCKED' as const;

/** Committee interrogates performance claims before any evidence status upgrade. */
export const ALPHA14_EVIDENCE_QUESTIONS = Object.freeze([
  'Is the performance real?',
  'Is it benchmark-relative?',
  'Is it concentrated?',
  'Is it dependent on one regime?',
  'Did execution assumptions create it?',
  'Did transaction costs erase it?',
  'Was the strategy selected from too many trials?',
  'Is the evidence duration sufficient?',
  'Is the edge scalable?',
  'Has it already begun decaying?',
] as const);

/** Skeptic roles must stress these rejection vectors (non-exhaustive). */
export const SKEPTIC_ALPHA14_ATTACK_VECTORS = Object.freeze([
  'in-sample overfit',
  'benchmark mismatch',
  'survivorship in universe',
  'lookahead or leakage',
  'cost model too optimistic',
  'fill model too optimistic',
  'single-regime dominance',
  'capacity cliff',
  'multiple-testing inflation',
  'short sample window',
  'alpha decay trend',
  'data snooping',
] as const);

export const ALPHA14_COMMITTEE_ROLES = [
  'FORWARD_PERFORMANCE',
  'BENCHMARK',
  'STATISTICAL_SKEPTIC',
  'MULTIPLE_TESTING_AUDITOR',
  'EXECUTION_REALITY',
  'REGIME_ROBUSTNESS',
  'CAPACITY',
  'DATA_INTEGRITY',
  'ALPHA_DECAY',
  'COUNTERFACTUAL_SKEPTIC',
  'ALPHA_EVIDENCE_SYNTHESIS',
] as const;

export type Alpha14CommitteeRole = (typeof ALPHA14_COMMITTEE_ROLES)[number];

export const ALPHA14_SKEPTIC_ROLES = Object.freeze([
  'STATISTICAL_SKEPTIC',
  'MULTIPLE_TESTING_AUDITOR',
  'COUNTERFACTUAL_SKEPTIC',
] as const satisfies readonly Alpha14CommitteeRole[]);

export const ALPHA14_COMMITTEE_PHASES = [
  'EVIDENCE_FREEZE',
  'CLAIM_ENVELOPE',
  'PERFORMANCE_AND_BENCHMARK',
  'STATISTICAL_SCRUTINY',
  'IMPLEMENTATION_AND_DATA',
  'REGIME_CAPACITY_DECAY',
  'ADVERSARIAL_SKEPTIC_PASS',
  'SYNTHESIS',
] as const;

export type Alpha14CommitteePhase = (typeof ALPHA14_COMMITTEE_PHASES)[number];

export const ALPHA14_COMMITTEE_AGENT_NAMES: Readonly<Record<Alpha14CommitteeRole, string>> =
  Object.freeze({
    FORWARD_PERFORMANCE: 'ForwardPerformanceAnalyst',
    BENCHMARK: 'BenchmarkAnalyst',
    STATISTICAL_SKEPTIC: 'StatisticalSkepticAgent',
    MULTIPLE_TESTING_AUDITOR: 'MultipleTestingAuditor',
    EXECUTION_REALITY: 'ExecutionRealityAgent',
    REGIME_ROBUSTNESS: 'RegimeRobustnessAgent',
    CAPACITY: 'CapacityAgent',
    DATA_INTEGRITY: 'DataIntegrityAgent',
    ALPHA_DECAY: 'AlphaDecayAgent',
    COUNTERFACTUAL_SKEPTIC: 'CounterfactualSkepticAgent',
    ALPHA_EVIDENCE_SYNTHESIS: 'AlphaEvidenceSynthesisAgent',
  });

/** Agents may not perform these actions (enforced in artifact validation and qualification scan). */
export const ALPHA14_FORBIDDEN_AGENT_ACTIONS = Object.freeze([
  'change statistical thresholds',
  'waive evidence requirements',
  'promote themselves',
  'activate capital',
  'upgrade evidence status unilaterally',
] as const);
