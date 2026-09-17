import type { SpecialistTaskInput, SpecialistTaskOutput } from './types.ts';
import type { ModelRouteDecision } from './model-routing.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';

export type CriticInput = {
  readonly task: SpecialistTaskInput;
  readonly route: ModelRouteDecision;
  readonly startedAt: UtcInstant;
  readonly completedAt: UtcInstant;
  readonly candidateSummary: string;
  readonly priorFindings: readonly string[];
  readonly costNotes: readonly string[];
  readonly liquidityNotes: readonly string[];
  readonly timingNotes: readonly string[];
  readonly regimeNotes: readonly string[];
  readonly benchmarkNotes: readonly string[];
};

export function buildAdversarialCriticOutput(input: CriticInput): SpecialistTaskOutput {
  const contradictions: string[] = [];
  if (input.priorFindings.some((row) => row.includes('unsupported'))) {
    contradictions.push('Upstream specialists reported unsupported evidence.');
  }
  if (input.liquidityNotes.some((row) => row.includes('thin'))) {
    contradictions.push('Liquidity may not support the proposed sizing or exit path.');
  }
  if (input.timingNotes.some((row) => row.includes('stale'))) {
    contradictions.push('Timing assumptions rely on stale market inputs.');
  }

  return Object.freeze({
    outputId: `cmout_cr_${input.task.taskId}`,
    taskId: input.task.taskId,
    workOrderId: input.task.workOrderId,
    subjectId: input.task.subjectId,
    specialistRole: 'ADVERSARIAL_CRITIC',
    task: 'adversarial-critique',
    model: Object.freeze({
      provider: input.route.provider,
      modelId: input.route.modelId,
      version: input.route.version,
    }),
    toolsUsed: Object.freeze(['getPortfolio', 'getMarketSnapshot', 'getMandate']),
    evidenceReferences: Object.freeze([...input.task.evidenceBundle]),
    findings: Object.freeze([
      `weakest-assumption: ${input.candidateSummary}`,
      `cost: ${input.costNotes.join('; ') || 'not assessed'}`,
      `liquidity: ${input.liquidityNotes.join('; ') || 'not assessed'}`,
      `timing: ${input.timingNotes.join('; ') || 'not assessed'}`,
      `regime-fit: ${input.regimeNotes.join('; ') || 'not assessed'}`,
      `benchmark: ${input.benchmarkNotes.join('; ') || 'not assessed'}`,
      'execution-feasibility: research-only; critic cannot veto financial action.',
    ]),
    assumptions: Object.freeze([
      'Critique is evidence consumed by decision logic, not a financial authority.',
      'Risk Engine and Compliance Kernel retain deterministic authority.',
    ]),
    contradictions: Object.freeze(contradictions),
    confidence: contradictions.length >= 2 ? 0.7 : 0.55,
    invalidatingConditions: Object.freeze([
      'Fresh confirming evidence',
      'Improved liquidity profile',
      'Validated execution route',
    ]),
    missingInformation: Object.freeze(['Independent benchmark comparison may be incomplete.']),
    recommendation: contradictions.length >= 2 ? 'OPPOSE' : contradictions.length === 1 ? 'INVESTIGATE' : 'WAIT',
    usage: Object.freeze({
      inputTokens: 900,
      outputTokens: 450,
      inferenceCalls: 1,
      toolCalls: 3,
      costMicros: 95_000n,
      currency: 'USD',
    }),
    timestamps: Object.freeze({ startedAt: input.startedAt, completedAt: input.completedAt }),
    lineage: Object.freeze({
      modelProvider: input.route.provider,
      modelId: input.route.modelId,
      modelVersion: input.route.version,
      promptTemplateId: input.route.promptTemplateId,
      promptTemplateVersion: input.route.promptTemplateVersion,
      sharedEvidenceIds: Object.freeze(input.task.evidenceBundle.map((row) => row.evidenceId)),
      sharedUpstreamSourceRefs: Object.freeze(input.task.priorOutputs.map((row) => row.outputId)),
      toolLineage: Object.freeze(['adversarial-critic/v1']),
    }),
    taskState: 'SUCCEEDED',
    narrative:
      'Structured opposing case assembled from evidence, costs, liquidity, timing, regime fit, benchmark, and execution feasibility.',
    grantsFinancialAuthority: false as const,
  });
}
