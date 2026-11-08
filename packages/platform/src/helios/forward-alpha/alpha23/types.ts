import type { UtcInstant } from '@solstice/domain';

import type { AlphaDecayState } from '../alpha11/types.ts';
import type { AlphaHealthState } from '../alpha11/taxonomy.ts';

import {
  ALPHA23_SCHEMA,
  type ForbiddenAutomaticResearchAction,
  type ForwardDemotionTransition,
  type ForwardDemotionTrigger,
  type ForwardResearchPosture,
  type ForwardStrategyHealthBand,
  type ResearchReactivationGate,
} from './taxonomy.ts';

/** Predeclared automatic demotion limits (research simulation — not live risk authority). */
export type ForwardDemotionPolicy = {
  readonly schema: typeof ALPHA23_SCHEMA;
  readonly policyId: string;
  readonly policyHash: string;
  readonly maxDrawdownBps: number;
  readonly minAlphaConfidenceBps: number;
  readonly maxBenchmarkUnderperformanceBps: number;
  readonly maxExecutionCostBps: number;
  readonly maxDecisionRateChangeBps: number;
  readonly minCapacityHeadroomBps: number;
  readonly minSequentialEvidenceStrengthBps: number;
  readonly permitsRiskIncrease: false;
  readonly forbiddenAutomaticActions: readonly ForbiddenAutomaticResearchAction[];
};

export type ForwardStrategyHealthSignal = {
  readonly trigger: ForwardDemotionTrigger;
  readonly observedBps: number;
  readonly thresholdBps: number;
  readonly fired: boolean;
  readonly detail: string;
};

export type ForwardStrategyHealth = {
  readonly schema: typeof ALPHA23_SCHEMA;
  readonly strategyId: string;
  readonly evaluatedAt: UtcInstant;
  readonly posture: ForwardResearchPosture;
  readonly band: ForwardStrategyHealthBand;
  readonly signals: readonly ForwardStrategyHealthSignal[];
  readonly firedTriggers: readonly ForwardDemotionTrigger[];
  readonly alpha11Health: AlphaHealthState | null;
  readonly drawdownBps: number | null;
  readonly grantsFinancialAuthority: false;
  readonly permitsRiskIncrease: false;
};

export type ResearchKillDecision = {
  readonly schema: typeof ALPHA23_SCHEMA;
  readonly decisionId: string;
  readonly strategyId: string;
  readonly decidedAt: UtcInstant;
  readonly killRequired: boolean;
  readonly fromPosture: ForwardResearchPosture;
  readonly toPosture: ForwardResearchPosture;
  readonly transition: ForwardDemotionTransition;
  readonly triggers: readonly ForwardDemotionTrigger[];
  readonly reason: string;
  readonly failedEvidenceRetained: true;
  readonly permitsRiskIncrease: false;
  readonly forbiddenActionsEnforced: readonly ForbiddenAutomaticResearchAction[];
  readonly reactivationRequires: readonly ResearchReactivationGate[];
  readonly grantsFinancialAuthority: false;
};

export type ForwardStrategyHealthInput = {
  readonly strategyId: string;
  readonly evaluatedAt: UtcInstant;
  readonly posture: ForwardResearchPosture;
  readonly drawdownBps?: number | null;
  readonly alphaConfidenceBps?: number | null;
  readonly benchmarkUnderperformanceBps?: number | null;
  readonly executionCostBps?: number | null;
  readonly marketDataQualityBps?: number | null;
  readonly featureHealthBps?: number | null;
  readonly decisionRateChangeBps?: number | null;
  readonly regimeCompatibilityBps?: number | null;
  readonly capacityHeadroomBps?: number | null;
  readonly sequentialEvidenceStrengthBps?: number | null;
  readonly operationalAnomaly?: boolean;
  readonly alpha11State?: AlphaDecayState | null;
};
