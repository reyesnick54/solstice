import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { AgentCapabilityGrant, AgentResearchSession, ResearchAutopilotStrategy } from './types.ts';
import { isForbiddenPermission } from './permission-catalog.ts';
import { newResearchAutopilotId } from './ids.ts';
import type { ResearchAutopilotKind } from './taxonomy.ts';

const MIN_AUTOPILOT_INTERVAL_MS = 5_000;

export type ResearchAutopilotTickResult =
  | { readonly ok: true; readonly summary: string; readonly notifications: readonly string[] }
  | { readonly ok: false; readonly code: 'FORBIDDEN_PERMISSION' | 'INACTIVE_GRANT'; readonly message: string };

/**
 * Autonomous research workflows only — never autonomous financial authority.
 * Fund-moving or execution permissions are blocked at tick time.
 */
export function createResearchAutopilotStrategy(input: {
  readonly grant: AgentCapabilityGrant;
  readonly session: AgentResearchSession;
  readonly kind: ResearchAutopilotKind;
  readonly intervalMs: number;
  readonly now: UtcInstant;
}): ResearchAutopilotStrategy {
  if (input.intervalMs < MIN_AUTOPILOT_INTERVAL_MS) {
    throw new Error(`autopilot interval must be at least ${MIN_AUTOPILOT_INTERVAL_MS}ms`);
  }
  for (const permission of input.grant.permissions) {
    if (isForbiddenPermission(permission)) {
      throw new Error(`autopilot cannot be created with forbidden permission ${permission}`);
    }
  }
  return Object.freeze({
    autopilotId: newResearchAutopilotId(),
    grantId: input.grant.grantId,
    sessionId: input.session.sessionId,
    kind: input.kind,
    status: 'ACTIVE',
    intervalMs: input.intervalMs,
    permittedPermissions: input.grant.permissions,
    createdAt: input.now,
    updatedAt: input.now,
    lastRunAt: null,
    runCount: 0,
    authorizesFinancialExecution: false,
  });
}

export function tickResearchAutopilot(input: {
  readonly strategy: ResearchAutopilotStrategy;
  readonly grant: AgentCapabilityGrant;
  readonly now: UtcInstant;
  readonly requestedPermission: string;
}): { readonly strategy: ResearchAutopilotStrategy; readonly result: ResearchAutopilotTickResult } {
  if (input.grant.state !== 'ACTIVE') {
    return {
      strategy: input.strategy,
      result: Object.freeze({
        ok: false,
        code: 'INACTIVE_GRANT',
        message: 'autopilot requires an active capability grant',
      }),
    };
  }
  if (isForbiddenPermission(input.requestedPermission as never)) {
    return {
      strategy: input.strategy,
      result: Object.freeze({
        ok: false,
        code: 'FORBIDDEN_PERMISSION',
        message: 'autopilot cannot invoke forbidden financial permissions',
      }),
    };
  }
  const updated = Object.freeze({
    ...input.strategy,
    runCount: input.strategy.runCount + 1,
    lastRunAt: input.now,
    updatedAt: input.now,
  });
  return {
    strategy: updated,
    result: Object.freeze({
      ok: true,
      summary: `research autopilot ${input.strategy.kind} tick completed`,
      notifications: Object.freeze([`autopilot:${input.strategy.kind}:observe`]),
    }),
  };
}
