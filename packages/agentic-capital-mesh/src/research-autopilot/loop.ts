import { createHash, randomUUID } from 'node:crypto';

import { ok, type Result } from '../imports.ts';
import type { UtcInstant } from '../imports.ts';
import { ResearchAutopilotTaskStore } from './store.ts';
import type { ResearchAutopilotLoopResult, ResearchAutopilotTask, ResearchAutopilotTaskKind } from './types.ts';

export type ResearchAutopilotMeshPort = {
  readonly runResearch: (input: {
    readonly workOrderId: string;
    readonly subjectId: string;
    readonly objective: string;
    readonly contextRef: string;
  }) => Result<{ readonly runId: string }, { readonly code: string; readonly message: string }>;
};

export class ResearchAutopilotCoordinator {
  readonly store: ResearchAutopilotTaskStore;

  constructor(store?: ResearchAutopilotTaskStore) {
    this.store = store ?? new ResearchAutopilotTaskStore();
  }

  enqueueTask(input: {
    readonly workOrderId: string;
    readonly subjectId: string;
    readonly kind: ResearchAutopilotTaskKind;
    readonly objective: string;
    readonly marketContextRef?: string | null;
    readonly genomeCandidateRef?: string | null;
    readonly now: UtcInstant;
  }): ResearchAutopilotTask {
    const material = `${input.workOrderId}:${input.objective}:${input.now}`;
    const taskId = `rat_${createHash('sha256').update(material).digest('hex').slice(0, 20)}`;
    const task: ResearchAutopilotTask = Object.freeze({
      taskId,
      workOrderId: input.workOrderId,
      subjectId: input.subjectId,
      kind: input.kind,
      objective: input.objective,
      marketContextRef: input.marketContextRef ?? null,
      genomeCandidateRef: input.genomeCandidateRef ?? null,
      createdAt: input.now,
      grantsExecutionAuthority: false,
      researchOnly: true,
    });
    this.store.putTask(task);
    return task;
  }

  runAutonomousResearchLoop(input: {
    readonly task: ResearchAutopilotTask;
    readonly mesh: ResearchAutopilotMeshPort;
    readonly now: UtcInstant;
  }): Result<ResearchAutopilotLoopResult, { readonly code: string; readonly message: string }> {
    const mesh = input.mesh.runResearch({
      workOrderId: input.task.workOrderId,
      subjectId: input.task.subjectId,
      objective: input.task.objective,
      contextRef: input.task.marketContextRef ?? `ctx_${randomUUID().slice(0, 8)}`,
    });
    if (!mesh.ok) {
      return mesh;
    }
    const result: ResearchAutopilotLoopResult = Object.freeze({
      task: input.task,
      completedAt: input.now,
      summary: `research autopilot completed ${input.task.kind} without financial execution`,
      meshRunId: mesh.value.runId,
      financialExecutionRequested: false,
    });
    this.store.recordResult(result);
    return ok(result);
  }
}
