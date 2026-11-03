import type { AgentCapabilityGrant } from './types.ts';
import { isForbiddenPermission, toolPermissionFor } from './permission-catalog.ts';
import type { ToolPermissionDecision } from './types.ts';

export function authorizeAgentToolPermission(input: {
  readonly grant: AgentCapabilityGrant;
  readonly toolId: string;
  readonly operation: string;
}): ToolPermissionDecision {
  const binding = toolPermissionFor(input.toolId, input.operation);
  if (!binding) {
    return Object.freeze({
      outcome: 'DENIED_NOT_GRANTED',
      permission: 'REQUEST_ADDITIONAL_RESEARCH',
      toolId: input.toolId,
      operation: input.operation,
      reason: 'tool operation is not registered in the OS12 permission catalog',
    });
  }

  if (isForbiddenPermission(binding.permission)) {
    return Object.freeze({
      outcome: 'DENIED_FORBIDDEN',
      permission: binding.permission,
      toolId: input.toolId,
      operation: input.operation,
      reason: 'permission is forbidden for research agents',
    });
  }

  if (input.grant.state !== 'ACTIVE') {
    return Object.freeze({
      outcome: 'DENIED_NOT_GRANTED',
      permission: binding.permission,
      toolId: input.toolId,
      operation: input.operation,
      reason: `grant is ${input.grant.state}`,
    });
  }

  if (!input.grant.permissions.includes(binding.permission)) {
    return Object.freeze({
      outcome: 'DENIED_NOT_GRANTED',
      permission: binding.permission,
      toolId: input.toolId,
      operation: input.operation,
      reason: 'capability grant does not include required permission',
    });
  }

  return Object.freeze({
    outcome: 'ALLOWED',
    permission: binding.permission,
    toolId: input.toolId,
    operation: input.operation,
    reason: 'explicit grant covers tool permission',
  });
}
