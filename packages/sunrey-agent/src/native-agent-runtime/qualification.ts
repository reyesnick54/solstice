import type { UtcInstant } from '../../../domain/src/time.ts';
import {
  HELIOS_NATIVE_AGENT_RUNTIME_BLOCKED,
  HELIOS_NATIVE_AGENT_RUNTIME_QUALIFIED,
} from '../../../ai-runtime/src/native-agent-runtime/taxonomy.ts';
import { listNativeResearchToolBindings } from './permission-catalog.ts';
import {
  FORBIDDEN_RESEARCH_AGENT_PERMISSIONS,
  RESEARCH_AGENT_PERMISSIONS,
} from './taxonomy.ts';

export type NativeAgentRuntimeLayerQualification = {
  readonly marker: typeof HELIOS_NATIVE_AGENT_RUNTIME_QUALIFIED | typeof HELIOS_NATIVE_AGENT_RUNTIME_BLOCKED;
  readonly evaluatedAt: UtcInstant;
  readonly researchPermissions: number;
  readonly forbiddenPermissions: number;
  readonly registeredToolBindings: number;
  readonly notes: readonly string[];
};

export function assessNativeAgentRuntimeLayerQualification(now: UtcInstant): NativeAgentRuntimeLayerQualification {
  const catalog = listNativeResearchToolBindings();
  const notes: string[] = [];

  for (const permission of RESEARCH_AGENT_PERMISSIONS) {
    if (!catalog.some((row) => row.permission === permission)) {
      notes.push(`research permission ${permission} is missing from the native catalog`);
    }
  }
  for (const permission of FORBIDDEN_RESEARCH_AGENT_PERMISSIONS) {
    if (!catalog.some((row) => row.permission === permission)) {
      notes.push(`forbidden permission ${permission} is missing from the native catalog`);
    }
  }
  if (catalog.some((row) => row.mutatesFinancialState && row.researchOnly)) {
    notes.push('financial mutators must not be marked researchOnly');
  }

  const qualified = notes.length === 0;
  return Object.freeze({
    marker: qualified ? HELIOS_NATIVE_AGENT_RUNTIME_QUALIFIED : HELIOS_NATIVE_AGENT_RUNTIME_BLOCKED,
    evaluatedAt: now,
    researchPermissions: RESEARCH_AGENT_PERMISSIONS.length,
    forbiddenPermissions: FORBIDDEN_RESEARCH_AGENT_PERMISSIONS.length,
    registeredToolBindings: catalog.length,
    notes: Object.freeze(notes),
  });
}
