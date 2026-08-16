import { randomUUID } from 'node:crypto';

import { type Clock } from '../../config/src/clock.ts';
import type { EvidenceVault } from '../../evidence/src/vault.ts';
import type { DomainEventLog } from '../../events/src/events.ts';
import { openComplianceCase, type ComplianceCase } from '../../kernel/src/compliance/cases.ts';
import { detectSurveillanceAlerts } from './detectors.ts';
import { EVIDENCE_KIND_SURVEILLANCE } from './taxonomy.ts';
import type { MarketSnapshot, RestrictionProposal, SurveillanceAlert } from './types.ts';

export class MarketSurveillanceService {
  private readonly evidence: EvidenceVault;
  private readonly events: DomainEventLog;
  private readonly clock: Clock;
  readonly alerts: SurveillanceAlert[] = [];
  readonly cases: ComplianceCase[] = [];
  readonly proposals: RestrictionProposal[] = [];

  constructor(input: {
    readonly evidence: EvidenceVault;
    readonly events: DomainEventLog;
    readonly clock: Clock;
  }) {
    this.evidence = input.evidence;
    this.events = input.events;
    this.clock = input.clock;
  }

  observe(snapshot: MarketSnapshot): readonly SurveillanceAlert[] {
    const found = detectSurveillanceAlerts(snapshot, this.clock.now());
    for (const alert of found) {
      this.alerts.push(alert);
      this.events.append({
        eventType: 'SurveillanceAlertRaised' as never,
        schemaVersion: 1,
        occurredAt: this.clock.now(),
        payload: {
          alertId: alert.alertId,
          kind: alert.kind,
          marketId: alert.marketId,
          legalConclusion: false,
        },
      } as never);
      this.evidence.seal(`${EVIDENCE_KIND_SURVEILLANCE}:alert`, {
        alertId: alert.alertId,
        kind: alert.kind,
        legalConclusion: false,
      });
    }
    return found;
  }

  openCaseFromAlert(alertId: string, jurisdiction = 'GB'): ComplianceCase | undefined {
    const alert = this.alerts.find((item) => item.alertId === alertId);
    if (!alert) {
      return undefined;
    }
    const opened = openComplianceCase({
      caseType: 'TRANSACTION_MONITORING_ALERT',
      reasonCodes: [alert.kind],
      originRefs: [alert.alertId],
      subjectRef: alert.subjectRefs[0] ?? alert.marketId,
      jurisdiction,
      createdAt: this.clock.now(),
    });
    this.cases.push(opened);
    this.events.append({
      eventType: 'SurveillanceCaseOpened' as never,
      schemaVersion: 1,
      occurredAt: this.clock.now(),
      payload: { alertId, caseId: opened.caseId, legalConclusion: false },
    } as never);
    return opened;
  }

  proposeRestriction(input: {
    readonly alertId: string;
    readonly accountId: string;
    readonly proposedStatus: 'RESTRICTED' | 'SUSPENDED';
    readonly actorKind: 'HUMAN_OPERATOR' | 'AGENT' | 'AI';
  }): RestrictionProposal | { readonly ok: false; readonly code: string } {
    if (input.actorKind !== 'HUMAN_OPERATOR') {
      return { ok: false, code: 'AI_CANNOT_PUNISH' };
    }
    const proposal: RestrictionProposal = Object.freeze({
      proposalId: `srp_${randomUUID().replace(/-/g, '')}`,
      alertId: input.alertId,
      accountId: input.accountId,
      proposedStatus: input.proposedStatus,
      applied: false,
      createdAt: this.clock.now(),
    });
    this.proposals.push(proposal);
    this.evidence.seal(`${EVIDENCE_KIND_SURVEILLANCE}:restriction_proposal`, {
      proposalId: proposal.proposalId,
      applied: false,
    });
    return proposal;
  }
}
