import { randomUUID } from 'node:crypto';

import { DEFAULT_RETRY_POLICY, nextAttemptDelayMs, type RetryPolicy } from './delivery.ts';
import { classifyFailure, holdsForOperator, shouldRetry, type RetryClass } from './retry.ts';
import type { TraceContext } from './trace.ts';

/**
 * Persistent job queue. A Node process restart must not drop a
 * production-critical job. Jobs are not Execution Authority and cannot
 * post journals.
 */

export const JOB_CAN_ISSUE_EXECUTION_AUTHORITY = false as const;
export const JOB_CAN_POST_JOURNAL = false as const;
export const JOB_CAN_OPEN_ACCOUNT = false as const;

export const JOB_STATES = [
  'PENDING',
  'SCHEDULED',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'DEAD_LETTER',
  'CANCELLED',
] as const;

export type JobState = (typeof JOB_STATES)[number];

export const FORBIDDEN_JOB_TYPES = [
  'ISSUE_EXECUTION_AUTHORITY',
  'POST_JOURNAL',
  'OPEN_ACCOUNT',
  'AGENT_PRIVILEGED_MUTATION',
] as const;

export type ForbiddenJobType = (typeof FORBIDDEN_JOB_TYPES)[number];

export type JobRecord = {
  readonly jobId: string;
  readonly jobType: string;
  readonly state: JobState;
  readonly payload: Readonly<Record<string, string>>;
  readonly scheduledAt: string;
  readonly availableAt: string;
  readonly attemptCount: number;
  readonly maxAttempts: number;
  readonly timeoutMs: number;
  readonly lastAttemptAt: string | null;
  readonly lastErrorClass: RetryClass | null;
  readonly lastErrorSafe: string | null;
  readonly correlationId: string;
  readonly causationId: string | null;
  readonly requestId: string | null;
  readonly lockedBy: string | null;
  readonly lockedAt: string | null;
  readonly cancelledAt: string | null;
  readonly completedAt: string | null;
  readonly createdAt: string;
};

export type JobDraft = {
  readonly jobId?: string;
  readonly jobType: string;
  readonly payload?: Readonly<Record<string, string>>;
  readonly runAt?: string;
  readonly timeoutMs?: number;
  readonly maxAttempts?: number;
  readonly trace?: TraceContext;
};

export type JobHandler = (job: JobRecord) => Promise<void> | void;

export type JobClock = {
  now(): string;
  nowMs(): number;
};

export type JobStore = {
  enqueue(job: JobRecord): Promise<void>;
  claimDue(input: {
    readonly now: string;
    readonly workerId: string;
    readonly limit: number;
    readonly leaseMs: number;
  }): Promise<readonly JobRecord[]>;
  markSucceeded(jobId: string, now: string): Promise<void>;
  markRetry(input: {
    readonly jobId: string;
    readonly attemptCount: number;
    readonly availableAt: string;
    readonly lastAttemptAt: string;
    readonly errorClass: RetryClass;
    readonly message: string;
    readonly state: 'PENDING' | 'FAILED';
  }): Promise<void>;
  markDeadLetter(input: {
    readonly jobId: string;
    readonly lastAttemptAt: string;
    readonly errorClass: RetryClass;
    readonly message: string;
  }): Promise<void>;
  cancel(jobId: string, now: string): Promise<void>;
  replay(jobId: string, now: string): Promise<void>;
  get(jobId: string): Promise<JobRecord | undefined>;
  list(state?: JobState): Promise<readonly JobRecord[]>;
  snapshot(): Promise<readonly JobRecord[]>;
  restore(rows: readonly JobRecord[]): Promise<void>;
};

export class PrivilegedJobRefusedError extends Error {
  readonly reasonCode = 'PRIVILEGED_JOB_REFUSED';
  readonly retryClass = 'NON_RETRYABLE' as const;
  readonly jobType: string;

  constructor(jobType: string) {
    super(`job type '${jobType}' cannot issue Execution Authority or mutate the ledger`);
    this.name = 'PrivilegedJobRefusedError';
    this.jobType = jobType;
  }
}

export function assertJobNotPrivileged(jobType: string): void {
  if ((FORBIDDEN_JOB_TYPES as readonly string[]).includes(jobType)) {
    throw new PrivilegedJobRefusedError(jobType);
  }
  if (/execution.?authority|post.?journal|open.?account/i.test(jobType)) {
    throw new PrivilegedJobRefusedError(jobType);
  }
}

export class JobTimeoutError extends Error {
  readonly reasonCode = 'JOB_TIMEOUT';
  readonly retryClass = 'RETRYABLE' as const;

