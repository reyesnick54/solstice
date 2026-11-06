import type { UtcInstant } from '../imports.ts';
import type { EvidenceReference } from '../research-mesh/types.ts';

/** HELIOS CF13 — Agentic counterfactual research committee (simulation-only). */
export const COUNTERFACTUAL_CF13_SCHEMA = 'sunrey.helios.cf13.counterfactual-research.v1' as const;

export const COUNTERFACTUAL_CF13_ROLES = [
  'COUNTERFACTUAL_POLICY',
  'OUTCOME_MODEL',
  'PROPENSITY_SUPPORT',
  'EXECUTION_REALITY',
  'CAUSAL_INFERENCE',
  'PORTFOLIO_PATH',
  'RISK_COUNTERFACTUAL',
  'SKEPTIC',
  'COUNTERFACTUAL_SYNTHESIS',
] as const;

export type CounterfactualCf13Role = (typeof COUNTERFACTUAL_CF13_ROLES)[number];

export const COUNTERFACTUAL_CF13_PHASES = [
  'POLICY_AND_FRAME',
  'OUTCOME_AND_PROPENSITY',
  'EXECUTION_AND_PATH',
  'CAUSAL_AND_RISK',
  'ADVERSARIAL_REVIEW',
  'SYNTHESIS',
] as const;

export type CounterfactualCf13Phase = (typeof COUNTERFACTUAL_CF13_PHASES)[number];

/** Standard counterfactual questions interrogated by the committee. */
export const COUNTERFACTUAL_CF13_QUESTIONS = Object.freeze([
  'What if HELIOS had entered?',
  'What if it waited?',
  'What if size were reduced?',
  'What if execution method differed?',
  'What if it did nothing?',
  'What if the incumbent strategy were replaced?',
] as const);

/** Skeptic must stress these failure modes (non-exhaustive checklist). */
export const SKEPTIC_CF13_ATTACK_VECTORS = Object.freeze([
  'lack of overlap',
  'poor propensity calibration',
  'model extrapolation',
  'regime shift',
  'execution assumptions',
  'market-impact assumptions',
  'selection bias',
  'hindsight bias',
] as const);

export type CausalSupportClassification =
  | 'STRONG_SUPPORT'
  | 'WEAK_SUPPORT'
  | 'AMBIGUOUS'
  | 'UNSUPPORTED'
  | 'CONTRADICTED';

export type CounterfactualAlternativeSpec = {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly addressesQuestion: (typeof COUNTERFACTUAL_CF13_QUESTIONS)[number];
};

/** Integer minor units for simulated counterfactual tallies — not a promise of realized PnL. */
export type EstimatorResultSummary = {
  readonly alternativeId: string;
  readonly estimatorFamily: string;
  readonly pointEstimateMinor: bigint | null;
  readonly intervalNote: string;
  readonly interpretationNote: string;
};

export type DistributionalResultSummary = {
  readonly alternativeId: string;
  readonly summary: string;
  readonly simulationOnly: true;
};

export type ExecutionResultSummary = {
  readonly alternativeId: string;
  readonly assumptions: readonly string[];
  readonly feasibilityNote: string;
};

export type SupportDiagnostic = {
  readonly topic: string;
  readonly status: 'PASS' | 'WARN' | 'FAIL';
  readonly detail: string;
};

export type CounterfactualResearchThesis = {
  readonly thesisId: string;
  readonly schema: typeof COUNTERFACTUAL_CF13_SCHEMA;
  readonly workOrderId: string;
  readonly subjectId: string;
  /** Observed or recorded outcome under the factual policy path (simulation context). */
  readonly factualOutcome: string;
  readonly candidateAlternatives: readonly CounterfactualAlternativeSpec[];
  readonly estimatorResults: readonly EstimatorResultSummary[];
  readonly distributionalResults: readonly DistributionalResultSummary[];
  readonly executionResults: readonly ExecutionResultSummary[];
  readonly causalSupportClassification: CausalSupportClassification;
  readonly uncertainty: string;
  readonly contradictions: readonly string[];
  readonly supportDiagnostics: readonly SupportDiagnostic[];
  readonly conclusion: string;
  readonly languageGuard: {
    readonly forbidsDefiniteCounterfactualEarnings: true;
    readonly note: string;
  };
  readonly grantsFinancialAuthority: false;
  readonly issuesOrders: false;
};

/** Optional structured extraction for thesis assembly (deterministic, no LLM). */
export type Cf13ThesisExtraction = {
  readonly factualOutcomeFragment?: string;
  readonly alternatives?: readonly CounterfactualAlternativeSpec[];
  readonly estimatorRows?: readonly EstimatorResultSummary[];
  readonly distributionalRows?: readonly DistributionalResultSummary[];
  readonly executionRows?: readonly ExecutionResultSummary[];
  readonly causalSupportClassification?: CausalSupportClassification;
  readonly uncertaintyFragment?: string;
  readonly contradictions?: readonly string[];
  readonly supportDiagnostics?: readonly SupportDiagnostic[];
  readonly conclusionFragment?: string;
};

export type CounterfactualCf13Artifact = {
  readonly artifactId: string;
  readonly role: CounterfactualCf13Role;
  readonly workOrderId: string;
  readonly subjectId: string;
  readonly thesis: string;
  readonly supportingEvidence: readonly string[];
  readonly contradictingEvidence: readonly string[];
  readonly counterfactualQuestionsAddressed: readonly (typeof COUNTERFACTUAL_CF13_QUESTIONS)[number][];
  readonly skepticAttacksConsidered: readonly (typeof SKEPTIC_CF13_ATTACK_VECTORS)[number][];
  readonly confidence: number;
  readonly uncertainty: string;
  readonly informationTime: UtcInstant;
  readonly extraction: Cf13ThesisExtraction | null;
  readonly grantsFinancialAuthority: false;
  readonly issuesOrders: false;
};

export type CounterfactualCf13Request = {
  readonly workOrderId: string;
  readonly subjectId: string;
  readonly objective: string;
  readonly contextRef: string;
  readonly evidenceBundle: readonly EvidenceReference[];
  /** Optional: factual policy label (e.g. "no_entry", "delayed_entry"). */
  readonly factualPolicyHint?: string;
  readonly roles?: readonly CounterfactualCf13Role[];
};

export type CounterfactualCf13MeshRun = {
  readonly runId: string;
  readonly schema: typeof COUNTERFACTUAL_CF13_SCHEMA;
  readonly workOrderId: string;
  readonly subjectId: string;
  readonly objective: string;
  readonly phases: readonly CounterfactualCf13Phase[];
  readonly artifacts: readonly CounterfactualCf13Artifact[];
  readonly thesis: CounterfactualResearchThesis;
  readonly createdAt: UtcInstant;
  readonly completedAt: UtcInstant;
};

export type CounterfactualCf13MeshFailure = {
  readonly code: 'VALIDATION_FAILED' | 'SUBJECT_MISMATCH' | 'DATA_ACCESS_REFUSED' | 'LANGUAGE_GUARD_VIOLATION';
  readonly message: string;
};
