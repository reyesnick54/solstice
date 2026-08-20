import { createHash } from 'node:crypto';

import type { EvidenceVault } from '../../../../evidence/src/vault.ts';
import { sealIncidentEvidence } from '../evidence.ts';
import { runbookFor } from './catalog.ts';
import type {
  ControlRoomIncidentKind,
  OperationalIncident,
  OperationalIncidentStatus,
  RecoveryCondition,
  SafeCorrelationRefs,
} from './types.ts';

export function createOperationalIncident(input: {
  readonly kind: ControlRoomIncidentKind;
  readonly startedAt: string;
  readonly detectedAt: string;
  readonly affectedComponents: readonly string[];
  readonly safeSummary: string;
  readonly correlationRefs?: readonly SafeCorrelationRefs[];
  readonly invariantFailures?: readonly string[];
  readonly providerStates?: OperationalIncident['providerStates'];
  readonly reconciliationRefs?: readonly string[];
  readonly recoveryConditions: readonly RecoveryCondition[];
  readonly severity?: OperationalIncident['severity'];
}): OperationalIncident {
  return Object.freeze({
    incidentId: incidentIdFor(input.kind, input.detectedAt),
    kind: input.kind,
    severity: input.severity ?? defaultSeverity(input.kind),
    startedAt: input.startedAt,
    detectedAt: input.detectedAt,
    affectedComponents: Object.freeze([...input.affectedComponents]),
    safeSummary: input.safeSummary,
    correlationRefs: Object.freeze([...(input.correlationRefs ?? [])]),
    invariantFailures: Object.freeze([...(input.invariantFailures ?? [])]),
    providerStates: Object.freeze([...(input.providerStates ?? [])]),
    reconciliationRefs: Object.freeze([...(input.reconciliationRefs ?? [])]),
    evidenceRefs: Object.freeze([]),
    status: 'OPEN',
    recoveryConditions: Object.freeze([...input.recoveryConditions]),
    runbookRef: runbookFor(input.kind),
    autoExecuteRunbook: false,
  });
}

export function transitionIncident(
  incident: OperationalIncident,
  status: OperationalIncidentStatus,
): OperationalIncident {
  if (status === 'RESOLVED' && !recoverySatisfied(incident.recoveryConditions)) {
    throw new Error('incident cannot resolve until recovery conditions are satisfied');
  }
  return Object.freeze({ ...incident, status });
}

export function withRecoveryConditions(
  incident: OperationalIncident,
  recoveryConditions: readonly RecoveryCondition[],
): OperationalIncident {
  const next = Object.freeze({ ...incident, recoveryConditions: Object.freeze([...recoveryConditions]) });
  if (recoverySatisfied(recoveryConditions) && (incident.status === 'OPEN' || incident.status === 'MITIGATING')) {
    return Object.freeze({ ...next, status: 'RECOVERING' });
  }
  return next;
}

export function recoverySatisfied(conditions: readonly RecoveryCondition[]): boolean {
  return conditions.length > 0 && conditions.every((row) => row.satisfied);
}

export function sealOperationalIncident(
  vault: EvidenceVault,
  incident: OperationalIncident,
): { readonly incident: OperationalIncident; readonly evidenceId: string } {
  const sealed = sealIncidentEvidence(vault, 'OPS_CONTROL_ROOM_INCIDENT', {
    incidentId: incident.incidentId,
    kind: incident.kind,
    severity: incident.severity,
    safeSummary: incident.safeSummary,
    affectedComponents: incident.affectedComponents,
    invariantFailures: incident.invariantFailures,
    status: incident.status,
    runbookRef: incident.runbookRef,
  });
  return {
    incident: Object.freeze({
      ...incident,
      evidenceRefs: Object.freeze([...incident.evidenceRefs, sealed.evidenceId]),
    }),
    evidenceId: sealed.evidenceId,
  };
}

function defaultSeverity(kind: ControlRoomIncidentKind): OperationalIncident['severity'] {
  if (kind === 'SUPPLY_RECONCILIATION_FAILURE' || kind === 'LEDGER_IMBALANCE' || kind === 'CREDENTIAL_COMPROMISE') {
    return 'CRITICAL';
  }
  if (kind === 'ORACLE_QUORUM_LOSS' || kind === 'PAYMENT_SUBMISSION_UNKNOWN_SURGE' || kind === 'PROVIDER_OUTAGE') {
    return 'HIGH';
  }
  return 'WARNING';
}

function incidentIdFor(kind: ControlRoomIncidentKind, detectedAt: string): string {
  return `inc_${createHash('sha256').update(`${kind}:${detectedAt}`).digest('hex').slice(0, 16)}`;
}
