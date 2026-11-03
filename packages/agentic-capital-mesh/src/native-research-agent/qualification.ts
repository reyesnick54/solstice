import type { UtcInstant } from '../imports.ts';
import { MESH_FORBIDDEN_RESEARCH_PERMISSIONS, MESH_RESEARCH_AGENT_PERMISSIONS } from './taxonomy.ts';
import { invokeMeshResearchTool } from './tools.ts';

export const HELIOS_NATIVE_AGENT_RUNTIME_QUALIFIED = 'HELIOS_NATIVE_AGENT_RUNTIME_QUALIFIED' as const;
export const HELIOS_NATIVE_AGENT_RUNTIME_BLOCKED = 'HELIOS_NATIVE_AGENT_RUNTIME_BLOCKED' as const;

export type MeshNativeResearchQualification = {
  readonly marker: typeof HELIOS_NATIVE_AGENT_RUNTIME_QUALIFIED | typeof HELIOS_NATIVE_AGENT_RUNTIME_BLOCKED;
  readonly evaluatedAt: UtcInstant;
  readonly notes: readonly string[];
};

export function assessMeshNativeResearchQualification(now: UtcInstant): MeshNativeResearchQualification {
  const notes: string[] = [];

  const allowed = invokeMeshResearchTool({
    subjectId: 'subject_qual',
    toolId: 'mesh_read_data',
    approvedPermissions: ['READ_DATA'],
  });
  if (!allowed.ok) {
    notes.push('READ_DATA mesh tool path failed');
  }

  const blocked = invokeMeshResearchTool({
    subjectId: 'subject_qual',
    toolId: 'execute_order',
    approvedPermissions: [...MESH_RESEARCH_AGENT_PERMISSIONS],
  });
  if (blocked.ok) {
    notes.push('forbidden EXECUTE_ORDER tool was not blocked');
  }

  if (MESH_FORBIDDEN_RESEARCH_PERMISSIONS.length < 5) {
    notes.push('forbidden permission set is incomplete');
  }

  const qualified = notes.length === 0;
  return Object.freeze({
    marker: qualified ? HELIOS_NATIVE_AGENT_RUNTIME_QUALIFIED : HELIOS_NATIVE_AGENT_RUNTIME_BLOCKED,
    evaluatedAt: now,
    notes: Object.freeze(notes),
  });
}
