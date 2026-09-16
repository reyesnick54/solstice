import { randomUUID } from 'node:crypto';

import type { Clock } from '../../../config/src/clock.ts';
import type { AiModelGateway } from '../gateway.ts';
import { routeInferenceModel } from '../routing-policy.ts';
import type { AiProviderFailure } from '../types.ts';
import type { InferenceModelCatalog } from '../catalog.ts';
import type { ResearchBudgetPort } from './budget-port.ts';
import { ConcurrencyGate, DEFAULT_CONCURRENCY_LIMITS, type ConcurrencyLimits } from './concurrency.ts';
import { InferenceMetricsCollector } from './metrics.ts';
import { externalPrivacyForGateway } from './privacy.ts';
import { classifyInferenceRetry, retryDelayMs, shouldRetryAttempt } from './retry.ts';
import { InMemoryInferenceJobStore } from './store.ts';
import type {
  InferenceCancellationState,
  InferenceJobState,
  InferenceTimeoutKind,
  ModelQualificationState,
} from './taxonomy.ts';
import type {
  AsyncInferencePollResult,
  AsyncInferenceSubmitResult,
  DurableInferenceUsageRecord,
  InferenceJobRecord,
  StructuredInferenceRequest,
} from './types.ts';

export type AsyncInferenceExecutorOptions = {
  readonly clock: Clock;
  readonly gateway: AiModelGateway;
  readonly catalog: InferenceModelCatalog;
  readonly budgetPort: ResearchBudgetPort;
  readonly concurrency?: ConcurrencyLimits;
  readonly maxRetryAttempts?: number;
  readonly store?: InMemoryInferenceJobStore;
  readonly metrics?: InferenceMetricsCollector;
};

function idempotencyKey(request: StructuredInferenceRequest): string {
  return `${request.customerId}:${request.taskId ?? 'none'}:${request.inferenceRequestId}`;
}

function modelQualificationAllowsDispatch(state: ModelQualificationState | undefined): boolean {
  return state === 'CONFIGURED' || state === 'QUALIFIED_SANDBOX' || state === 'DEGRADED';
}

export class AsyncInferenceExecutor {
  readonly store: InMemoryInferenceJobStore;
  readonly metrics: InferenceMetricsCollector;
  private readonly clock: Clock;
  private readonly gateway: AiModelGateway;
  private readonly catalog: InferenceModelCatalog;
  private readonly budgetPort: ResearchBudgetPort;
  private readonly concurrency: ConcurrencyGate;
  private readonly maxRetryAttempts: number;
  private readonly cancelRequests = new Set<string>();
  private readonly usageRecords = new Map<string, DurableInferenceUsageRecord>();
  private shuttingDown = false;
  private active = 0;

  constructor(options: AsyncInferenceExecutorOptions) {
    this.clock = options.clock;
    this.gateway = options.gateway;
    this.catalog = options.catalog;
    this.budgetPort = options.budgetPort;
    this.concurrency = new ConcurrencyGate(options.concurrency ?? DEFAULT_CONCURRENCY_LIMITS);
    this.maxRetryAttempts = options.maxRetryAttempts ?? 3;
    this.store = options.store ?? new InMemoryInferenceJobStore();
    this.metrics = options.metrics ?? new InferenceMetricsCollector();
  }

  beginShutdown(): void {
    this.shuttingDown = true;
  }

