import type { Clock } from '../../../../config/src/clock.ts';
import { asCustomerId } from '../../../../domain/src/customer.ts';
import type { HeliosWorkTask } from '../execution-types.ts';
import type { TaskHandler } from '../executor.ts';
import { GrokResearchRuntime } from './runtime.ts';
import type { HeliosResearchTaskInput } from './types.ts';
import type { ResearchPrivacyClass } from './taxonomy.ts';

export type GrokResearchTaskPayload = {
  readonly question: string;
  readonly timeHorizonDays?: number | null;
  readonly outputSchema?: string;
  readonly privacyClass?: ResearchPrivacyClass;
  readonly publicContext?: Readonly<Record<string, unknown>>;
  readonly privateContext?: Readonly<Record<string, unknown>> | null;
  readonly existingEvidenceRefs?: readonly string[];
  readonly candidateOpportunityKey?: string | null;
};

export function parseGrokResearchPayload(task: HeliosWorkTask): GrokResearchTaskPayload | null {
  try {
    const parsed = JSON.parse(task.requestedObjective) as GrokResearchTaskPayload;
    if (!parsed.question) return null;
    return parsed;
  } catch {
    if (task.requestedObjective.length > 0) {
      return Object.freeze({
        question: task.requestedObjective,
        publicContext: Object.freeze({}),
      });
    }
    return null;
  }
}

export function taskInputFromHeliosTask(
  task: HeliosWorkTask,
  payload: GrokResearchTaskPayload,
  budgetCeiling: string,
): HeliosResearchTaskInput {
  return Object.freeze({
    taskId: task.taskId,
    workOrderId: task.workOrderId,
    customerId: asCustomerId(task.customerId),
    question: payload.question,
    permittedTools: task.permittedTools,
    permittedModelClass: task.permittedModelClass,
    timeHorizonDays: payload.timeHorizonDays ?? null,
    deadline: task.deadline,
    budgetCeiling,
    budgetUnitKind: task.budgetUnitKind,
    budgetCurrency: null,
    outputSchema: payload.outputSchema ?? 'sunrey.helios.grok-research.v1',
    privacyClass: payload.privacyClass ?? 'PUBLIC',
    existingEvidenceRefs: Object.freeze(payload.existingEvidenceRefs ?? task.evidenceRefs),
    candidateOpportunityKey: payload.candidateOpportunityKey ?? null,
    publicContext: Object.freeze(payload.publicContext ?? {}),
    privateContext: payload.privateContext ?? null,
  });
}

export function createGrokResearchTaskHandler(input: {
  readonly runtime: GrokResearchRuntime;
  readonly resolveBudgetCeiling: (task: HeliosWorkTask) => string;
}): TaskHandler {
  return async (task: HeliosWorkTask) => {
    const payload = parseGrokResearchPayload(task);
    if (!payload) {
      throw new Error('invalid grok research task payload');
    }
    const researchInput = taskInputFromHeliosTask(
      task,
      payload,
      input.resolveBudgetCeiling(task),
    );
    const result = await input.runtime.executeResearch(researchInput);
    if (!result.ok) {
      throw new Error(result.error.message);
    }
    const evidenceRefs = result.value.evidenceRefs.map((ref) => ref.evidenceId);
    return {
      resultRef: result.value.researchResultId,
      evidenceRefs: Object.freeze(evidenceRefs),
      actualSpend: result.value.usage.budgetConsumed,
    };
  };
}

export function registerGrokResearchWorker(input: {
  readonly worker: import('../executor.ts').HeliosTaskWorker;
  readonly clock: Clock;
  readonly runtime?: GrokResearchRuntime;
  readonly resolveBudgetCeiling?: (task: HeliosWorkTask) => string;
}): void {
  const runtime = input.runtime ?? new GrokResearchRuntime({ clock: input.clock });
  const handler = createGrokResearchTaskHandler({
    runtime,
    resolveBudgetCeiling: input.resolveBudgetCeiling ?? ((task) => task.reservedBudgetAmount ?? '500'),
  });
  input.worker.register('RESEARCH_QUERY', handler);
  input.worker.register('EVIDENCE_GATHER', handler);
}