  constructor(jobId: string, timeoutMs: number) {
    super(`job ${jobId} exceeded timeout ${String(timeoutMs)}ms`);
    this.name = 'JobTimeoutError';
  }
}

export class InMemoryJobStore implements JobStore {
  private rows = new Map<string, JobRecord>();

  async enqueue(job: JobRecord): Promise<void> {
    if (this.rows.has(job.jobId)) {
      return;
    }
    this.rows.set(job.jobId, job);
  }

  async claimDue(input: {
    readonly now: string;
    readonly workerId: string;
    readonly limit: number;
    readonly leaseMs: number;
  }): Promise<readonly JobRecord[]> {
    const claimed: JobRecord[] = [];
    const leaseCutoff = new Date(new Date(input.now).getTime() - input.leaseMs).toISOString();
    for (const row of this.rows.values()) {
      if (claimed.length >= input.limit) {
        break;
      }
      if (row.state === 'SUCCEEDED' || row.state === 'CANCELLED' || row.state === 'DEAD_LETTER') {
        continue;
      }
      const expiredLease =
        row.state === 'RUNNING' && (row.lockedAt === null || row.lockedAt <= leaseCutoff);
      const due =
        (row.state === 'PENDING' || row.state === 'SCHEDULED' || row.state === 'FAILED') &&
        row.availableAt <= input.now;
      if (!due && !expiredLease) {
        continue;
      }
      const next: JobRecord = {
        ...row,
        state: 'RUNNING',
        lockedBy: input.workerId,
        lockedAt: input.now,
      };
      this.rows.set(row.jobId, next);
      claimed.push(next);
    }
    return claimed;
  }

  async markSucceeded(jobId: string, now: string): Promise<void> {
    const row = this.rows.get(jobId);
    if (!row) {
      return;
    }
    this.rows.set(jobId, {
      ...row,
      state: 'SUCCEEDED',
      completedAt: now,
      lockedBy: null,
      lockedAt: null,
    });
  }

  async markRetry(input: {
    readonly jobId: string;
    readonly attemptCount: number;
    readonly availableAt: string;
    readonly lastAttemptAt: string;
    readonly errorClass: RetryClass;
    readonly message: string;
    readonly state: 'PENDING' | 'FAILED';
  }): Promise<void> {
    const row = this.rows.get(input.jobId);
    if (!row) {
      return;
    }
    this.rows.set(input.jobId, {
      ...row,
      state: input.state,
      attemptCount: input.attemptCount,
      availableAt: input.availableAt,
      lastAttemptAt: input.lastAttemptAt,
      lastErrorClass: input.errorClass,
      lastErrorSafe: input.message,
      lockedBy: null,
      lockedAt: null,
    });
  }

  async markDeadLetter(input: {
    readonly jobId: string;
    readonly lastAttemptAt: string;
    readonly errorClass: RetryClass;
    readonly message: string;
  }): Promise<void> {
    const row = this.rows.get(input.jobId);
    if (!row) {
      return;
    }
    this.rows.set(input.jobId, {
      ...row,
      state: 'DEAD_LETTER',
      lastAttemptAt: input.lastAttemptAt,
      lastErrorClass: input.errorClass,
      lastErrorSafe: input.message,
      lockedBy: null,
      lockedAt: null,
    });
  }

  async cancel(jobId: string, now: string): Promise<void> {
    const row = this.rows.get(jobId);
    if (!row || row.state === 'SUCCEEDED' || row.state === 'DEAD_LETTER') {
      return;
    }
    this.rows.set(jobId, {
      ...row,
      state: 'CANCELLED',
      cancelledAt: now,
      lockedBy: null,
      lockedAt: null,
    });
  }

  async replay(jobId: string, now: string): Promise<void> {
    const row = this.rows.get(jobId);
    if (!row) {
      return;
    }
    this.rows.set(jobId, {
      ...row,
      state: 'PENDING',
      availableAt: now,
      lockedBy: null,
      lockedAt: null,
      completedAt: null,
      cancelledAt: null,
    });
  }

  async get(jobId: string): Promise<JobRecord | undefined> {
    return this.rows.get(jobId);
  }

  async list(state?: JobState): Promise<readonly JobRecord[]> {
    return [...this.rows.values()].filter((row) => !state || row.state === state);
  }

  async snapshot(): Promise<readonly JobRecord[]> {
    return [...this.rows.values()];
  }

  async restore(rows: readonly JobRecord[]): Promise<void> {
    this.rows = new Map(rows.map((row) => [row.jobId, row]));
  }
}