  submit(request: StructuredInferenceRequest): AsyncInferenceSubmitResult {
    if (this.shuttingDown) {
      return { ok: false, code: 'EXECUTOR_SHUTTING_DOWN', message: 'async inference executor is shutting down' };
    }
    const existing = this.store.getByIdempotencyKey(idempotencyKey(request));
    if (existing?.state === 'COMPLETED') {
      return { ok: true, job: existing };
    }
    const model = this.catalog.get(request.modelId, request.modelVersion);
    if (!model) {
      return { ok: false, code: 'MODEL_NOT_CONFIGURED', message: 'model is not registered in catalog' };
    }
    const qualification = model.qualificationState ?? 'NOT_CONFIGURED';
    if (!modelQualificationAllowsDispatch(qualification)) {
      return { ok: false, code: 'MODEL_UNAVAILABLE', message: `model qualification state is ${qualification}` };
    }
    if (model.status === 'DISABLED') {
      return { ok: false, code: 'MODEL_UNAVAILABLE', message: 'model is disabled' };
    }
    const privacy = externalPrivacyForGateway({
      privacyClass: request.gatewayRequest.privacyClass,
      provider: request.provider,
    });
    if (!privacy.ok) {
      return { ok: false, code: 'PRIVACY_BLOCKED', message: privacy.reason };
    }
    const routed = routeInferenceModel(this.catalog, {
      purpose: request.purpose,
      privacyClass: request.gatewayRequest.privacyClass,
      requireStructuredOutput: request.responseSchema !== null && request.responseSchema !== undefined,
      requireTools: request.toolCapabilities.length > 0,
      requireStreaming: request.gatewayRequest.requireStreaming === true,
      contextTokens: 0,
      latencyPreference: request.gatewayRequest.latencyPreference ?? null,
      costCeilingMicros: request.gatewayRequest.costCeilingMicros ?? null,
      jurisdictionRef: request.gatewayRequest.jurisdictionRef,
      preferredProvider: request.provider,
      health: {},
    });
    if (!routed.ok) {
      return { ok: false, code: routed.error.code, message: routed.error.detail };
    }
    const reservationRef = request.budgetReservationRef ?? `rbr_inf_${randomUUID()}`;
    if (request.estimatedBudgetMicros && request.workOrderId) {
      const reserved = this.budgetPort.reserve({
        workOrderId: request.workOrderId,
        taskId: request.taskId,
        customerId: request.customerId,
        reservationRef,
        amountMicros: request.estimatedBudgetMicros,
        unitKind: 'MONETARY_MINOR',
      });
      if (!reserved.ok) {
        return { ok: false, code: reserved.code, message: reserved.message };
      }
    }
    const job: InferenceJobRecord = Object.freeze({
      inferenceRequestId: request.inferenceRequestId,
      taskId: request.taskId,
      workOrderId: request.workOrderId,
      customerId: request.customerId,
      provider: request.provider,
      modelId: request.modelId,
      modelVersion: request.modelVersion,
      state: 'QUEUED',
      cancellationState: null,
      timeoutKind: null,
      correlationId: request.gatewayRequest.correlationId,
      queuedAt: this.clock.now(),
      startedAt: null,
      completedAt: null,
      attempt: 0,
      result: null,
      failure: null,
      usageRecordId: null,
      budgetReservationRef: request.estimatedBudgetMicros ? reservationRef : null,
      idempotencyKey: idempotencyKey(request),
    });
    this.store.put(job);
    this.metrics.recordQueueDepth(this.concurrency.queueDepth() + 1);
    void this.dispatch(request, job.inferenceRequestId);
    return { ok: true, job };
  }

  poll(requestId: string, customerId: string): AsyncInferencePollResult {
    const job = this.store.get(requestId as StructuredInferenceRequest['inferenceRequestId']);
    if (!job || job.customerId !== customerId) {
      return { ok: false, code: 'JOB_NOT_FOUND', message: 'inference job not found for customer' };
    }
    return { ok: true, job };
  }

  requestCancel(requestId: string, customerId: string): InferenceCancellationState {
    const job = this.store.get(requestId as StructuredInferenceRequest['inferenceRequestId']);
    if (!job || job.customerId !== customerId) {
      return 'UNKNOWN';
    }
    if (job.state === 'COMPLETED') {
      return 'COMPLETED_BEFORE_CANCEL';
    }
    if (job.state === 'CANCELLED') {
      return 'CANCELLED';
    }
    this.cancelRequests.add(requestId);
    this.gateway.cancel(requestId);
    if (job.state === 'QUEUED' || job.state === 'DISPATCHING') {
      this.finalize(job.inferenceRequestId, {
        state: 'CANCELLED',
        cancellationState: 'CANCELLED',
        failure: {
          ok: false,
          code: 'MODEL_CANCELLED',
          detail: 'inference cancelled before dispatch',
          providerKind: job.provider,
        },
      });
      return 'CANCELLED';
    }
    this.store.update(job.inferenceRequestId, { cancellationState: 'CANCEL_REQUESTED' });
    return 'CANCEL_REQUESTED';
  }

  getUsageRecord(usageRecordId: string): DurableInferenceUsageRecord | null {
    return this.usageRecords.get(usageRecordId) ?? null;
  }

  usageSnapshot(): readonly DurableInferenceUsageRecord[] {
    return Object.freeze([...this.usageRecords.values()]);
  }

