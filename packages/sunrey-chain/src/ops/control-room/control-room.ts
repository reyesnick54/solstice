import { ENVIRONMENT } from '../../../../config/src/flags.ts';
import type { Clock } from '../../../../config/src/clock.ts';
import { FrozenClock } from '../../../../config/src/clock.ts';
import { asUtcInstant } from '../../../../domain/src/time.ts';
import type { EvidenceVault } from '../../../../evidence/src/vault.ts';
import { AlertEngine } from '../alerts.ts';
import { createOpsEvidenceVault } from '../evidence.ts';
import { MetricRegistry, StructuredLogSink, TraceCollector } from '../observability.ts';
import { evaluateDomainAlerts, fireBurnRateAlert, REAL_ALERT_PROVIDER_CONNECTED } from './alerts.ts';
import { evaluateErrorBudget } from './burn-rate.ts';
import { buildAuthorityLineage } from './correlation.ts';
import {
  createOperationalIncident,
  sealOperationalIncident,
  transitionIncident,
  withRecoveryConditions,
} from './incidents.ts';
import { paymentRecoveryConditions } from './readiness.ts';
import { controlRoomReport, demoFlags } from './report.ts';
import { evaluateEngineeringSlos } from './slo-evaluation.ts';
import { ingestDomainSnapshots, recordAiSafetyAttempt, recordFinancialSafety, recordSecuritySignals } from './telemetry.ts';
import { appendTimelineEvent, orderedTimeline } from './timeline.ts';
import {
  CONTROL_ROOM_CAPABILITIES,
  type AuthorityLineage,
  type ControlRoomRefusal,
  type DomainSnapshots,
  type IncidentTimelineEvent,
  type OperationalIncident,
} from './types.ts';

export class ControlRoom {
  readonly capabilities = CONTROL_ROOM_CAPABILITIES;
  readonly metrics = new MetricRegistry();
  readonly traces = new TraceCollector();
  readonly logs = new StructuredLogSink();
  readonly alerts = new AlertEngine();
  readonly evidence: EvidenceVault;
  readonly realAlertProviderConnected = REAL_ALERT_PROVIDER_CONNECTED;
  #incidents: OperationalIncident[] = [];
  #timeline: IncidentTimelineEvent[] = [];
  #snapshots: DomainSnapshots = {};
  readonly #clock: Clock;

  constructor(clock: Clock = new FrozenClock(asUtcInstant('2026-08-20T00:00:00.000Z'))) {
    if (ENVIRONMENT !== 'simulation') {
      throw new Error('ENVIRONMENT must remain simulation');
    }
    this.#clock = clock;
    this.evidence = createOpsEvidenceVault(clock);
  }

  ingest(snapshots: DomainSnapshots): void {
    this.#snapshots = snapshots;
    ingestDomainSnapshots(this.metrics, snapshots);
    if (snapshots.security) {
      recordSecuritySignals(this.logs, snapshots.security, 'req_ops', 'tr_ops');
    }
    if (snapshots.financialSafety) {
      recordFinancialSafety(this.logs, snapshots.financialSafety, 'req_ops', 'tr_ops');
    }
    for (const attempt of snapshots.aiSafety ?? []) {
      recordAiSafetyAttempt(this.logs, attempt, 'req_ai', 'tr_ai');
    }
    evaluateDomainAlerts(this.alerts, snapshots, this.#clock.now());
  }

  openPaymentIncident(): OperationalIncident {
    const incident = createOperationalIncident({
      kind: 'PAYMENT_SUBMISSION_UNKNOWN_SURGE',
      startedAt: this.#clock.now(),
      detectedAt: this.#clock.now(),
      affectedComponents: ['payments', 'provider_candidate', 'event_fabric'],
      safeSummary: 'Payment provider degradation produced SUBMISSION_UNKNOWN backlog',
      correlationRefs: [{ requestId: 'req_pay', correlationId: 'corr_pay', operationId: 'op_pay' }],
      providerStates: this.#snapshots.providers?.map((row) => row.technicalHealth) ?? [],
      reconciliationRefs: ['payment-reconciliation'],
      recoveryConditions: paymentRecoveryConditions(this.#snapshots),
    });
    const sealed = sealOperationalIncident(this.evidence, incident);
    this.#incidents.push(sealed.incident);
    this.#timeline = [
      ...appendTimelineEvent(this.#timeline, {
        atUtc: this.#clock.now(),
        kind: 'OBSERVED',
        actor: 'SYSTEM',
        summary: 'provider degradation and SUBMISSION_UNKNOWN backlog observed',
        correlationRefs: { requestId: 'req_pay', operationId: 'op_pay' },
      }),
    ];
    return sealed.incident;
  }

