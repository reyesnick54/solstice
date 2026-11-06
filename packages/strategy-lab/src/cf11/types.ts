/**
 * HELIOS CF11 — counterfactual offline policy improvement lab (research / simulation only).
 * Candidates may tune research decision logic; they must not alter compliance, mandates, hard limits, or Execution Authority.
 */

export const HELIOS_CF11_POLICY_SAFETY_ENVELOPE_SCHEMA_VERSION =
  'helios.cf11.policy_safety_envelope.v1' as const;

/** Program qualification markers for CF11. */
export const HELIOS_CF11_SAFE_POLICY_IMPROVEMENT_QUALIFIED =
  'HELIOS_CF11_SAFE_POLICY_IMPROVEMENT_QUALIFIED' as const;

export const HELIOS_CF11_SAFE_POLICY_IMPROVEMENT_BLOCKED = 'HELIOS_CF11_SAFE_POLICY_IMPROVEMENT_BLOCKED' as const;

/** Surfaces a candidate research policy must never automatically modify. */
export const CF11_FORBIDDEN_POLICY_SURFACES = Object.freeze([
  'LEGAL_COMPLIANCE',
  'CUSTOMER_MANDATE',
  'HARD_RISK_LIMITS',
  'EXECUTION_AUTHORITY',
] as const);

export type Cf11ForbiddenPolicySurface = (typeof CF11_FORBIDDEN_POLICY_SURFACES)[number];

/**
 * Frozen safety envelope — candidate changes stay within research logic only.
 */
export type PolicySafetyEnvelope = Readonly<{
  readonly schemaVersion: typeof HELIOS_CF11_POLICY_SAFETY_ENVELOPE_SCHEMA_VERSION;
  /** Every forbidden surface must appear here; the candidate is asserted not to mutate these automatically. */
  readonly frozenSurfaces: ReadonlySet<Cf11ForbiddenPolicySurface>;
  readonly candidateMutatesOnlyResearchLogic: true;
}>;

/** Research-only knobs a counterfactual candidate may propose to change. */
export const CF11_RESEARCH_POLICY_KNOB_KINDS = Object.freeze([
  'SIGNAL_THRESHOLD',
  'CONFIRMATION_REQUIREMENTS',
  'ENTRY_TIMING',
  'EXIT_TIMING',
  'STRATEGY_CHOICE',
  'RESEARCH_ALLOCATION',
  'PAPER_EXECUTION_STYLE',
] as const);

export type Cf11ResearchPolicyKnobKind = (typeof CF11_RESEARCH_POLICY_KNOB_KINDS)[number];

export type PolicyImprovementCandidate = Readonly<{
  readonly candidateId: string;
  readonly baselinePolicyId: string;
  /** Declared research-policy dimensions this candidate would adjust (observability / audit). */
  readonly proposedKnobKinds: readonly Cf11ResearchPolicyKnobKind[];
  readonly safetyEnvelope: PolicySafetyEnvelope;
}>;

/**
 * Conservative improvement summary: decisions use the lower confidence bound, not the mean.
 * Values are on a single comparable outcome scale in minor units (domain-defined).
 */
export type ConservativeImprovementBound = Readonly<{
  readonly lowerConfidenceBoundMinor: bigint;
  readonly meanEstimateMinor: bigint;
  readonly decisionUsesLowerBound: true;
}>;

export type Cf11OpeEstimatorAgreement = Readonly<{
  readonly estimatorsAgree: boolean;
  readonly disagreementReason: string | null;
}>;

/**
 * Baseline vs candidate comparison under offline / counterfactual evidence rules.
 */
export type BaselinePolicyComparison = Readonly<{
  readonly comparisonId: string;
  readonly candidate: PolicyImprovementCandidate;
  readonly conservativeBound: ConservativeImprovementBound;
  /** Policy overlap diagnostic; often expressed in basis points (0–10_000n for 0–100%). */
  readonly overlapScoreBps: bigint;
  readonly overlapAdequate: boolean;
  readonly effectiveSampleSize: bigint;
  readonly sufficientEffectiveSample: boolean;
  readonly opeAgreement: Cf11OpeEstimatorAgreement;
  readonly regimeRobustnessHolds: boolean;
  readonly executionRealismHolds: boolean;
}>;

/**
 * Bounded region for safe improvement claims (paired with BaselinePolicyComparison in practice).
 */
export type PolicySafetyEnvelopeBounds = Readonly<{
  readonly envelope: PolicySafetyEnvelope;
  readonly comparison: BaselinePolicyComparison;
}>;

/** After CF11 qualification, the only permitted handoff is EVOL11 champion/challenger — not live execution. */
export const CF11_NEXT_ROUTE_STAGE = 'EVOL11_CHAMPION_CHALLENGER' as const;

export type Cf11QualifiedRoute = Readonly<{
  readonly nextStage: typeof CF11_NEXT_ROUTE_STAGE;
  readonly liveExecution: false;
  readonly strategyLabChampionChallengerOnly: true;
}>;
