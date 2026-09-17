import type { UtcInstant } from '../imports.ts';
import { buildAdversarialCriticOutput } from './critic.ts';
import { buildEvidenceVerifierOutput, type AssertionClaim } from './evidence.ts';
import type { ModelRouteDecision } from './model-routing.ts';
import type {
  HeliosSpecialistRole,
  SpecialistRecommendation,
  SpecialistTaskInput,
  SpecialistTaskOutput,
  SpecialistTaskState,
} from './types.ts';

export type SpecialistExecutionResult =
  | { readonly ok: true; readonly output: SpecialistTaskOutput }
  | { readonly ok: false; readonly state: SpecialistTaskState; readonly message: string };

function baseOutput(input: {
  readonly task: SpecialistTaskInput;
  readonly route: ModelRouteDecision;
  readonly role: HeliosSpecialistRole;
  readonly taskName: string;
  readonly startedAt: UtcInstant;
  readonly completedAt: UtcInstant;
  readonly findings: readonly string[];
  readonly recommendation: SpecialistRecommendation;
  readonly toolsUsed: readonly string[];
  readonly confidence: number | null;
  readonly usageCostMicros: bigint;
  readonly inferenceCalls: number;
}): SpecialistTaskOutput {
  return Object.freeze({
    outputId: `cmout_${input.role.toLowerCase()}_${input.task.taskId}`,
    taskId: input.task.taskId,
    workOrderId: input.task.workOrderId,
    subjectId: input.task.subjectId,
    specialistRole: input.role,
    task: input.taskName,
    model: Object.freeze({
      provider: input.route.provider,
      modelId: input.route.modelId,
      version: input.route.version,
    }),
    toolsUsed: Object.freeze([...input.toolsUsed]),
    evidenceReferences: Object.freeze([...input.task.evidenceBundle]),
    findings: Object.freeze([...input.findings]),
    assumptions: Object.freeze([`${input.role} operates under bounded research mandate.`]),
    contradictions: Object.freeze([]),
    confidence: input.confidence,
    invalidatingConditions: Object.freeze(['Material new evidence', 'Mandate change']),
    missingInformation: Object.freeze([]),
    recommendation: input.recommendation,
    usage: Object.freeze({
      inputTokens: 300,
      outputTokens: 180,
      inferenceCalls: input.inferenceCalls,
      toolCalls: input.toolsUsed.length,
      costMicros: input.usageCostMicros,
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
      toolLineage: Object.freeze([`${input.role.toLowerCase()}/v1`]),
    }),
    taskState: 'SUCCEEDED',
    grantsFinancialAuthority: false as const,
  });
}