  refreshRecovery(): OperationalIncident {
    const current = this.#requireOpenIncident();
    const next = withRecoveryConditions(current, paymentRecoveryConditions(this.#snapshots));
    this.#incidents[this.#incidents.length - 1] = next;
    if (next.status === 'RECOVERING') {
      this.#timeline = [
        ...appendTimelineEvent(this.#timeline, {
          atUtc: this.#clock.now(),
          kind: 'RECOVERED',
          actor: 'SYSTEM',
          summary: 'provider recovered and reconciliation drained; incident entering RECOVERING',
        }),
      ];
    }
    return next;
  }

  resolveCurrent(): OperationalIncident {
    const current = this.#requireOpenIncident();
    const resolved = transitionIncident(current, 'RESOLVED');
    this.#incidents[this.#incidents.length - 1] = resolved;
    this.#timeline = [
      ...appendTimelineEvent(this.#timeline, {
        atUtc: this.#clock.now(),
        kind: 'DECIDED',
        actor: 'HUMAN',
        summary: 'recovery conditions satisfied; incident resolved',
      }),
    ];
    return resolved;
  }

  recordHumanAction(summary: string): void {
    this.#timeline = [
      ...appendTimelineEvent(this.#timeline, {
        atUtc: this.#clock.now(),
        kind: 'HUMAN_ACTION',
        actor: 'HUMAN',
        summary,
      }),
    ];
  }

  timeline(): readonly IncidentTimelineEvent[] {
    return orderedTimeline(this.#timeline);
  }

  incidents(): readonly OperationalIncident[] {
    return this.#incidents.slice();
  }

  evaluateBudgets() {
    const slos = evaluateEngineeringSlos(this.#snapshots);
    return slos.map((row) => {
      const budget = evaluateErrorBudget({
        sloId: row.slo.id,
        windowMs: 2_592_000_000n,
        elapsedMs: 3_600_000n,
        allowedFailures: 100n,
        observedFailures: row.observedFailures,
      });
      fireBurnRateAlert(this.alerts, budget, this.#clock.now());
      return budget;
    });
  }

  authorityLineage(input: {
    readonly requestId: string;
    readonly intentId: string;
    readonly kernelDecision: string;
    readonly executionAuthorityRef: string;
    readonly mutationRef: string;
    readonly evidenceId: string;
    readonly eventId: string;
    readonly providerSubmissionRef?: string;
  }): AuthorityLineage {
    return buildAuthorityLineage(input);
  }

  report() {
    return controlRoomReport({
      snapshots: this.#snapshots,
      incidents: this.#incidents,
      recommendations: [
        {
          summary: 'Reconcile SUBMISSION_UNKNOWN before retry. Do not auto-execute the runbook.',
          runbookRef: 'docs/operations/chunk-156-sunrey-control-room.md#payment-submission-unknown',
          executable: false,
        },
      ],
    });
  }

  flags(): Record<string, string> {
    return demoFlags(this.report());
  }

  postLedger(): ControlRoomRefusal {
    return refuse('CONTROL_ROOM_CANNOT_POST_LEDGER', 'control room cannot post ledger');
  }

  mint(): ControlRoomRefusal {
    return refuse('CONTROL_ROOM_CANNOT_MINT', 'control room cannot mint');
  }

  issueAuthority(): ControlRoomRefusal {
    return refuse('CONTROL_ROOM_CANNOT_ISSUE_AUTHORITY', 'control room cannot issue Execution Authority');
  }

  signCustodyTransaction(): ControlRoomRefusal {
    return refuse('CONTROL_ROOM_CANNOT_SIGN_CUSTODY', 'control room cannot sign custody transactions');
  }

  modifyProviderCredentials(): ControlRoomRefusal {
    return refuse('CONTROL_ROOM_CANNOT_MODIFY_CREDENTIALS', 'control room cannot modify provider credentials');
  }

  clearSanctionsResult(): ControlRoomRefusal {
    return refuse('CONTROL_ROOM_CANNOT_CLEAR_SANCTIONS', 'control room cannot clear sanctions results');
  }

  changeTokenomics(): ControlRoomRefusal {
    return refuse('CONTROL_ROOM_CANNOT_CHANGE_TOKENOMICS', 'control room cannot change tokenomics');
  }

  enableLiveFlags(): ControlRoomRefusal {
    return refuse('CONTROL_ROOM_CANNOT_ENABLE_LIVE_FLAGS', 'control room cannot enable LIVE_* flags');
  }

  #requireOpenIncident(): OperationalIncident {
    const current = this.#incidents.at(-1);
    if (!current) {
      throw new Error('no incident is open');
    }
    return current;
  }
}

function refuse(code: ControlRoomRefusal['code'], message: string): ControlRoomRefusal {
  return Object.freeze({ ok: false, code, message });
}
