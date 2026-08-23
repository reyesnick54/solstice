import type { UtcInstant } from '../../domain/src/time.ts';
import type { AiFailureCode, AiProviderKind } from './taxonomy.ts';

export type ModelHealthSnapshot = {
  readonly provider: AiProviderKind;
  readonly model: string;
  readonly samples: number;
  readonly successes: number;
  readonly errors: number;
  readonly rateLimited: number;
  readonly contextErrors: number;
  readonly structuredOutputFailures: number;
  readonly totalLatencyMs: number;
  readonly available: boolean;
  readonly lastError: AiFailureCode | null;
  readonly checkedAt: UtcInstant;
};

export class ModelHealthTracker {
  private readonly byKey = new Map<string, ModelHealthSnapshot>();

  record(input: {
    readonly provider: AiProviderKind;
    readonly model: string;
    readonly success: boolean;
    readonly latencyMs: number;
    readonly failureCode: AiFailureCode | null;
    readonly checkedAt: UtcInstant;
  }): ModelHealthSnapshot {
    const key = `${input.provider}:${input.model}`;
    const current =
      this.byKey.get(key) ??
      Object.freeze({
        provider: input.provider,
        model: input.model,
        samples: 0,
        successes: 0,
        errors: 0,
        rateLimited: 0,
        contextErrors: 0,
        structuredOutputFailures: 0,
        totalLatencyMs: 0,
        available: true,
        lastError: null,
        checkedAt: input.checkedAt,
      });
    const next = Object.freeze({
      ...current,
      samples: current.samples + 1,
      successes: current.successes + (input.success ? 1 : 0),
      errors: current.errors + (input.success ? 0 : 1),
      rateLimited: current.rateLimited + (input.failureCode === 'MODEL_RATE_LIMITED' ? 1 : 0),
      contextErrors: current.contextErrors + (input.failureCode === 'MODEL_CONTEXT_TOO_LARGE' ? 1 : 0),
      structuredOutputFailures:
        current.structuredOutputFailures +
        (input.failureCode === 'MODEL_OUTPUT_INVALID' || input.failureCode === 'INVALID_STRUCTURED_OUTPUT' ? 1 : 0),
      totalLatencyMs: current.totalLatencyMs + input.latencyMs,
      available: input.success || input.failureCode === 'MODEL_OUTPUT_INVALID',
      lastError: input.failureCode,
      checkedAt: input.checkedAt,
    });
    this.byKey.set(key, next);
    return next;
  }

  get(provider: AiProviderKind, model: string): ModelHealthSnapshot | null {
    return this.byKey.get(`${provider}:${model}`) ?? null;
  }

  snapshot(): readonly ModelHealthSnapshot[] {
    return Object.freeze([...this.byKey.values()]);
  }
}
