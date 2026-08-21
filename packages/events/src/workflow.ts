import { randomUUID } from 'node:crypto';

import { classifyFailure, type RetryClass } from './retry.ts';
import type { TraceContext } from './trace.ts';

/**
 * Persisted multi-step workflow. Not a generic BPM product.
 *
 * Practical states for later regulated flows (international transfer,
 * KYC, Agent approval, investment execution, Exchange withdrawal).
 * A workflow cannot post a journal or issue Execution Authority.
 */

export const WORKFLOW_CAN_POST_JOURNAL = false as const;
export const WORKFLOW_CAN_ISSUE_EXECUTION_AUTHORITY = false as const;

export const WORKFLOW_STATES = [
  'PENDING',
  'RUNNING',
  'WAITING_HUMAN',
  'WAITING_COMPLIANCE',
  'WAITING_PROVIDER',
  'COMPENSATING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
] as const;

export type WorkflowState = (typeof WORKFLOW_STATES)[number];

export const WORKFLOW_STEP_KINDS = [
  'TASK',
  'WAIT_HUMAN',
  'WAIT_COMPLIANCE',
  'WAIT_PROVIDER',
  'COMPENSATE',
] as const;

export type WorkflowStepKind = (typeof WORKFLOW_STEP_KINDS)[number];

export type WorkflowHistoryEntry = {
  readonly at: string;
  readonly step: string;
  readonly kind: WorkflowStepKind;
  readonly result: 'ADVANCED' | 'WAITING' | 'FAILED' | 'COMPENSATED' | 'RESUMED';
  readonly errorClass: RetryClass | null;
  readonly detail: string;
};

