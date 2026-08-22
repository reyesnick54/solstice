import { InMemoryJobStore, PersistentJobQueue, type JobRecord } from '../../events/src/jobs.ts';
import type { DomainEvent } from '../../events/src/events.ts';
import type { EconomicGraphService } from './service.ts';

export const PEG_JOB_TYPES = ['PEG_INGEST_EVENT', 'PEG_REFRESH_SNAPSHOT', 'PEG_REBUILD'] as const;
export type PegJobType = (typeof PEG_JOB_TYPES)[number];

export const PEG_JOB_CAN_POST_JOURNAL = false as const;
export const PEG_JOB_CAN_ISSUE_EXECUTION_AUTHORITY = false as const;

export type PegSourceRecord = {
  readonly events: readonly DomainEvent[];
  readonly subjectId: string;
};

/**
 * Incremental PEG updates plus deterministic rebuild.
 * API reads must not rebuild the entire graph synchronously.
 */
export class PegUpdatePipeline {
  readonly queue: PersistentJobQueue;
  private readonly peg: EconomicGraphService;
  private readonly sources = new Map<string, DomainEvent[]>();

  constructor(input: { readonly peg: EconomicGraphService; readonly nowMs: () => number; readonly now: () => string }) {
    this.peg = input.peg;
    this.queue = new PersistentJobQueue({
      store: new InMemoryJobStore(),
      clock: { now: input.now, nowMs: input.nowMs },
      workerId: 'peg-pipeline',
    });
    this.queue.register('PEG_INGEST_EVENT', (job) => this.handleIngest(job));
    this.queue.register('PEG_REFRESH_SNAPSHOT', (job) => this.handleRefresh(job));
    this.queue.register('PEG_REBUILD', (job) => this.handleRebuild(job));
  }

  rememberSource(subjectId: string, events: readonly DomainEvent[]): void {
    this.sources.set(subjectId, [...events]);
  }

  sourceRecords(subjectId: string): readonly DomainEvent[] {
    return this.sources.get(subjectId) ?? [];
  }

  async enqueueIngest(subjectId: string, event: DomainEvent): Promise<string> {
    const remembered = this.sources.get(subjectId) ?? [];
    remembered.push(event);
    this.sources.set(subjectId, remembered);
    const job = await this.queue.enqueue({
      jobType: 'PEG_INGEST_EVENT',
      payload: {
        subjectId,
        eventJson: JSON.stringify(event),
      },
    });
    return job.jobId;
  }

  async enqueueRefresh(subjectId: string, actorHint = 'pipeline'): Promise<string> {
    const job = await this.queue.enqueue({
      jobType: 'PEG_REFRESH_SNAPSHOT',
      payload: { subjectId, actorHint },
    });
    return job.jobId;
  }

  async enqueueRebuild(subjectId: string): Promise<string> {
    const job = await this.queue.enqueue({
      jobType: 'PEG_REBUILD',
      payload: { subjectId },
    });
    return job.jobId;
  }

  async drain(limit = 20): Promise<number> {
    const result = await this.queue.dispatchOnce(limit);
    return result.succeeded;
  }

  private handleIngest(job: JobRecord): void {
    const subjectId = job.payload.subjectId;
    const event = JSON.parse(job.payload.eventJson ?? '{}') as DomainEvent;
    this.peg.ingest(event, subjectId);
    this.peg.materializeRecurring(subjectId);
  }

  private handleRefresh(job: JobRecord): void {
    const subjectId = job.payload.subjectId;
    this.peg.materializeRecurring(subjectId);
    this.peg.refreshDerivedIntelligence(subjectId);
  }

  private handleRebuild(job: JobRecord): void {
    const subjectId = job.payload.subjectId;
    this.peg.rebuildDerivedProjection(subjectId, this.sourceRecords(subjectId));
  }
}
