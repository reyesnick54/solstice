import type { AiRequestId } from '../ids.ts';
import type { InferenceJobRecord } from './types.ts';

export type InferenceJobStoreSnapshot = {
  readonly jobs: readonly InferenceJobRecord[];
};

export class InMemoryInferenceJobStore {
  private readonly jobs = new Map<string, InferenceJobRecord>();
  private readonly idempotency = new Map<string, AiRequestId>();

  put(job: InferenceJobRecord): InferenceJobRecord {
    this.jobs.set(job.inferenceRequestId, Object.freeze({ ...job }));
    this.idempotency.set(job.idempotencyKey, job.inferenceRequestId);
    return this.get(job.inferenceRequestId)!;
  }

  get(requestId: AiRequestId): InferenceJobRecord | null {
    return this.jobs.get(requestId) ?? null;
  }

  getByIdempotencyKey(key: string): InferenceJobRecord | null {
    const requestId = this.idempotency.get(key);
    return requestId ? this.get(requestId) : null;
  }

  update(requestId: AiRequestId, patch: Partial<InferenceJobRecord>): InferenceJobRecord | null {
    const current = this.get(requestId);
    if (!current) return null;
    return this.put(Object.freeze({ ...current, ...patch }));
  }

  listByCustomer(customerId: string): readonly InferenceJobRecord[] {
    return Object.freeze([...this.jobs.values()].filter((job) => job.customerId === customerId));
  }

  snapshot(): InferenceJobStoreSnapshot {
    return Object.freeze({ jobs: Object.freeze([...this.jobs.values()]) });
  }

  restore(snapshot: InferenceJobStoreSnapshot): void {
    this.jobs.clear();
    this.idempotency.clear();
    for (const job of snapshot.jobs) {
      this.put(job);
    }
  }
}
