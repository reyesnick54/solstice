import { randomUUID } from 'node:crypto';
import type { Clock } from '@solstice/config';
import { err, ok, type CustomerId, type Result } from '@solstice/domain';
import { buildPublicResearchContext } from './context-sanitizer.ts';
import { buildGrokResearchResult } from './parse.ts';
import { runBoundedResearchToolLoop } from './tool-loop.ts';
import type { ResearchReasoningEngine } from './reasoning.ts';
import type { HeliosResearchToolRegistry } from './tool-registry.ts';
import { createDefaultResearchToolRegistry } from './tool-registry.ts';
import { SimulationResearchReasoningEngine, UnavailableGrokReasoningEngine } from './reasoning.ts';
import { PublicResearchCache } from './cache.ts';
import { InMemoryGrokResearchStore } from './store.ts';
import type {
  GrokResearchFailure,
  GrokResearchResult,
  HeliosResearchTaskInput,
  ResearchLoopLimits,
} from './types.ts';
import type { ResearchRecommendationClass } from './taxonomy.ts';

export type GrokResearchRuntimePorts = {
  readonly clock: Clock;
  readonly registry?: HeliosResearchToolRegistry;
  readonly reasoning?: ResearchReasoningEngine;
  readonly store?: InMemoryGrokResearchStore;
  readonly cache?: PublicResearchCache;
  readonly limits?: ResearchLoopLimits;
  readonly cancelled?: () => boolean;
};

export class GrokResearchRuntime {
  private readonly clock: Clock;
  private readonly registry: HeliosResearchToolRegistry;
  private readonly reasoning: ResearchReasoningEngine;
  readonly store: InMemoryGrokResearchStore;
  readonly cache: PublicResearchCache;
  private readonly limits?: ResearchLoopLimits;
  private readonly cancelled?: () => boolean;

  constructor(ports: GrokResearchRuntimePorts) {
    this.clock = ports.clock;
    this.registry = ports.registry ?? createDefaultResearchToolRegistry();
    this.reasoning = ports.reasoning ?? new SimulationResearchReasoningEngine();
    this.store = ports.store ?? new InMemoryGrokResearchStore();
    this.cache = ports.cache ?? new PublicResearchCache();
    if (ports.limits !== undefined) {
      this.limits = ports.limits;
    }
    if (ports.cancelled !== undefined) {
      this.cancelled = ports.cancelled;
    }
  }

  static withUnavailableGrok(clock: Clock): GrokResearchRuntime {
    return new GrokResearchRuntime({
      clock,
      reasoning: new UnavailableGrokReasoningEngine(),
    });
  }

  async executeResearch(
    task: HeliosResearchTaskInput,
  ): Promise<Result<GrokResearchResult, GrokResearchFailure>> {
    const startedAt = this.clock.now();
    const contextResult = buildPublicResearchContext(task);
    if (!contextResult.ok) {
      return contextResult;
    }
    const context = contextResult.value;

    const cacheKey = this.cache.cacheKey(context.question, context.publicContext);
    const cached = this.cache.get(cacheKey, Date.now());
    if (cached && task.privacyClass === 'PUBLIC' && !task.privateContext) {
      const restored = Object.freeze({
        ...cached,
        researchResultId: `grr_cached_${randomUUID().slice(0, 8)}`,
        taskId: task.taskId,
        workOrderId: task.workOrderId,
        customerId: task.customerId,
        startedAt,
        completedAt: this.clock.now(),
      });
      this.store.put(restored);
      return ok(restored);
    }

    const loop = await runBoundedResearchToolLoop({
      clock: this.clock,
      task,
      context,
      registry: this.registry,
      reasoning: this.reasoning,
      options: {
        ...(this.limits !== undefined ? { limits: this.limits } : {}),
        ...(this.cancelled !== undefined ? { cancelled: this.cancelled } : {}),
      },
    });

    if (loop.completionStatus === 'PROVIDER_UNAVAILABLE') {
      return err({
        code: 'PROVIDER_UNAVAILABLE',
        message: 'Grok research provider is unavailable; no fabricated result produced',
        partialResult: null,
      });
    }

    const recommendation = inferRecommendation(loop.completionStatus, task);
    const result = buildGrokResearchResult({
      task,
      context,
      toolRecords: loop.toolRecords,
      usage: loop.usage,
      provider: loop.provider,
      model: loop.model,
      modelVersion: loop.modelVersion,
      synthesis: loop.synthesis,
      completionStatus: loop.completionStatus,
      recommendation,
      startedAt,
      completedAt: this.clock.now(),
    });

    this.store.put(result);

    if (task.privacyClass === 'PUBLIC' && !task.privateContext) {
      this.cache.put({ key: cacheKey, result, nowMs: Date.now() });
    }

    return ok(result);
  }

  getResult(taskId: string, customerId: CustomerId): GrokResearchResult | undefined {
    return this.store.get(taskId as import('../ids.ts').HeliosTaskId, customerId);
  }
}

function inferRecommendation(
  status: GrokResearchResult['completionStatus'],
  task: HeliosResearchTaskInput,
): ResearchRecommendationClass {
  if (status === 'BUDGET_EXHAUSTED' || status === 'LIMIT_REACHED') {
    return 'WAIT';
  }
  if (status === 'CANCELLED' || status === 'FAILED' || status === 'PROVIDER_UNAVAILABLE') {
    return 'NO_ACTION';
  }
  if (task.candidateOpportunityKey) {
    return 'PROPOSE_CANDIDATE';
  }
  return 'INVESTIGATE';
}
