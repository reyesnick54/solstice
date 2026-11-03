import {
  isAllowedResearchPermission,
  isForbiddenResearchPermission,
  nativeToolBindingFor,
} from './permission-catalog.ts';
import type { NativeAgentCapabilityGrant } from './session.ts';
import type { ResearchAgentPermissionKind, ToolPermissionOutcome } from './taxonomy.ts';

export type NativeToolPermissionDecision = {
  readonly outcome: ToolPermissionOutcome;
  readonly permission: ResearchAgentPermissionKind;
  readonly toolId: string;
  readonly operation: string;
  readonly reason: string;
};

export function authorizeNativeResearchTool(input: {
  readonly grant: NativeAgentCapabilityGrant;
  readonly sessionActiveToolIds: readonly string[];
  readonly toolId: string;
  readonly operation: string;
}): NativeToolPermissionDecision {
  const binding = nativeToolBindingFor(input.toolId, input.operation);
  if (!binding) {
    return Object.freeze({
      outcome: 'DENIED_NOT_GRANTED',
      permission: 'REQUEST_RESEARCH',
      toolId: input.toolId,
      operation: input.operation,
      reason: 'tool operation is not registered in the native research permission catalog',
    });
  }

  if (isForbiddenResearchPermission(binding.permission)) {
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

  if (!isAllowedResearchPermission(binding.permission) || !input.grant.permissions.includes(binding.permission)) {
    return Object.freeze({
      outcome: 'DENIED_NOT_GRANTED',
      permission: binding.permission,
      toolId: input.toolId,
      operation: input.operation,
      reason: 'capability grant does not include required permission',
    });
  }

  if (!input.sessionActiveToolIds.includes(input.toolId)) {
    return Object.freeze({
      outcome: 'DENIED_NOT_GRANTED',
      permission: binding.permission,
      toolId: input.toolId,
      operation: input.operation,
      reason: 'tool is not active for this session',
    });
  }

  return Object.freeze({
    outcome: 'ALLOWED',
    permission: binding.permission,
    toolId: input.toolId,
    operation: input.operation,
    reason: 'explicit grant and session tool selection cover this operation',
  });
}
