import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { AiModelGateway, AiGatewayRequest, AiGatewayResult } from '../gateway.ts';
import type { AiProviderFailure } from '../types.ts';
import { DEFAULT_INFERENCE_RETRY_BUDGET, type NativeSessionGatewayOutcome } from './taxonomy.ts';
import { InferenceRetryBudget, type InferenceRetryBudgetLimits } from './retry-budget.ts';
import { SessionUsageLedger } from './session-usage.ts';

export type NativeSessionInferenceRequest = AiGatewayRequest & {
  readonly nativeSessionId: string;
};

export type NativeSessionInferenceResult = {
  readonly outcome: NativeSessionGatewayOutcome;
  readonly sessionId: string;
  readonly gateway: AiGatewayResult | null;
  readonly attempts: number;
  readonly fallbackUsed: boolean;
  readonly cancelled: boolean;
};

export type NativeSessionModelGatewayOptions = {
  readonly gateway: AiModelGateway;
  readonly retryLimits?: InferenceRetryBudgetLimits;
  readonly usageLedger?: SessionUsageLedger;
};

/**
 * Session-bound wrapper over the canonical AiModelGateway: cancellation,
 * provider fallback (via gateway), retry budgets, and per-session usage.
 */
export class NativeSessionModelGateway {
  private readonly gateway: AiModelGateway;
  private readonly usageLedger: SessionUsageLedger;
  private readonly retryLimits: InferenceRetryBudgetLimits;
  private readonly cancelledSessions = new Set<string>();
  private readonly retryBySession = new Map<string, InferenceRetryBudget>();

  constructor(options: NativeSessionModelGatewayOptions) {
    this.gateway = options.gateway;
    this.usageLedger = options.usageLedger ?? new SessionUsageLedger();
    this.retryLimits = options.retryLimits ?? DEFAULT_INFERENCE_RETRY_BUDGET;
  }

  get sessionUsage(): SessionUsageLedger {
    return this.usageLedger;
  }

  cancelSession(sessionId: string, requestId?: string): void {
    this.cancelledSessions.add(sessionId);
    if (requestId) {
      this.gateway.cancel(requestId);
    }
  }

  isSessionCancelled(sessionId: string): boolean {
    return this.cancelledSessions.has(sessionId);
  }

  infer(request: NativeSessionInferenceRequest): Result<NativeSessionInferenceResult, AiProviderFailure> {
    if (this.cancelledSessions.has(request.nativeSessionId)) {
      return ok(
        Object.freeze({
          outcome: 'CANCELLED',
          sessionId: request.nativeSessionId,
          gateway: null,
          attempts: 0,
          fallbackUsed: false,
          cancelled: true,
        }),
      );
    }

    const budget =
      this.retryBySession.get(request.nativeSessionId) ?? new InferenceRetryBudget(this.retryLimits);
    this.retryBySession.set(request.nativeSessionId, budget);

    let lastError: AiProviderFailure | null = null;
    let attempts = 0;
    let fallbackUsed = false;
    let lastResult: AiGatewayResult | null = null;

    while (budget.beginAttempt()) {
      attempts += 1;
      if (this.cancelledSessions.has(request.nativeSessionId) || request.cancel?.cancelled) {
        this.gateway.cancel(request.requestId);
        return ok(
          Object.freeze({
            outcome: 'CANCELLED',
            sessionId: request.nativeSessionId,
            gateway: lastResult,
            attempts,
            fallbackUsed,
            cancelled: true,
          }),
        );
      }

      const result = this.gateway.infer({
        ...request,
        allowFallback: request.allowFallback ?? true,
        conversationId: request.conversationId ?? request.nativeSessionId,
      });
      if (result.ok) {
        lastResult = result.value;
        fallbackUsed = fallbackUsed || result.value.fallbackUsed;
        if (result.value.usage) {
          this.usageLedger.record(request.nativeSessionId, result.value.usage);
        }
        return ok(
          Object.freeze({
            outcome: 'SUCCESS',
            sessionId: request.nativeSessionId,
            gateway: result.value,
            attempts,
            fallbackUsed,
            cancelled: false,
          }),
        );
      }

      lastError = result.error;
      const retryDecision = budget.recordFailure(result.error.code);
      if (!retryDecision.retry) {
        break;
      }
    }

    if (lastError?.code === 'MODEL_CANCELLED') {
      return ok(
        Object.freeze({
          outcome: 'CANCELLED',
          sessionId: request.nativeSessionId,
          gateway: lastResult,
          attempts,
          fallbackUsed,
          cancelled: true,
        }),
      );
    }

    if (lastError) {
      return err(lastError);
    }

    return err({
      ok: false,
      code: 'MODEL_UNAVAILABLE',
      detail: 'native session gateway exhausted retry budget without a response',
      providerKind: null,
    });
  }
}
