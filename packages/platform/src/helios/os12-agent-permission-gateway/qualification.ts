import type { UtcInstant } from '../../../../domain/src/time.ts';
import { HELIOS_OS12_SERIS_UPSTREAM } from './upstream-attribution.ts';
import {
  AGENT_RESEARCH_PERMISSIONS,
  FORBIDDEN_RESEARCH_AGENT_PERMISSIONS,
  HELIOS_OS12_AGENT_PERMISSION_GATEWAY_BLOCKED,
  HELIOS_OS12_AGENT_PERMISSION_GATEWAY_QUALIFIED,
} from './taxonomy.ts';
import { listResearchToolPermissions } from './permission-catalog.ts';
import { DEFAULT_SIMULATION_MODEL_CAPABILITIES } from './model-profiles.ts';

export type Os12QualificationReport = {
  readonly marker:
    | typeof HELIOS_OS12_AGENT_PERMISSION_GATEWAY_QUALIFIED
    | typeof HELIOS_OS12_AGENT_PERMISSION_GATEWAY_BLOCKED;
  readonly evaluatedAt: UtcInstant;
  readonly explicitResearchPermissions: number;
  readonly forbiddenPermissions: number;
  readonly registeredToolPermissions: number;
  readonly registeredModelCapabilities: number;
  readonly upstreamReferenceSha: string;
  readonly notes: readonly string[];
};

export function assessOs12AgentPermissionGatewayQualification(now: UtcInstant): Os12QualificationReport {
  const catalog = listResearchToolPermissions();
  const notes: string[] = [];
  if (catalog.some((row) => row.mutatesFinancialState && row.researchOnly)) {
    notes.push('financial mutators must not be marked researchOnly');
  }
  const forbiddenCovered = FORBIDDEN_RESEARCH_AGENT_PERMISSIONS.every((permission) =>
    catalog.some((row) => row.permission === permission),
  );
  if (!forbiddenCovered) {
    notes.push('forbidden permissions are not fully represented in the tool catalog');
  }
  const researchCovered = AGENT_RESEARCH_PERMISSIONS.every((permission) =>
    catalog.some((row) => row.permission === permission),
  );
  if (!researchCovered) {
    notes.push('research permissions are not fully represented in the tool catalog');
  }
  const qualified =
    notes.length === 0 &&
    DEFAULT_SIMULATION_MODEL_CAPABILITIES.every((row) => !row.mayIssueExecutionAuthority);

  return Object.freeze({
    marker: qualified
      ? HELIOS_OS12_AGENT_PERMISSION_GATEWAY_QUALIFIED
      : HELIOS_OS12_AGENT_PERMISSION_GATEWAY_BLOCKED,
    evaluatedAt: now,
    explicitResearchPermissions: AGENT_RESEARCH_PERMISSIONS.length,
    forbiddenPermissions: FORBIDDEN_RESEARCH_AGENT_PERMISSIONS.length,
    registeredToolPermissions: catalog.length,
    registeredModelCapabilities: DEFAULT_SIMULATION_MODEL_CAPABILITIES.length,
    upstreamReferenceSha: HELIOS_OS12_SERIS_UPSTREAM.referenceSha,
    notes: Object.freeze(notes),
  });
}
