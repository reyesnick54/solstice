import type {
  FALSIFICATION_REPORT_SCHEMA,
  HELIOS_EVOL08_FALSIFICATION_ENGINE_BLOCKED,
  HELIOS_EVOL08_FALSIFICATION_ENGINE_QUALIFIED,
  StructuralFalsificationQuestionId,
  StressChallengerKind,
} from './taxonomy.ts';

/** What an adversary is trying to disprove about the strategy. */
export type FailureHypothesis = {
  readonly hypothesisId: string;
  readonly statement: string;
  readonly relatedChallenge?: StressChallengerKind;
};

/** One stress scenario applied in a campaign. */
export type StressChallenge = {
  readonly kind: StressChallengerKind;
  /** Unitless severity 1–10; scales sensitivity loss deterministically. */
  readonly severity: number;
};

/** Bundle of stress challenges for a strategy under test. */
export type StressCampaign = {
  readonly campaignId: string;
  readonly strategyId: string;
  readonly challenges: readonly StressChallenge[];
};

/** Outcome of applying one challenger to a strategy snapshot. */
export type FalsificationFinding = {
  readonly findingId: string;
  readonly campaignId: string;
  readonly kind: StressChallengerKind;
  /** Integer basis points of retained edge after the challenger (may be negative). */
  readonly edgeRetainedBps: number;
  readonly falsified: boolean;
  readonly rationale: string;
};

export type PerformanceConcentrationAnalysis = {
  readonly strategyId: string;
  /** Largest share of edge attributed to one instrument (basis points of total 10_000 = 100%). */
  readonly topInstrumentShareBps: number;
  readonly topYearShareBps: number;
  readonly topSectorShareBps: number;
  readonly topRegimeShareBps: number;
  readonly topProviderShareBps: number;
  readonly topTradeShareBps: number;
  readonly extremeEventDependenceBps: number;
  /**
   * When true, a single slice still explains most edge — structural falsification risk.
   * Thresholds are fixed integers in `concentration.ts`.
   */
  readonly concentrationRisk: boolean;
};

export type FragilityAssessment = {
  readonly strategyId: string;
  /** True when threshold perturbation wipes edge (see gates). */
  readonly thresholdFragile: boolean;
  /** True when concentrationRisk is set. */
  readonly concentrationFragile: boolean;
  /** Combined structural adversary view (deterministic). */
  readonly structurallyFragile: boolean;
  readonly details: readonly string[];
};

/** Input slice for concentration — all shares are integer basis points summing to ≤ 10_000. */
export type PerformanceConcentrationSnapshot = {
  readonly topInstrumentShareBps: number;
  readonly topYearShareBps: number;
  readonly topSectorShareBps: number;
  readonly topRegimeShareBps: number;
  readonly topProviderShareBps: number;
  readonly topTradeShareBps: number;
  readonly extremeEventDependenceBps: number;
};

export type StrategyAdversary = {
  readonly adversaryId: string;
  readonly role:
    | 'BEAR'
    | 'LEAKAGE_HUNTER'
    | 'OVERFIT_HUNTER'
    | 'EXECUTION_REALITY';
  /** Emit hypotheses; does not decide qualification. */
  proposeHypotheses(input: StrategyFalsificationContext): readonly FailureHypothesis[];
};

export type StrategyFalsificationContext = {
  readonly strategyId: string;
  readonly campaign: StressCampaign;
  readonly baselineEdgeBps: number;
  /**
   * Integer bps of edge lost per unit severity for each stress kind defaults in engine
   * when omitted (see `defaultStressSensitivityBps`).
   */
  readonly stressSensitivityBps?: Readonly<Partial<Record<StressChallengerKind, number>>>;
  readonly concentration: PerformanceConcentrationSnapshot;
  /** When true, small threshold moves collapse edge (structural gate). */
  readonly thresholdSensitivityFragile: boolean;
};

export type BullStrategyAgentView = {
  readonly agentId: 'BULL_STRATEGY';
  readonly strongestCaseSummary: string;
};

export type StrategyFalsificationReport = {
  readonly schema: typeof FALSIFICATION_REPORT_SCHEMA;
  readonly strategyId: string;
  readonly campaign: StressCampaign;
  readonly findings: readonly FalsificationFinding[];
  readonly concentration: PerformanceConcentrationAnalysis;
  readonly fragility: FragilityAssessment;
  readonly bullCase: BullStrategyAgentView;
  readonly adversaryHypotheses: readonly FailureHypothesis[];
  readonly grantsFinancialAuthority: false;
  readonly qualification: FalsificationQualificationResult;
};

export type FalsificationQualificationResult = {
  readonly marker:
    | typeof HELIOS_EVOL08_FALSIFICATION_ENGINE_QUALIFIED
    | typeof HELIOS_EVOL08_FALSIFICATION_ENGINE_BLOCKED;
  readonly allStressChallengersTested: boolean;
  readonly structuralGatesOk: boolean;
  readonly gates: readonly FalsificationGateResult[];
};

export type FalsificationGateResult = {
  readonly gateId: string;
  readonly passed: boolean;
  readonly detail: string;
};

export type StructuralQuestionAssessment = {
  readonly questionId: StructuralFalsificationQuestionId;
  /** Whether evidence indicates single-point dependence (deterministic from concentration). */
  readonly triggered: boolean;
};
