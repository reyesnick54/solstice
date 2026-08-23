import { createHash } from 'node:crypto';

import { FrozenClock } from '../../../../config/src/clock.ts';
import { asUtcInstant } from '../../../../domain/src/time.ts';
import type { EvidenceVault } from '../../../../evidence/src/vault.ts';
import { createOpsEvidenceVault, sealIncidentEvidence } from '../evidence.ts';
import { productizationAlert } from './alerts.ts';
import {
  INCIDENT_STATUSES,
  type CustomerImpactLevel,
  type IncidentStatus,
  type PersistentIncident,
  type ProductizationAlertCode,
  type SeverityLevel,
  type TelemetrySystem,
} from './types.ts';

const TRANSITIONS: Readonly<Record<IncidentStatus, readonly IncidentStatus[]>> = Object.freeze({
  DETECTED: ['INVESTIGATING'],
  INVESTIGATING: ['MITIGATING', 'MONITORING'],
  MITIGATING: ['MONITORING', 'RESOLVED'],
  MONITORING: ['MITIGATING', 'RESOLVED'],
  RESOLVED: ['POSTMORTEM_REQUIRED', 'CLOSED'],
  POSTMORTEM_REQUIRED: ['CLOSED'],
  CLOSED: [],
});

export function allowedIncidentTransitions(status: IncidentStatus): readonly IncidentStatus[] {
  return TRANSITIONS[status];
}

export function createIncident(input: {
  readonly severity: SeverityLevel;
  readonly services: readonly TelemetrySystem[];
  readonly startedAt: string;
  readonly detectedAt: string;
  readonly customerImpact: CustomerImpactLevel;
  readonly summary: string;
  readonly alertCode?: ProductizationAlertCode;
  readonly commander?: PersistentIncident['commander'];
}): PersistentIncident {
  const incidentId = `inc_${createHash('sha256')
    .update(`${input.alertCode ?? 'MANUAL'}:${input.detectedAt}:${input.summary}`)
    .digest('hex')
    .slice(0, 16)}`;
  const runbookRef = input.alertCode
    ? productizationAlert(input.alertCode).runbookRef
    : 'docs/productization/SUNREY_INCIDENT_RESPONSE_PLAN.md';
  return Object.freeze({
    incidentId,
    severity: input.severity,
    status: 'DETECTED',
    commander: input.commander ?? null,
    services: Object.freeze([...input.services]),
    startedAt: input.startedAt,
    detectedAt: input.detectedAt,
    resolvedAt: null,
    customerImpact: input.customerImpact,
    timeline: Object.freeze([
      {
        sequence: 1n,
        atUtc: input.detectedAt,
        status: 'DETECTED' as const,
        actorRole: 'SYSTEM' as const,
        summary: input.summary,
      },
    ]),
    mitigations: Object.freeze([]),
    evidence: Object.freeze([]),
    postmortemReference: null,
    alertCode: input.alertCode ?? null,
    runbookRef,
    autoExecuteRunbook: false,
  });
}

export function transitionIncidentStatus(
  incident: PersistentIncident,
  status: IncidentStatus,
  atUtc: string,
  actorRole: PersistentIncident['timeline'][number]['actorRole'],
  summary: string,
): PersistentIncident {
  if (!TRANSITIONS[incident.status].includes(status)) {
    throw new Error(`cannot transition incident from ${incident.status} to ${status}`);
  }
  if ((status === 'RESOLVED' || status === 'CLOSED') && incident.customerImpact === 'FINANCIAL_INTEGRITY') {
    if (incident.mitigations.length === 0) {
      throw new Error('financial-integrity incidents require a recorded mitigation before resolve');
    }
  }
  const nextTimeline = Object.freeze([
    ...incident.timeline,
    {
      sequence: incident.timeline[incident.timeline.length - 1]!.sequence + 1n,
      atUtc,
      status,
      actorRole,
      summary,
    },
  ]);
  return Object.freeze({
    ...incident,
    status,
    resolvedAt:
      status === 'RESOLVED'
        ? atUtc
        : status === 'CLOSED'
          ? (incident.resolvedAt ?? atUtc)
          : incident.resolvedAt,
    commander: incident.commander ?? (actorRole === 'INCIDENT_COMMANDER' ? 'INCIDENT_COMMANDER' : incident.commander),
    timeline: nextTimeline,
    postmortemReference:
      status === 'POSTMORTEM_REQUIRED'
        ? (incident.postmortemReference ?? `docs/productization/SUNREY_POSTMORTEM_TEMPLATE.md#${incident.incidentId}`)
        : incident.postmortemReference,
  });
}

export function recordMitigation(
  incident: PersistentIncident,
  atUtc: string,
  summary: string,
  actorRole: PersistentIncident['mitigations'][number]['actorRole'],
): PersistentIncident {
  return Object.freeze({
    ...incident,
    mitigations: Object.freeze([...incident.mitigations, { atUtc, summary, actorRole }]),
  });
}

export function assignCommander(incident: PersistentIncident, commander: NonNullable<PersistentIncident['commander']>): PersistentIncident {
  return Object.freeze({ ...incident, commander });
}

export function sealIncident(vault: EvidenceVault, incident: PersistentIncident): PersistentIncident {
  const sealed = sealIncidentEvidence(vault, 'OPS_CONTROL_ROOM_INCIDENT', {
    incidentId: incident.incidentId,
    severity: incident.severity,
    status: incident.status,
    services: incident.services,
    customerImpact: incident.customerImpact,
    runbookRef: incident.runbookRef,
  });
  return Object.freeze({
    ...incident,
    evidence: Object.freeze([...incident.evidence, sealed.evidenceId]),
  });
}

export class IncidentStore {
  readonly #items = new Map<string, PersistentIncident>();
  readonly evidence: EvidenceVault;

  constructor(
    vault: EvidenceVault = createOpsEvidenceVault(new FrozenClock(asUtcInstant('2026-08-23T00:00:00.000Z'))),
  ) {
    this.evidence = vault;
  }

  put(incident: PersistentIncident): PersistentIncident {
    const sealed = incident.evidence.length === 0 ? sealIncident(this.evidence, incident) : incident;
    this.#items.set(sealed.incidentId, sealed);
    return sealed;
  }

  get(incidentId: string): PersistentIncident | undefined {
    return this.#items.get(incidentId);
  }

  update(incident: PersistentIncident): PersistentIncident {
    if (!this.#items.has(incident.incidentId)) {
      throw new Error(`unknown incident ${incident.incidentId}`);
    }
    this.#items.set(incident.incidentId, incident);
    return incident;
  }

  active(): readonly PersistentIncident[] {
    return [...this.#items.values()].filter((row) => row.status !== 'CLOSED');
  }

  all(): readonly PersistentIncident[] {
    return [...this.#items.values()];
  }
}

export function incidentStatuses(): readonly IncidentStatus[] {
  return INCIDENT_STATUSES;
}