export class PersistentJobQueue {
  private readonly store: JobStore;
  private readonly handlers = new Map<string, JobHandler>();
  private readonly clock: JobClock;
  private readonly policy: RetryPolicy;
  private readonly workerId: string;

  constructor(input: {
    readonly store: JobStore;
    readonly clock: JobClock;
    readonly workerId: string;
    readonly policy?: RetryPolicy;
  }) {
    this.store = input.store;
    this.clock = input.clock;
    this.workerId = input.workerId;
    this.policy = input.policy ?? DEFAULT_RETRY_POLICY;
  }

  register(jobType: string, handler: JobHandler): void {
    assertJobNotPrivileged(jobType);
    this.handlers.set(jobType, handler);
  }

  async enqueue(draft: JobDraft): Promise<JobRecord> {
    assertJobNotPrivileged(draft.jobType);
    const now = this.clock.now();
    const runAt = draft.runAt ?? now;
    const jobId = draft.jobId ?? `job_${randomUUID()}`;
    const job: JobRecord = {
      jobId,
      jobType: draft.jobType,
      state: runAt > now ? 'SCHEDULED' : 'PENDING',
      payload: Object.freeze({ ...(draft.payload ?? {}) }),
      scheduledAt: runAt,
      availableAt: runAt,
      attemptCount: 0,
      maxAttempts: draft.maxAttempts ?? this.policy.maxAttempts,
      timeoutMs: draft.timeoutMs ?? 5_000,
      lastAttemptAt: null,
      lastErrorClass: null,
      lastErrorSafe: null,
      correlationId: draft.trace?.correlationId ?? jobId,
      causationId: draft.trace?.causationId ?? null,
      requestId: draft.trace?.requestId ?? null,
      lockedBy: null,
      lockedAt: null,
      cancelledAt: null,
      completedAt: null,
      createdAt: now,
    };
    await this.store.enqueue(job);
    return job;
  }

  async cancel(jobId: string): Promise<void> {
    await this.store.cancel(jobId, this.clock.now());
  }

  async replay(jobId: string): Promise<void> {
    await this.store.replay(jobId, this.clock.now());
  }

  async dispatchOnce(limit = 20): Promise<{
    succeeded: number;
    retried: number;
    deadLettered: number;
  }> {
    const claimed = await this.store.claimDue({
      now: this.clock.now(),
      workerId: this.workerId,
      limit,
      leaseMs: 5_000,
    });
    let succeeded = 0;
    let retried = 0;
    let deadLettered = 0;
    for (const job of claimed) {
      const outcome = await this.runClaimed(job);
      if (outcome === 'SUCCEEDED') {
        succeeded += 1;
      } else if (outcome === 'DEAD_LETTER') {
        deadLettered += 1;
      } else {
        retried += 1;
      }
    }
    return { succeeded, retried, deadLettered };
  }

  private async runClaimed(job: JobRecord): Promise<'SUCCEEDED' | 'RETRY' | 'DEAD_LETTER'> {
    const handler = this.handlers.get(job.jobType);
    const attemptCount = job.attemptCount + 1;
    try {
      if (!handler) {
        throw new Error(`no handler registered for ${job.jobType}`);
      }
      await withTimeout(handler(job), job.timeoutMs, job.jobId);
      await this.store.markSucceeded(job.jobId, this.clock.now());
      return 'SUCCEEDED';
    } catch (error) {
      const failure = classifyFailure(error);
      const exhausted = attemptCount >= job.maxAttempts;
      if (!shouldRetry(failure) || holdsForOperator(failure) || exhausted) {
        await this.store.markDeadLetter({
          jobId: job.jobId,
          lastAttemptAt: this.clock.now(),
          errorClass: failure.retryClass,
          message: failure.message,
        });
        return 'DEAD_LETTER';
      }
      const delay = nextAttemptDelayMs(attemptCount, this.policy);
      await this.store.markRetry({
        jobId: job.jobId,
        attemptCount,
        availableAt: new Date(this.clock.nowMs() + delay).toISOString(),
        lastAttemptAt: this.clock.now(),
        errorClass: failure.retryClass,
        message: failure.message,
        state: 'FAILED',
      });
      return 'RETRY';
    }
  }
}

function withTimeout<T>(work: Promise<T> | T, timeoutMs: number, jobId: string): Promise<T> {
  if (timeoutMs <= 0) {
    return Promise.resolve(work);
  }
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new JobTimeoutError(jobId, timeoutMs));
    }, timeoutMs);
    Promise.resolve(work).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