export type WorkflowRecord = {
  readonly workflowId: string;
  readonly workflowType: string;
  readonly state: WorkflowState;
  readonly currentStep: string;
  readonly history: readonly WorkflowHistoryEntry[];
  readonly context: Readonly<Record<string, string>>;
  readonly correlationId: string;
  readonly causationId: string | null;
  readonly requestId: string | null;
  readonly waitingSince: string | null;
  readonly timeoutAt: string | null;
  readonly attemptCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type WorkflowStepResult =
  | { readonly outcome: 'CONTINUE'; readonly context?: Readonly<Record<string, string>> }
  | {
      readonly outcome: 'WAIT';
      readonly wait: 'HUMAN' | 'COMPLIANCE' | 'PROVIDER';
      readonly timeoutMs?: number;
      readonly context?: Readonly<Record<string, string>>;
    }
  | { readonly outcome: 'COMPENSATE'; readonly reason: string }
  | { readonly outcome: 'FAIL'; readonly error: unknown };

export type WorkflowStepHandler = (record: WorkflowRecord) => Promise<WorkflowStepResult> | WorkflowStepResult;

export type WorkflowStepDefinition = {
  readonly name: string;
  readonly kind: WorkflowStepKind;
  readonly run?: WorkflowStepHandler;
  readonly compensate?: WorkflowStepHandler;
  readonly timeoutMs?: number;
};

export type WorkflowDefinition = {
  readonly workflowType: string;
  readonly steps: readonly WorkflowStepDefinition[];
};

export type WorkflowStore = {
  insert(record: WorkflowRecord): Promise<void>;
  save(record: WorkflowRecord): Promise<void>;
  get(workflowId: string): Promise<WorkflowRecord | undefined>;
  list(state?: WorkflowState): Promise<readonly WorkflowRecord[]>;
  snapshot(): Promise<readonly WorkflowRecord[]>;
  restore(rows: readonly WorkflowRecord[]): Promise<void>;
};

export type WorkflowClock = {
  now(): string;
  nowMs(): number;
};

export class InMemoryWorkflowStore implements WorkflowStore {
  private rows = new Map<string, WorkflowRecord>();

  async insert(record: WorkflowRecord): Promise<void> {
    if (this.rows.has(record.workflowId)) {
      return;
    }
    this.rows.set(record.workflowId, record);
  }

  async save(record: WorkflowRecord): Promise<void> {
    this.rows.set(record.workflowId, record);
  }

  async get(workflowId: string): Promise<WorkflowRecord | undefined> {
    return this.rows.get(workflowId);
  }

  async list(state?: WorkflowState): Promise<readonly WorkflowRecord[]> {
    return [...this.rows.values()].filter((row) => !state || row.state === state);
  }

  async snapshot(): Promise<readonly WorkflowRecord[]> {
    return [...this.rows.values()];
  }

  async restore(rows: readonly WorkflowRecord[]): Promise<void> {
    this.rows = new Map(rows.map((row) => [row.workflowId, row]));
  }
}

export class WorkflowRuntime {
  private readonly store: WorkflowStore;
  private readonly clock: WorkflowClock;
  private readonly definitions = new Map<string, WorkflowDefinition>();

  constructor(store: WorkflowStore, clock: WorkflowClock) {
    this.store = store;
    this.clock = clock;
  }

  register(definition: WorkflowDefinition): void {
    if (definition.steps.length === 0) {
      throw new Error('workflow must have at least one step');
    }
    this.definitions.set(definition.workflowType, definition);
  }

  async start(input: {
    readonly workflowType: string;
    readonly workflowId?: string;
    readonly context?: Readonly<Record<string, string>>;
    readonly trace?: TraceContext;
  }): Promise<WorkflowRecord> {
    const definition = this.requireDefinition(input.workflowType);
    const now = this.clock.now();
    const first = definition.steps[0]!;
    const record: WorkflowRecord = {
      workflowId: input.workflowId ?? `wf_${randomUUID()}`,
      workflowType: input.workflowType,
      state: 'PENDING',
      currentStep: first.name,
      history: [],
      context: Object.freeze({ ...(input.context ?? {}) }),
      correlationId: input.trace?.correlationId ?? input.workflowId ?? `wf_${randomUUID()}`,
      causationId: input.trace?.causationId ?? null,
      requestId: input.trace?.requestId ?? null,
      waitingSince: null,
      timeoutAt: null,
      attemptCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    await this.store.insert(record);
    return this.advance(record.workflowId);
  }

  async resume(workflowId: string, signal?: Readonly<Record<string, string>>): Promise<WorkflowRecord> {
    const current = await this.requireRecord(workflowId);
    if (current.state === 'COMPLETED' || current.state === 'FAILED' || current.state === 'CANCELLED') {
      return current;
    }
    const definition = this.requireDefinition(current.workflowType);
    const nextContext = signal ? Object.freeze({ ...current.context, ...signal }) : current.context;
    let currentStep = current.currentStep;
    if (current.state.startsWith('WAITING')) {
      const index = definition.steps.findIndex((step) => step.name === current.currentStep);
      const following = definition.steps[index + 1];
      currentStep = following?.name ?? current.currentStep;
    }
    const resumed: WorkflowRecord = {
      ...current,
      currentStep,
      context: nextContext,
      state: 'RUNNING',
      history: [
        ...current.history,
        {
          at: this.clock.now(),
          step: current.currentStep,
          kind: this.stepKind(current),
          result: 'RESUMED',
          errorClass: null,
          detail: 'resume after wait or process restart',
        },
      ],
      waitingSince: null,
      timeoutAt: null,
      updatedAt: this.clock.now(),
    };
    await this.store.save(resumed);
    if (current.state.startsWith('WAITING') && currentStep === current.currentStep) {
      return this.write(resumed, {
        state: 'COMPLETED',
        historyResult: 'ADVANCED',
        detail: 'wait was the final step',
      });
    }
    return this.advance(workflowId);
  }

  async cancel(workflowId: string): Promise<WorkflowRecord> {
    const current = await this.requireRecord(workflowId);
    const next: WorkflowRecord = {
      ...current,
      state: 'CANCELLED',
      updatedAt: this.clock.now(),
    };
    await this.store.save(next);
    return next;
  }

  async get(workflowId: string): Promise<WorkflowRecord | undefined> {
    return this.store.get(workflowId);
  }

  private async advance(workflowId: string): Promise<WorkflowRecord> {
    let current = await this.requireRecord(workflowId);
    const definition = this.requireDefinition(current.workflowType);
    let guard = 0;
    while (guard < 32) {
      guard += 1;
      if (
        current.state === 'COMPLETED' ||
        current.state === 'FAILED' ||
        current.state === 'CANCELLED' ||
        current.state === 'WAITING_HUMAN' ||
        current.state === 'WAITING_COMPLIANCE' ||
        current.state === 'WAITING_PROVIDER'
      ) {
        return current;
      }
      if (current.timeoutAt && current.timeoutAt <= this.clock.now()) {
        current = await this.fail(current, 'WORKFLOW_TIMEOUT', 'RETRYABLE', 'step timed out');
        return current;
      }
      const step = definition.steps.find((item) => item.name === current.currentStep);
      if (!step) {
        current = await this.fail(current, 'UNKNOWN_STEP', 'NON_RETRYABLE', current.currentStep);
        return current;
      }
      if (step.kind === 'WAIT_HUMAN' || step.kind === 'WAIT_COMPLIANCE' || step.kind === 'WAIT_PROVIDER') {
        current = await this.enterWait(current, step);
        return current;
      }
      if (step.kind === 'COMPENSATE') {
        if (step.compensate) {
          await step.compensate(current);
        }
        current = await this.write(current, {
          state: 'FAILED',
          historyResult: 'COMPENSATED',
          detail: 'compensation hook executed',
        });
        return current;
      }
      try {
        const result = step.run ? await step.run(current) : { outcome: 'CONTINUE' as const };
        current = await this.applyResult(current, definition, step, result);
      } catch (error) {
        const failure = classifyFailure(error);
        current = await this.fail(current, failure.code, failure.retryClass, failure.message);
        return current;
      }
    }
    return current;
  }

  private async applyResult(
    current: WorkflowRecord,
    definition: WorkflowDefinition,
    step: WorkflowStepDefinition,
    result: WorkflowStepResult,
  ): Promise<WorkflowRecord> {
    if (result.outcome === 'WAIT') {
      const waitState =
        result.wait === 'HUMAN'
          ? 'WAITING_HUMAN'
          : result.wait === 'COMPLIANCE'
            ? 'WAITING_COMPLIANCE'
            : 'WAITING_PROVIDER';
      return this.write(current, {
        state: waitState,
        ...(result.context ? { context: result.context } : {}),
        historyResult: 'WAITING',
        detail: `waiting for ${result.wait.toLowerCase()}`,
        waitingSince: this.clock.now(),
        timeoutAt:
          result.timeoutMs !== undefined
            ? new Date(this.clock.nowMs() + result.timeoutMs).toISOString()
            : step.timeoutMs !== undefined
              ? new Date(this.clock.nowMs() + step.timeoutMs).toISOString()
              : null,
      });
    }
    if (result.outcome === 'COMPENSATE') {
      const compensate = [...definition.steps].reverse().find((item) => item.kind === 'COMPENSATE');
      return this.write(current, {
        state: 'COMPENSATING',
        currentStep: compensate?.name ?? step.name,
        historyResult: 'FAILED',
        detail: result.reason,
      });
    }
    if (result.outcome === 'FAIL') {
      const failure = classifyFailure(result.error);
      return this.fail(current, failure.code, failure.retryClass, failure.message);
    }
    const index = definition.steps.findIndex((item) => item.name === step.name);
    const nextStep = definition.steps[index + 1];
    if (!nextStep) {
      return this.write(current, {
        state: 'COMPLETED',
        ...(result.context ? { context: result.context } : {}),
        historyResult: 'ADVANCED',
        detail: 'final step completed',
      });
    }
    return this.write(current, {
      state: 'RUNNING',
      currentStep: nextStep.name,
      ...(result.context ? { context: result.context } : {}),
      historyResult: 'ADVANCED',
      detail: `advanced to ${nextStep.name}`,
    });
  }

  private async enterWait(current: WorkflowRecord, step: WorkflowStepDefinition): Promise<WorkflowRecord> {
    const waitState =
      step.kind === 'WAIT_HUMAN'
        ? 'WAITING_HUMAN'
        : step.kind === 'WAIT_COMPLIANCE'
          ? 'WAITING_COMPLIANCE'
          : 'WAITING_PROVIDER';
    return this.write(current, {
      state: waitState,
      historyResult: 'WAITING',
      detail: `entered ${step.kind}`,
      waitingSince: this.clock.now(),
      timeoutAt:
        step.timeoutMs !== undefined ? new Date(this.clock.nowMs() + step.timeoutMs).toISOString() : null,
    });
  }

  private async fail(
    current: WorkflowRecord,
    code: string,
    retryClass: RetryClass,
    message: string,
  ): Promise<WorkflowRecord> {
    return this.write(current, {
      state: 'FAILED',
      historyResult: 'FAILED',
      detail: `${code}: ${message}`,
      errorClass: retryClass,
    });
  }

  private async write(
    current: WorkflowRecord,
    patch: {
      readonly state: WorkflowState;
      readonly currentStep?: string;
      readonly context?: Readonly<Record<string, string>>;
      readonly historyResult: WorkflowHistoryEntry['result'];
      readonly detail: string;
      readonly errorClass?: RetryClass | null;
      readonly waitingSince?: string | null;
      readonly timeoutAt?: string | null;
    },
  ): Promise<WorkflowRecord> {
    const next: WorkflowRecord = {
      ...current,
      state: patch.state,
      currentStep: patch.currentStep ?? current.currentStep,
      context: patch.context ? Object.freeze({ ...current.context, ...patch.context }) : current.context,
      history: [
        ...current.history,
        {
          at: this.clock.now(),
          step: current.currentStep,
          kind: this.stepKind(current),
          result: patch.historyResult,
          errorClass: patch.errorClass ?? null,
          detail: patch.detail,
        },
      ],
      waitingSince: patch.waitingSince !== undefined ? patch.waitingSince : current.waitingSince,
      timeoutAt: patch.timeoutAt !== undefined ? patch.timeoutAt : current.timeoutAt,
      attemptCount: current.attemptCount + 1,
      updatedAt: this.clock.now(),
    };
    await this.store.save(next);
    return next;
  }

  private stepKind(record: WorkflowRecord): WorkflowStepKind {
    const definition = this.definitions.get(record.workflowType);
    return definition?.steps.find((step) => step.name === record.currentStep)?.kind ?? 'TASK';
  }

  private requireDefinition(workflowType: string): WorkflowDefinition {
    const definition = this.definitions.get(workflowType);
    if (!definition) {
      throw new Error(`unknown workflow type ${workflowType}`);
    }
    return definition;
  }

  private async requireRecord(workflowId: string): Promise<WorkflowRecord> {
    const record = await this.store.get(workflowId);
    if (!record) {
      throw new Error(`unknown workflow ${workflowId}`);
    }
    return record;
  }
}
