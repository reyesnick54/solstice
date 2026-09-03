/**
 * Scheduled provider refresh with jitter and idempotent job enqueue.
 */

import { createHash } from 'node:crypto';

import type { JobDraft, JobRecord, JobStore } from '../../../../events/src/jobs.ts';
import { PersistentJobQueue } from '../../../../events/src/jobs.ts';

import { buildRefreshJobId } from './keys.ts';
import type {
  DataDeliveryClock,
  RefreshFailureRecord,
  RefreshScheduleEntry,
} from './types.ts';
import { PROVIDER_REFRESH_JOB_TYPE } from './types.ts';

export type SchedulerEnqueueResult = {
  readonly enqueued: readonly JobRecord[];
  readonly skippedDuplicate: number;
};

export class ProviderRefreshScheduler {
  private readonly schedules: readonly RefreshScheduleEntry[];
  private readonly jobQueue: PersistentJobQueue;
  private readonly clock: DataDeliveryClock;
  private readonly rng: () => number;
  private readonly recentJobIds = new Set<string>();
  private readonly failureRecords: RefreshFailureRecord[] = [];

  constructor(input: {
    readonly schedules: readonly RefreshScheduleEntry[];
    readonly jobStore: JobStore;
    readonly clock: DataDeliveryClock;
    readonly workerId?: string | undefined;
    readonly rng?: () => number | undefined;
  }) {
    this.schedules = input.schedules;
    this.clock = input.clock;
    this.rng = input.rng ?? Math.random;
    this.jobQueue = new PersistentJobQueue({
      store: input.jobStore,
      clock: {
        now: () => input.clock.nowUtc(),
        nowMs: () => input.clock.nowMs(),
      },
      workerId: input.workerId ?? 'provider-refresh-scheduler',
    });
  }

  registerHandler(handler: (job: JobRecord) => Promise<void> | void): void {
    this.jobQueue.register(PROVIDER_REFRESH_JOB_TYPE, handler);
  }

  async tick(): Promise<SchedulerEnqueueResult> {
    const nowMs = this.clock.nowMs();
    const enqueued: JobRecord[] = [];
    let skippedDuplicate = 0;
    for (const schedule of this.schedules) {
      if (!schedule.enabled) {
        continue;
      }
      const bucket = Math.floor(nowMs / schedule.intervalMs);
      const intervalBucket = String(bucket);
      const jobId = buildRefreshJobId({
        scheduleId: schedule.scheduleId,
        providerId: schedule.providerId,
        capability: schedule.capability,
        resourceId: schedule.resourceId,
        intervalBucket,
      });
      if (this.recentJobIds.has(jobId)) {
        skippedDuplicate += 1;
        continue;
      }
      const jitterMs = Math.floor(this.rng() * schedule.jitterMs);
      const runAt = new Date(nowMs + jitterMs).toISOString();
      const draft: JobDraft = {
        jobId,
        jobType: PROVIDER_REFRESH_JOB_TYPE,
        runAt,
        timeoutMs: schedule.maxRuntimeMs,
        payload: Object.freeze({
          scheduleId: schedule.scheduleId,
          providerId: schedule.providerId,
          capability: schedule.capability,
          resourceId: schedule.resourceId,
          priority: String(schedule.priority),
        }),
      };
      const job = await this.jobQueue.enqueue(draft);
      this.recentJobIds.add(jobId);
      enqueued.push(job);
    }
    return Object.freeze({ enqueued, skippedDuplicate });
  }

  async dispatch(limit = 8): Promise<number> {
    return this.jobQueue.dispatchOnce(limit);
  }

  recordFailure(record: RefreshFailureRecord): void {
    this.failureRecords.push(Object.freeze({ ...record }));
  }

  failures(): readonly RefreshFailureRecord[] {
    return Object.freeze([...this.failureRecords]);
  }

  computeJitter(schedule: RefreshScheduleEntry): number {
    return Math.floor(this.rng() * schedule.jitterMs);
  }
}

export function scheduleIntervalBucket(nowMs: number, intervalMs: number): string {
  return String(Math.floor(nowMs / intervalMs));
}

export function observationJobDedupeHash(input: {
  readonly providerId: string;
  readonly capability: string;
  readonly resourceId: string;
  readonly contentHash: string;
}): string {
  return createHash('sha256')
    .update([input.providerId, input.capability, input.resourceId, input.contentHash].join('::'), 'utf8')
    .digest('hex');
}
