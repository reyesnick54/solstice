import type { ForwardAlphaCampaignId } from '../ids.ts';
import type { CampaignCheckpoint, CampaignRunContext, CampaignWorkItem } from './types.ts';

export type CampaignOrchestratorSnapshot = {
  readonly contexts: readonly CampaignRunContext[];
  readonly pendingWork: readonly CampaignWorkItem[];
  readonly checkpoints: readonly CampaignCheckpoint[];
};

export class ForwardCampaignOrchestratorStore {
  private readonly contexts = new Map<string, CampaignRunContext>();
  private readonly workQueue: CampaignWorkItem[] = [];
  private readonly checkpoints = new Map<string, CampaignCheckpoint>();

  putContext(context: CampaignRunContext): void {
    this.contexts.set(context.campaignId, context);
  }

  getContext(campaignId: ForwardAlphaCampaignId): CampaignRunContext | undefined {
    return this.contexts.get(campaignId);
  }

  listContexts(): readonly CampaignRunContext[] {
    return Object.freeze([...this.contexts.values()]);
  }

  enqueueWork(item: CampaignWorkItem): void {
    if (this.workQueue.some((row) => row.workItemId === item.workItemId)) {
      return;
    }
    this.workQueue.push(item);
    this.workQueue.sort((a, b) => Date.parse(a.notBefore) - Date.parse(b.notBefore));
  }

  dequeueDueWork(now: string, limit: number): readonly CampaignWorkItem[] {
    const due: CampaignWorkItem[] = [];
    const rest: CampaignWorkItem[] = [];
    for (const item of this.workQueue) {
      if (due.length < limit && item.notBefore <= now) {
        due.push(item);
      } else {
        rest.push(item);
      }
    }
    this.workQueue.length = 0;
    this.workQueue.push(...rest);
    return Object.freeze(due);
  }

  listPendingWork(campaignId?: ForwardAlphaCampaignId): readonly CampaignWorkItem[] {
    return Object.freeze(
      campaignId ? this.workQueue.filter((row) => row.campaignId === campaignId) : [...this.workQueue],
    );
  }

  putCheckpoint(checkpoint: CampaignCheckpoint): void {
    this.checkpoints.set(checkpoint.checkpointId, checkpoint);
  }

  latestCheckpoint(campaignId: ForwardAlphaCampaignId): CampaignCheckpoint | undefined {
    const rows = [...this.checkpoints.values()].filter((row) => row.campaignId === campaignId);
    rows.sort((a, b) => b.generation - a.generation);
    return rows[0];
  }

  snapshot(): CampaignOrchestratorSnapshot {
    return Object.freeze({
      contexts: Object.freeze([...this.contexts.values()]),
      pendingWork: Object.freeze([...this.workQueue]),
      checkpoints: Object.freeze([...this.checkpoints.values()]),
    });
  }

  loadSnapshot(snapshot: CampaignOrchestratorSnapshot): void {
    this.contexts.clear();
    this.workQueue.length = 0;
    this.checkpoints.clear();
    for (const row of snapshot.contexts) {
      this.contexts.set(row.campaignId, row);
    }
    for (const row of snapshot.pendingWork) {
      this.workQueue.push(row);
    }
    for (const row of snapshot.checkpoints) {
      this.checkpoints.set(row.checkpointId, row);
    }
  }
}