export function executeSpecialistTask(input: {
  readonly task: SpecialistTaskInput;
  readonly route: ModelRouteDecision;
  readonly startedAt: UtcInstant;
  readonly completedAt: UtcInstant;
  readonly claims?: readonly AssertionClaim[];
  readonly forceFailure?: boolean;
  readonly forceTimeout?: boolean;
}): SpecialistExecutionResult {
  if (input.forceTimeout) {
    return { ok: false, state: 'TIMED_OUT', message: 'specialist task exceeded deadline' };
  }
  if (input.forceFailure) {
    return { ok: false, state: 'FAILED', message: 'specialist task failed' };
  }

  const role = input.task.role;
  switch (role) {
    case 'OPPORTUNITY_RESEARCH':
      return {
        ok: true,
        output: baseOutput({
          task: input.task,
          route: input.route,
          role,
          taskName: 'scan-approved-sources',
          startedAt: input.startedAt,
          completedAt: input.completedAt,
          findings: Object.freeze([
            `hypothesis: ${input.task.objective}`,
            `opportunity-kind: ${input.task.opportunityKind}`,
            'converted approved market observations into a research candidate.',
          ]),
          recommendation: 'INVESTIGATE',
          toolsUsed: Object.freeze(['getMarketSnapshot', 'getEconomicValueSnapshot']),
          confidence: 0.6,
          usageCostMicros: 40_000n,
          inferenceCalls: input.route.provider === 'GROK' ? 1 : 0,
        }),
      };
    case 'MACRO_FX':
      return {
        ok: true,
        output: baseOutput({
          task: input.task,
          route: input.route,
          role,
          taskName: 'macro-fx-assessment',
          startedAt: input.startedAt,
          completedAt: input.completedAt,
          findings: Object.freeze([
            'USD liquidity regime: stable simulation fixture.',
            'Cross-asset stress: no live FX feed; fixture-only assessment.',
          ]),
          recommendation: input.task.opportunityKind === 'CASH_YIELD' ? 'SUPPORT' : 'WAIT',
          toolsUsed: Object.freeze(['getMarketSnapshot', 'getRdtReadiness']),
          confidence: 0.65,
          usageCostMicros: 35_000n,
          inferenceCalls: input.route.provider === 'GROK' ? 1 : 0,
        }),
      };
    case 'STAT_ARB_RELATIVE_VALUE':
      return {
        ok: true,
        output: baseOutput({
          task: input.task,
          route: input.route,
          role,
          taskName: 'relative-value-scan',
          startedAt: input.startedAt,
          completedAt: input.completedAt,
          findings: Object.freeze([
            'spread-zscore: fixture dislocation detected between SIM-ETF-1 and SIM-ETF-2.',
            'correlation: elevated versus 30d simulation baseline.',
          ]),
          recommendation: 'INVESTIGATE',
          toolsUsed: Object.freeze(['getMarketSnapshot', 'getInstrumentMetadata']),
          confidence: 0.72,
          usageCostMicros: 10_000n,
          inferenceCalls: 0,
        }),
      };
    case 'VOLATILITY':
      return {
        ok: true,
        output: baseOutput({
          task: input.task,
          route: input.route,
          role,
          taskName: 'volatility-state',
          startedAt: input.startedAt,
          completedAt: input.completedAt,
          findings: Object.freeze([
            'realized-vol: moderate in fixture surface.',
            'convexity: insufficient live surface data; simulation-only note.',
          ]),
          recommendation: 'WAIT',
          toolsUsed: Object.freeze(['getMarketSnapshot']),
          confidence: 0.58,
          usageCostMicros: 8_000n,
          inferenceCalls: 0,
        }),
      };
    case 'MICROSTRUCTURE':
      return {
        ok: true,
        output: baseOutput({
          task: input.task,
          route: input.route,
          role,
          taskName: 'microstructure-scan',
          startedAt: input.startedAt,
          completedAt: input.completedAt,
          findings: Object.freeze([
            'spread: tight for SIM-ETF fixtures.',
            'liquidity: adequate for simulation sizing; thin at larger notionals.',
          ]),
          recommendation: 'SUPPORT',
          toolsUsed: Object.freeze(['getMarketSnapshot', 'getPortfolio']),
          confidence: 0.62,
          usageCostMicros: 8_000n,
          inferenceCalls: 0,
        }),
      };
    case 'EXECUTION_RESEARCH':
      return {
        ok: true,
        output: baseOutput({
          task: input.task,
          route: input.route,
          role,
          taskName: 'execution-route-research',
          startedAt: input.startedAt,
          completedAt: input.completedAt,
          findings: Object.freeze([
            'route: simulation-only smart-router candidate.',
            'market-impact: bounded; no broker keys or unrestricted execution authority.',
          ]),
          recommendation: 'INVESTIGATE',
          toolsUsed: Object.freeze(['getMarketSnapshot', 'getPortfolio', 'getInstrumentMetadata']),
          confidence: 0.6,
          usageCostMicros: 55_000n,
          inferenceCalls: 1,
        }),
      };
    case 'EVIDENCE_VERIFIER':
      return {
        ok: true,
        output: buildEvidenceVerifierOutput({
          task: input.task,
          route: input.route,
          startedAt: input.startedAt,
          completedAt: input.completedAt,
          claims: input.claims ?? [],
        }),
      };
    case 'ADVERSARIAL_CRITIC':
      return {
        ok: true,
        output: buildAdversarialCriticOutput({
          task: input.task,
          route: input.route,
          startedAt: input.startedAt,
          completedAt: input.completedAt,
          candidateSummary: input.task.objective,
          priorFindings: Object.freeze(input.task.priorOutputs.flatMap((row) => [...row.findings])),
          costNotes: Object.freeze(['Research spend consumes H06 budget.']),
          liquidityNotes: Object.freeze(
            input.task.priorOutputs.some((row) => row.findings.some((f) => f.includes('thin')))
              ? ['thin liquidity noted upstream']
              : ['liquidity acceptable in simulation'],
          ),
          timingNotes: Object.freeze(
            input.task.evidenceBundle.some((row) => !row.freshnessOk) ? ['stale evidence present'] : ['timing acceptable'],
          ),
          regimeNotes: Object.freeze(['Regime fit depends on macro/FX assessment.']),
          benchmarkNotes: Object.freeze(['Benchmark comparison remains incomplete in simulation.']),
        }),
      };
    case 'META_ALLOCATOR':
      return {
        ok: false,
        state: 'SKIPPED',
        message: 'meta allocator runs after specialist tasks complete',
      };
    default: {
      const _exhaustive: never = role;
      return _exhaustive;
    }
  }
}
