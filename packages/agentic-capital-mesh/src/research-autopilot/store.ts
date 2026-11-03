import type { ResearchAutopilotLoopResult, ResearchAutopilotTask } from './types.ts';

const HISTORY_CAP = 50;

export class ResearchAutopilotTaskStore {
  readonly #tasks = new Map<string, ResearchAutopilotTask>();
  readonly #results: ResearchAutopilotLoopResult[] = [];

  putTask(task: ResearchAutopilotTask): void {
    this.#tasks.set(task.taskId, Object.freeze({ ...task }));
  }

  getTask(taskId: string): ResearchAutopilotTask | undefined {
    return this.#tasks.get(taskId);
  }

  recordResult(result: ResearchAutopilotLoopResult): void {
    this.#results.unshift(Object.freeze({ ...result }));
    if (this.#results.length > HISTORY_CAP) {
      this.#results.length = HISTORY_CAP;
    }
  }

  listResults(): readonly ResearchAutopilotLoopResult[] {
    return Object.freeze([...this.#results]);
  }
}
