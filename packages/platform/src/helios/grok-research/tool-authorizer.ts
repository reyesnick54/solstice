import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { HeliosResearchTaskInput, ResearchToolRequest } from './types.ts';
import type { ToolAuthorizationOutcome } from './taxonomy.ts';
import type { HeliosResearchToolRegistry, RegisteredResearchTool } from './tool-registry.ts';

export type ToolAuthorizationDecision = {
  readonly outcome: ToolAuthorizationOutcome;
  readonly tool: RegisteredResearchTool | null;
  readonly budgetImpact: string;
  readonly reason: string;
};

export function authorizeResearchToolRequest(input: {
  readonly request: ResearchToolRequest;
  readonly task: HeliosResearchTaskInput;
  readonly registry: HeliosResearchToolRegistry;
  readonly budgetConsumed: string;
  readonly toolCallsUsed: number;
  readonly perToolLimit: number;
  readonly now: UtcInstant;
}): ToolAuthorizationDecision {
  const { request, task, registry } = input;

  const tool = registry.get(request.toolId);
  if (!tool) {
    return Object.freeze({
      outcome: 'DENIED_NOT_REGISTERED',
      tool: null,
      budgetImpact: '0',
      reason: `tool ${request.toolId} is not registered`,
    });
  }

  if (!task.permittedTools.includes(request.toolId)) {
    return Object.freeze({
      outcome: 'DENIED_NOT_PERMITTED',
      tool,
      budgetImpact: '0',
      reason: `task does not permit tool ${request.toolId}`,
    });
  }

  if (tool.mutatesFinancialState) {
    return Object.freeze({
      outcome: 'DENIED_MUTATION_FORBIDDEN',
      tool,
      budgetImpact: '0',
      reason: 'research tools cannot mutate financial state',
    });
  }

  if (!tool.permittedOperations.includes(request.operation)) {
    return Object.freeze({
      outcome: 'DENIED_INVALID_INPUT',
      tool,
      budgetImpact: '0',
      reason: `operation ${request.operation} is not permitted for ${request.toolId}`,
    });
  }

  if (!validateToolInput(request.input, tool.inputSchema)) {
    return Object.freeze({
      outcome: 'DENIED_INVALID_INPUT',
      tool,
      budgetImpact: '0',
      reason: 'tool input failed schema validation',
    });
  }

  const budgetImpact = tool.budgetCostUnits;
  const nextConsumed = BigInt(input.budgetConsumed) + BigInt(budgetImpact);
  const ceiling = BigInt(task.budgetCeiling);
  if (nextConsumed > ceiling) {
    return Object.freeze({
      outcome: 'DENIED_BUDGET',
      tool,
      budgetImpact: '0',
      reason: 'research budget exhausted',
    });
  }

  if (input.toolCallsUsed >= input.perToolLimit) {
    return Object.freeze({
      outcome: 'DENIED_BUDGET',
      tool,
      budgetImpact: '0',
      reason: 'per-tool call limit reached',
    });
  }

  return Object.freeze({
    outcome: 'ALLOWED',
    tool,
    budgetImpact,
    reason: 'authorized',
  });
}

function validateToolInput(
  input: Readonly<Record<string, unknown>>,
  schema: Readonly<Record<string, unknown>>,
): boolean {
  const properties = schema.properties as Record<string, { type: string }> | undefined;
  if (!properties) return true;
  for (const [key, spec] of Object.entries(properties)) {
    if (spec.type === 'string' && input[key] !== undefined && typeof input[key] !== 'string') {
      return false;
    }
  }
  return true;
}
