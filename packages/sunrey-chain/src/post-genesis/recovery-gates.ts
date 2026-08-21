/**
 * Chunk 167 — post-genesis recovery gates.
 *
 * Incident resolution does not resume a restricted capability.
 * Recovery requires reconciliation before consequential workflows.
 */

import { resolveIncident } from './incidents.ts';
import type { IndependentCapability, PostGenesisIncident } from './types.ts';
import type { StabilizationState } from './plane.ts';

export function resolveIncidentWithoutResume(
  state: StabilizationState,
  incident: PostGenesisIncident,
  capability: IndependentCapability,
): {
  readonly state: StabilizationState;
  readonly incident: PostGenesisIncident;
  readonly capabilityRemainsRestricted: boolean;
  readonly autoResumed: false;
} {
  const resolved = resolveIncident(incident, 'RESOLVED', 'CONTAINED_WITHOUT_AUTO_RESUME');
  const remainsRestricted = state.restricted.has(capability) || !state.enabled.has(capability);
  return Object.freeze({
    state: {
      ...state,
      incidents: Object.freeze(
        state.incidents.map((row) => (row.incidentId === incident.incidentId ? resolved : row)),
      ),
    },
    incident: resolved,
    capabilityRemainsRestricted: remainsRestricted,
    autoResumed: false,
  });
}

export function recoveryRequiresReconciliation(reconciled: boolean): {
  readonly mayResumeConsequentialWorkflows: boolean;
  readonly reason: string;
} {
  return Object.freeze({
    mayResumeConsequentialWorkflows: reconciled,
    reason: reconciled
      ? 'reconciliation clean; resumption still requires independent authorization'
      : 'reconciliation required before consequential workflows resume',
  });
}
