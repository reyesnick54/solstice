import type { UtcInstant } from '@solstice/domain';

import type {
  ShadowLabChaosScenario,
  ShadowLabLongRunStep,
  ShadowLabWorkPackageId,
} from './taxonomy.ts';

export type ShadowLabWorkPackageRow = {
  readonly workPackage: ShadowLabWorkPackageId;
  readonly title: string;
  readonly status: 'QUALIFIED' | 'BLOCKED';
  readonly moduleRef: string;
};

export type SealedDecisionRecord = {
  readonly decisionId: string;
  readonly strategyId: string;
  readonly campaignId: string;
  readonly knowableAt: UtcInstant;
  readonly recordedAt: UtcInstant;
  readonly sequence: number;
  readonly contentHash: string;
  readonly previousHash: string;
};

export type ShadowLabCheckpoint = {
  readonly checkpointId: string;
  readonly sealedAt: UtcInstant;
  readonly decisionCount: number;
  readonly lastContentHash: string;
  readonly runtimeGeneration: number;
};

export type ShadowLabLongRunStepResult = {
  readonly step: ShadowLabLongRunStep;
  readonly ok: boolean;
  readonly detail: string;
};

export type ShadowLabLongRunResult = {
  readonly campaignId: string;
  readonly steps: readonly ShadowLabLongRunStepResult[];
  readonly allStepsOk: boolean;
  readonly sealedDecisions: readonly SealedDecisionRecord[];
  readonly demotedStrategyId: string | null;
  readonly evidenceChainIntact: boolean;
  readonly duplicateDecisionIds: readonly string[];
  readonly dailyReportId: string;
  readonly weeklyReportId: string;
};

export type ShadowLabChaosResult = {
  readonly scenario: ShadowLabChaosScenario;
  readonly recovered: boolean;
  readonly historyRewritten: boolean;
  readonly detail: string;
};

export type ShadowLabChaosHarnessResult = {
  readonly scenarios: readonly ShadowLabChaosResult[];
  readonly allRecovered: boolean;
  readonly anyHistoryRewritten: boolean;
};

export type ShadowLabRealityGateResult = {
  readonly architectureQualified: boolean;
  readonly forwardAlphaSupportedClaimed: boolean;
  readonly notes: readonly string[];
};