  private async dispatch(request: StructuredInferenceRequest, requestId: StructuredInferenceRequest['inferenceRequestId']): Promise<void> {
    const current = this.store.get(requestId);
    if (!current || current.state !== 'QUEUED') return;
    if (this.cancelRequests.has(requestId)) return;
    this.store.update(requestId, { state: 'DISPATCHING', startedAt: this.clock.now() });
    const release = await this.concurrency.acquire({
      provider: request.provider,
      model: `${request.modelId}@${request.modelVersion}`,
      customerId: request.customerId,
      workOrderId: request.workOrderId,
    });
    this.active += 1;
    this.metrics.recordActive(this.active);
    this.metrics.recordQueueDepth(this.concurrency.queueDepth());
    this.store.update(requestId, { state: 'IN_FLIGHT' });
    const started = Date.now();
    let attempt = 0;
    let lastFailure: AiProviderFailure | null = null;
    while (attempt < this.maxRetryAttempts) {
      attempt += 1;
      this.store.update(requestId, { attempt });
      if (this.cancelRequests.has(requestId)) {
        release();
        this.active -= 1;
        this.finalize(requestId, {
          state: 'CANCELLED',
          cancellationState: 'CANCELLED',
          failure: {
            ok: false,
            code: 'MODEL_CANCELLED',
            detail: 'inference cancelled in flight',
            providerKind: request.provider,
          },
        });
        return;
      }
      const timeoutFailure = this.checkTimeouts(request, started);
      if (timeoutFailure) {
        release();
        this.active -= 1;
        this.finalize(requestId, timeoutFailure);
        return;
      }
      const result = await Promise.resolve().then(() => this.gateway.infer(request.gatewayRequest));
      if (result.ok) {
        release();
        this.active -= 1;
        const usageRecord = this.recordUsage(request, result.value, started, false);
        if (request.budgetReservationRef ?? current.budgetReservationRef) {
          const reservationRef = (request.budgetReservationRef ?? current.budgetReservationRef)!;
          const reservedAmount = request.estimatedBudgetMicros ?? '0';
          const actualMicros =
            usageRecord.costStatus === 'UNKNOWN' || !usageRecord.estimatedCostMicros || usageRecord.estimatedCostMicros === '0'
              ? reservedAmount
              : usageRecord.estimatedCostMicros;
          this.budgetPort.reconcile({
            reservationRef,
            actualMicros,
            estimatedMicros: usageRecord.estimatedCostMicros,
            costStatus: usageRecord.costStatus,
            succeeded: true,
            cancelled: false,
          });
        }
        this.finalize(requestId, {
          state: 'COMPLETED',
          result: result.value,
          usageRecordId: usageRecord.usageRecordId,
        });
        this.metrics.recordCompletion({
          latencyMs: Date.now() - started,
          inputTokens: usageRecord.inputTokens ?? 0,
          outputTokens: usageRecord.outputTokens ?? 0,
          spendMicros: usageRecord.estimatedCostMicros ?? '0',
        });
        return;
      }
      lastFailure = result.error;
      const retryCategory = classifyInferenceRetry(result.error.code);
      const retried = shouldRetryAttempt({ category: retryCategory, attempt, maxAttempts: this.maxRetryAttempts });
      if (result.error.code === 'MODEL_RATE_LIMITED') {
        this.metrics.recordCompletion({
          latencyMs: Date.now() - started,
          inputTokens: 0,
          outputTokens: 0,
          spendMicros: '0',
          rateLimited: true,
          retried,
        });
      }
      if (!retried) break;
      this.metrics.recordCompletion({
        latencyMs: 0,
        inputTokens: 0,
        outputTokens: 0,
        spendMicros: '0',
        retried: true,
      });
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs(attempt)));
    }
    release();
    this.active -= 1;
    const cancellationState = this.resolveCancellationAfterFailure(requestId, lastFailure);
    const state: InferenceJobState =
      lastFailure?.code === 'MODEL_UNAVAILABLE' || lastFailure?.code === 'PROVIDER_UNAVAILABLE'
        ? 'PROVIDER_UNAVAILABLE'
        : lastFailure?.code === 'MODEL_TIMEOUT' || lastFailure?.code === 'PROVIDER_TIMEOUT'
          ? 'TIMED_OUT'
          : 'FAILED';
    const timeoutKind: InferenceTimeoutKind | null =
      state === 'TIMED_OUT' ? 'PROVIDER_PROCESSING' : null;
    if (current.budgetReservationRef) {
      this.budgetPort.reconcile({
        reservationRef: current.budgetReservationRef,
        actualMicros: '0',
        estimatedMicros: null,
        costStatus: 'UNKNOWN',
        succeeded: false,
        cancelled: cancellationState === 'CANCELLED',
      });
    }
    this.finalize(requestId, {
      state,
      cancellationState,
      timeoutKind,
      failure: lastFailure,
    });
    this.metrics.recordCompletion({
      latencyMs: Date.now() - started,
      inputTokens: 0,
      outputTokens: 0,
      spendMicros: '0',
      failed: true,
      providerError: lastFailure?.code === 'MODEL_UNAVAILABLE' || lastFailure?.code === 'PROVIDER_UNAVAILABLE',
      cancelled: cancellationState === 'CANCELLED',
      timedOut: state === 'TIMED_OUT',
    });
  }

  private checkTimeouts(
    request: StructuredInferenceRequest,
    startedMs: number,
  ): Partial<InferenceJobRecord> & { readonly state: InferenceJobState } | null {
    const elapsed = Date.now() - startedMs;
    if (elapsed > request.processingTimeoutMs) {
      return {
        state: 'TIMED_OUT',
        timeoutKind: 'PROVIDER_PROCESSING',
        cancellationState: null,
        failure: {
          ok: false,
          code: 'MODEL_TIMEOUT',
          detail: 'provider processing timeout exceeded',
          providerKind: request.provider,
        },
      };
    }
    if (request.taskDeadline && this.clock.now() > request.taskDeadline) {
      return {
        state: 'TIMED_OUT',
        timeoutKind: 'TASK_DEADLINE',
        cancellationState: null,
        failure: {
          ok: false,
          code: 'MODEL_TIMEOUT',
          detail: 'task deadline exceeded',
          providerKind: request.provider,
        },
      };
    }
    if (request.workOrderHorizon && this.clock.now() > request.workOrderHorizon) {
      return {
        state: 'TIMED_OUT',
        timeoutKind: 'WORK_ORDER_HORIZON',
        cancellationState: null,
        failure: {
          ok: false,
          code: 'MODEL_TIMEOUT',
          detail: 'work order horizon exceeded',
          providerKind: request.provider,
        },
      };
    }
    return null;
  }

  private resolveCancellationAfterFailure(
    requestId: string,
    failure: AiProviderFailure | null,
  ): InferenceCancellationState | null {
    if (!this.cancelRequests.has(requestId)) return null;
    if (failure?.code === 'MODEL_CANCELLED') return 'CANCELLED';
    return 'PROVIDER_CANNOT_CANCEL';
  }

  private recordUsage(
    request: StructuredInferenceRequest,
    gatewayResult: import('../gateway.ts').AiGatewayResult,
    startedMs: number,
    cancelled: boolean,
  ): DurableInferenceUsageRecord {
    const usage = gatewayResult.usage;
    const inputTokens = usage?.inputTokens ?? gatewayResult.response?.usage.promptTokens ?? null;
    const outputTokens = usage?.outputTokens ?? gatewayResult.response?.usage.completionTokens ?? null;
    const estimatedCostMicros = usage?.estimatedCostMicros ?? null;
    const costStatus =
      estimatedCostMicros && estimatedCostMicros !== '0' ? 'ESTIMATED' : 'UNKNOWN';
    const record: DurableInferenceUsageRecord = Object.freeze({
      usageRecordId: `iur_${randomUUID()}`,
      inferenceRequestId: request.inferenceRequestId,
      taskId: request.taskId,
      workOrderId: request.workOrderId,
      customerId: request.customerId,
      provider: request.provider,
      model: `${request.modelId}@${request.modelVersion}`,
      providerRequestId: request.gatewayRequest.correlationId,
      inputTokens,
      outputTokens,
      cachedTokens: null,
      requestCount: 1,
      durationMs: Date.now() - startedMs,
      providerReportedCostMicros: null,
      estimatedCostMicros,
      currency: estimatedCostMicros ? 'USD' : null,
      costStatus,
      succeeded: !cancelled && gatewayResult.response !== null,
      cancelled,
      cancellationState: cancelled ? 'CANCELLED' : null,
      recordedAt: this.clock.now(),
    });
    this.usageRecords.set(record.usageRecordId, record);
    return record;
  }

  private finalize(requestId: StructuredInferenceRequest['inferenceRequestId'], patch: Partial<InferenceJobRecord>): void {
    this.store.update(requestId, {
      ...patch,
      completedAt: this.clock.now(),
    });
    this.metrics.recordActive(this.active);
    this.metrics.recordQueueDepth(this.concurrency.queueDepth());
  }
}
