/**
 * Post-genesis operational incidents.
 *
 * Incident handling cannot rewrite finalized blocks. Conflicting finality
 * is always a critical CONSENSUS incident.
 */

import { commitPostGenesis } from './hash.ts';
import type {
  IncidentResolutionState,
  IncidentSeverity,
  PostGenesisIncident,
  PostGenesisIncidentCategory,
} from './types.ts';

export function openIncident(input: {
  readonly category: PostGenesisIncidentCategory;
  readonly severity: IncidentSeverity;
  readonly checkpointId: string | null;
  readonly component: string;
  readonly evidence: string;
  readonly operatorAction?: string;
  readonly governanceAction?: string;
  readonly currentRestrictions?: readonly string[];
  readonly conflictingFinality?: boolean;
}): PostGenesisIncident {
  const conflictingFinality = input.conflictingFinality === true || input.category === 'CONSENSUS' && /conflicting.?finality/i.test(input.evidence);
  const severity: IncidentSeverity = conflictingFinality ? 'CRITICAL' : input.severity;
  const incidentId = commitPostGenesis({
    kind: 'incident',
    category: input.category,
    checkpointId: input.checkpointId,
    component: input.component,
    evidence: input.evidence,
  });
  return Object.freeze({
    incidentId,
    category: conflictingFinality ? 'CONSENSUS' : input.category,
    severity,
    checkpointId: input.checkpointId,
    component: input.component,
    evidence: input.evidence,
    operatorAction: input.operatorAction ?? 'CONTAIN_AND_EVIDENCE',
    governanceAction: input.governanceAction ?? 'REVIEW',
    currentRestrictions: Object.freeze([...(input.currentRestrictions ?? [])]),
    resolution: 'OPEN',
    conflictingFinality,
    rewritesFinalizedState: false,
  });
}

export function conflictingFinalityIncident(checkpointId: string, evidence: string): PostGenesisIncident {
  return openIncident({
    category: 'CONSENSUS',
    severity: 'CRITICAL',
    checkpointId,
    component: 'finality',
    evidence,
    operatorAction: 'HALT_AND_PRESERVE_FINALIZED_STATE',
    governanceAction: 'PROTOCOL_INCIDENT',
    conflictingFinality: true,
  });
}

export function resolveIncident(
  incident: PostGenesisIncident,
  resolution: IncidentResolutionState,
  operatorAction: string,
): PostGenesisIncident {
  return Object.freeze({
    ...incident,
    resolution,
    operatorAction,
    rewritesFinalizedState: false,
  });
}

export function cannotRewriteFinality(incident: PostGenesisIncident): true {
  return incident.rewritesFinalizedState === false;
}
