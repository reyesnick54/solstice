import type { UtcInstant } from '../imports.ts';

export const RESEARCH_AUTOPILOT_TASK_KINDS = Object.freeze([
  'MARKET_INVESTIGATION',
  'STRATEGY_SOURCE_REVIEW',
  'GENOME_CANDIDATE_RESEARCH',
] as const);

export type ResearchAutopilotTaskKind = (typeof RESEARCH_AUTOPILOT_TASK_KINDS)[number];

export type ResearchAutopilotTask = {
  readonly taskId: string;
  readonly workOrderId: string;
  readonly subjectId: string;
  readonly kind: ResearchAutopilotTaskKind;
  readonly objective: string;
  readonly marketContextRef: string | null;
  readonly genomeCandidateRef: string | null;
  readonly createdAt: UtcInstant;
  readonly grantsExecutionAuthority: false;
  readonly researchOnly: true;
};

export type ResearchAutopilotLoopResult = {
  readonly task: ResearchAutopilotTask;
  readonly completedAt: UtcInstant;
  readonly summary: string;
  readonly meshRunId: string | null;
  readonly financialExecutionRequested: false;
};
