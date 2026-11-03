import { err, ok, type Result } from '../imports.ts';
import {
  MESH_FORBIDDEN_RESEARCH_PERMISSIONS,
  MESH_RESEARCH_AGENT_PERMISSIONS,
  MESH_RESEARCH_TOOL_IDS,
  type MeshForbiddenResearchPermission,
  type MeshResearchAgentPermission,
} from './taxonomy.ts';

export type MeshResearchToolFailure = {
  readonly code: 'TOOL_FORBIDDEN' | 'PERMISSION_NOT_GRANTED' | 'UNKNOWN_TOOL';
  readonly message: string;
};

export type MeshResearchToolInvocation = {
  readonly permission: MeshResearchAgentPermission;
  readonly toolId: string;
  readonly subjectId: string;
  readonly payload: unknown;
  readonly writePath: false;
};

const TOOL_TO_PERMISSION: Record<string, MeshResearchAgentPermission> = {
  [MESH_RESEARCH_TOOL_IDS.READ_DATA]: 'READ_DATA',
  [MESH_RESEARCH_TOOL_IDS.RUN_ANALYSIS]: 'RUN_ANALYSIS',
  [MESH_RESEARCH_TOOL_IDS.RUN_BACKTEST]: 'RUN_BACKTEST',
  [MESH_RESEARCH_TOOL_IDS.CREATE_MONITOR]: 'CREATE_MONITOR',
  [MESH_RESEARCH_TOOL_IDS.PROPOSE_STRATEGY]: 'PROPOSE_STRATEGY',
  [MESH_RESEARCH_TOOL_IDS.REQUEST_RESEARCH]: 'REQUEST_RESEARCH',
};

const FORBIDDEN_ALIASES: Record<string, MeshForbiddenResearchPermission> = {
  transfer_funds: 'TRANSFER_FUNDS',
  execute_order: 'EXECUTE_ORDER',
  disable_risk: 'DISABLE_RISK',
  disable_compliance: 'DISABLE_COMPLIANCE',
  enable_live: 'ENABLE_LIVE',
};

export function meshResearchPermissionsForRole(role: string): readonly MeshResearchAgentPermission[] {
  if (role === 'META_ALLOCATOR') {
    return Object.freeze(['READ_DATA', 'RUN_ANALYSIS', 'REQUEST_RESEARCH']);
  }
  if (role === 'EVIDENCE_VERIFIER' || role === 'ADVERSARIAL_CRITIC') {
    return Object.freeze(['READ_DATA', 'RUN_ANALYSIS']);
  }
  return MESH_RESEARCH_AGENT_PERMISSIONS;
}

export function invokeMeshResearchTool(input: {
  readonly subjectId: string;
  readonly toolId: string;
  readonly approvedPermissions: readonly MeshResearchAgentPermission[];
  readonly payload?: unknown;
}): Result<MeshResearchToolInvocation, MeshResearchToolFailure> {
  const forbidden = FORBIDDEN_ALIASES[input.toolId];
  if (forbidden) {
    return err({
      code: 'TOOL_FORBIDDEN',
      message: `${forbidden} is forbidden for Capital Mesh research agents`,
    });
  }
  for (const blocked of MESH_FORBIDDEN_RESEARCH_PERMISSIONS) {
    if (input.toolId.toLowerCase().includes(blocked.toLowerCase())) {
      return err({
        code: 'TOOL_FORBIDDEN',
        message: `${blocked} is forbidden for Capital Mesh research agents`,
      });
    }
  }

  const permission = TOOL_TO_PERMISSION[input.toolId];
  if (!permission) {
    return err({ code: 'UNKNOWN_TOOL', message: `unknown mesh research tool ${input.toolId}` });
  }
  if (!input.approvedPermissions.includes(permission)) {
    return err({
      code: 'PERMISSION_NOT_GRANTED',
      message: `mesh research grant does not include ${permission}`,
    });
  }

  return ok(
    Object.freeze({
      permission,
      toolId: input.toolId,
      subjectId: input.subjectId,
      payload: input.payload ?? { simulation: true },
      writePath: false,
    }),
  );
}
