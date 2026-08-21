import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_MONEY_ENABLED, LIVE_PAYMENTS_ENABLED } from '../../config/src/flags.ts';
import { AlertEngine } from './ops/alerts.ts';
import {
  CONTROL_ROOM_METRIC_NAMES,
  MetricRegistry,
  requiredMetricCatalog,
  StructuredLogSink,
  TraceCollector,
} from './ops/observability.ts';
import { assertEngineeringLabel, engineeringSlos } from './ops/slo.ts';
import { assertSafeTelemetryRecord } from './ops/privacy.ts';
import { SLO_LABEL } from './ops/types.ts';
import {
  CONTROL_ROOM_CAPABILITIES,
  ControlRoom,
  MOONREY_EVIDENCE_EDGES,
  PAYMENT_HEALTH_EDGES,
  REAL_ALERT_PROVIDER_CONNECTED,
  aiAuthorityAttempt,
  allEngineeringSlosLabeled,
  appendTimelineEvent,
  buildAuthorityLineage,
  controlRoomDashboards,
  correlateTrace,
  createOperationalIncident,
  degradedEconomic,
  degradedPaymentPath,
  evaluateErrorBudget,
  evaluateEngineeringSlos,
  existingMetricCatalogPreserved,
  expiringCredential,
  fireBurnRateAlert,
  healthySnapshots,
  moonreyEvidenceHealthGraph,
  newMetricCatalog,
  orderedTimeline,
  paymentHealthGraph,
  recoveredPaymentPath,
  rootCauseCandidates,
  runControlRoomDemo,
  sealOperationalIncident,
  startOperationalTrace,
  transitionIncident,
  unifiedMetricCatalog,
  withRecoveryConditions,
} from './ops/control-room/index.ts';
import { ingestCredentialSnapshot, ingestDomainSnapshots } from './ops/control-room/telemetry.ts';
import { createOpsEvidenceVault } from './ops/evidence.ts';
import { FrozenClock } from '../../config/src/clock.ts';
import { asUtcInstant } from '../../domain/src/time.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const CONTROL_ROOM_SRC = join(import.meta.dirname, 'ops/control-room');

function controlRoomSource(): string {
  return [
    'alerts.ts',
    'burn-rate.ts',
    'catalog.ts',
    'control-room.ts',
    'correlation.ts',
    'demo.ts',
    'fixtures.ts',
    'health-graph.ts',
    'incidents.ts',
    'index.ts',
    'readiness.ts',
    'report.ts',
    'slo-evaluation.ts',
    'telemetry.ts',
    'timeline.ts',
    'types.ts',
  ]
    .map((name) => readFileSync(join(CONTROL_ROOM_SRC, name), 'utf8'))
    .join('\n');
}

describe('CHUNK-156 unified production-candidate control room', () => {
  it('1. existing metric catalog is preserved', () => {
    const existing = requiredMetricCatalog();
    assert.equal(existing.includes('finalized_height'), true);
    assert.equal(existing.includes('quorum_availability'), true);
    assert.deepEqual(existingMetricCatalogPreserved(), existing);
    assert.equal(existing.includes('payment_submission_unknown'), false);
  });

  it('2. new metric catalog is complete', () => {
    const required = [
      'credential_expiry_horizon',
      'credential_rotation_required',
      'credential_scope_rejections',
      'credential_resolution_failures',
      'provider_sessions',
      'provider_auth_failures',
      'provider_circuit_open',
      'provider_schema_drift',
      'provider_revalidation_required',
      'payment_submission_unknown',
      'payment_reconciliation_required',
      'payment_callback_replays',
      'payment_settlement_lag',
      'fx_quote_stale_rejections',
      'kyc_provider_unavailable',
      'sanctions_provider_unavailable',
      'aml_provider_unavailable',
      'compliance_manual_review_queue',
      'sunrey_custody_reconciliation',
      'moonrey_custody_reconciliation',
      'cross_asset_rejection_count',
      'custody_submission_unknown',
      'hsm_health',
      'postgres_primary_health',
      'replica_lag',
      'outbox_backlog',
      'inbox_failed',
      'dead_letter_count',
      'recovery_reconciliation_queue',
      'backup_age',
      'oracle_quorum_degradation',
      'productive_value_review_queue',
      'human_contribution_review_queue',
      'supply_reconciliation',
    ];
    for (const name of required) {
      assert.equal((CONTROL_ROOM_METRIC_NAMES as readonly string[]).includes(name), true, name);
      assert.equal(newMetricCatalog().includes(name), true, name);
      assert.equal(unifiedMetricCatalog().includes(name), true, name);
    }
    for (const name of requiredMetricCatalog()) {
      assert.equal(unifiedMetricCatalog().includes(name), true, name);
    }
  });

  it('3-4. low-cardinality enforcement rejects PII metric labels', () => {
    const metrics = new MetricRegistry();
    assert.throws(() => metrics.observe('payment_submission_unknown', 1n, { customerId: 'cus_1' }));
    assert.throws(() => metrics.observe('payment_submission_unknown', 1n, { paymentId: 'pay_1' }));
    assert.throws(() => metrics.observe('payment_submission_unknown', 1n, { email: 'a@b.c' }));
    assert.throws(() => metrics.observe('payment_submission_unknown', 1n, { walletAddress: '0xabc' }));
    assert.throws(() => metrics.observe('payment_submission_unknown', 1n, { requestId: 'req_high_card' }));
    metrics.observe('payment_submission_unknown', 1n, { domain: 'payments', providerClass: 'PAYMENT_RAIL', environment: 'simulation' });
  });

  it('5. credentials are rejected from logs', () => {
    const logs = new StructuredLogSink();
    assert.throws(() =>
      logs.emit({
        service: 'payments',
        requestId: 'req_1',
        traceId: 'tr_1',
        severity: 'INFO',
        eventCode: 'LEAK',
        message: 'resolved secretPath=/providers/payments/token',
      }),
    );
    assert.throws(() =>
      logs.emit({
        service: 'payments',
        requestId: 'req_1',
        traceId: 'tr_1',
        severity: 'INFO',
        eventCode: 'LEAK',
        message: 'Authorization: Bearer abcdef123456',
      }),
    );
  });

  it('6. trace correlation works without putting IDs on metrics', () => {
    const traces = new TraceCollector();
    const span = startOperationalTrace(traces, 'payment_submit', 'payments');
    const correlated = correlateTrace(span, {
      requestId: 'req_pay',
      traceId: span.traceId,
      correlationId: 'corr_pay',
      intentId: 'int_pay',
      evidenceId: 'ev_pay',
      eventId: 'evt_pay',
      operationId: 'op_pay',
      providerSubmissionRef: 'sub_pay',
      chainTransactionRef: 'txn_ref',
    });
    assert.equal(correlated.attributes.requestId, 'req_pay');
    assert.equal(correlated.attributes.intentId, 'int_pay');
    assert.equal(correlated.traceId, span.traceId);
    const metrics = new MetricRegistry();
    assert.throws(() => metrics.observe('payment_submission_unknown', 1n, { correlationId: 'corr_pay' }));
  });

  it('7. authority lineage is read-only and cannot issue authority', () => {
    const lineage = buildAuthorityLineage({
      requestId: 'req_1',
      intentId: 'int_1',
      kernelDecision: 'ALLOW',
      executionAuthorityRef: 'ea_1',
      mutationRef: 'journal_1',
      evidenceId: 'ev_1',
      eventId: 'evt_1',
      providerSubmissionRef: 'sub_1',
    });
    assert.equal(lineage.readOnly, true);
    assert.equal(lineage.canIssueOrRenewAuthority, false);
    assert.deepEqual(lineage.steps, [
      'REQUEST',
      'ACTION_INTENT',
      'KERNEL_DECISION',
      'EXECUTION_AUTHORITY_REF',
      'LEDGER_OR_DOMAIN_MUTATION',
      'EVIDENCE_VAULT_REF',
      'EVENT',
      'EXTERNAL_SUBMISSION',
    ]);
    const room = new ControlRoom();
    assert.equal(room.issueAuthority().ok, false);
    assert.equal(room.capabilities.canIssueAuthority, false);
  });

  it('8. payment health dependency graph reports root-cause candidates', () => {
    const nodes = paymentHealthGraph(degradedPaymentPath());
    const payments = nodes.find((row) => row.id === 'payments');
    const provider = nodes.find((row) => row.id === 'provider_candidate');
    assert.equal(payments?.healthy, false);
    assert.equal(provider?.healthy, false);
    const candidates = rootCauseCandidates(nodes, PAYMENT_HEALTH_EDGES);
    assert.equal(candidates.some((row) => row.nodeId === 'provider_candidate'), true);
    assert.equal(candidates.every((row) => row.correlationIsNotCausation), true);
    assert.equal(PAYMENT_HEALTH_EDGES.some((edge) => edge.from === 'payments' && edge.to === 'kernel'), true);
    assert.equal(PAYMENT_HEALTH_EDGES.some((edge) => edge.from === 'payments' && edge.to === 'ledger'), true);
    assert.equal(PAYMENT_HEALTH_EDGES.some((edge) => edge.from === 'payments' && edge.to === 'fx'), true);
  });

  it('9. MoonRey evidence health graph includes the productive path', () => {
    const nodes = moonreyEvidenceHealthGraph({ economic: degradedEconomic() });
    assert.equal(nodes.find((row) => row.id === 'moonrey_evidence')?.healthy, false);
    assert.equal(nodes.find((row) => row.id === 'oracle_quorum')?.healthy, false);
    assert.equal(nodes.find((row) => row.id === 'monetary_authority')?.healthy, false);
    const candidates = rootCauseCandidates(nodes, MOONREY_EVIDENCE_EDGES);
    assert.equal(candidates.every((row) => row.correlationIsNotCausation), true);
    for (const dep of [
      'economic_data_provider',
      'connector',
      'certification',
      'oracle_quorum',
      'productive_contribution',
      'attribution',
      'productive_value',
      'monetary_authority',
    ]) {
      assert.equal(MOONREY_EVIDENCE_EDGES.some((edge) => edge.to === dep), true, dep);
    }
  });

  it('10. provider technical health is not legal or production approval', () => {
    const healthy = healthySnapshots().providers![0]!;
    assert.equal(healthy.technicalHealth, 'TECHNICALLY_HEALTHY');
    assert.equal(healthy.legalApproval, false);
    assert.equal(healthy.commercialApproval, false);
    assert.equal(healthy.productionAuthorization, false);
    assert.equal(CONTROL_ROOM_CAPABILITIES.providerHealthEqualsLegalApproval, false);
  });

  it('11. SLOs remain engineering-only', () => {
    assertEngineeringLabel();
    assert.equal(allEngineeringSlosLabeled(), true);
    for (const slo of engineeringSlos()) {
      assert.equal(slo.label, SLO_LABEL);
    }
    assert.equal(
      engineeringSlos().some((row) => row.id === 'PAYMENT_WORKFLOW_COMPLETION'),
      true,
    );
  });

  it('12. error budget uses exact integer basis-point math', () => {
    const budget = evaluateErrorBudget({
      sloId: 'PAYMENT_WORKFLOW_COMPLETION',
      windowMs: 2_592_000_000n,
      elapsedMs: 3_600_000n,
      allowedFailures: 100n,
      observedFailures: 20n,
    });
    assert.equal(budget.label, SLO_LABEL);
    assert.equal(budget.remainingFailures, 80n);
    assert.equal(budget.remainingBudgetBps, 8000n);
    assert.equal(budget.consumedBudgetBps, 2000n);
    assert.equal(budget.burnRateBps, 1_440_000n);
    assert.equal(budget.burnCategory, 'FAST');
  });

  it('13. fast burn raises CRITICAL alert objects only', () => {
    const engine = new AlertEngine();
    const budget = evaluateErrorBudget({
      sloId: 'PROVIDER_AVAILABILITY',
      windowMs: 2_592_000_000n,
      elapsedMs: 3_600_000n,
      allowedFailures: 100n,
      observedFailures: 20n,
    });
    const fired = fireBurnRateAlert(engine, budget, '2026-08-20T00:00:00.000Z');
    assert.equal(fired?.code, 'FAST_ERROR_BUDGET_BURN');
    assert.equal(fired?.severity, 'CRITICAL');
    assert.equal(REAL_ALERT_PROVIDER_CONNECTED, false);
  });

  it('14. slow burn raises WARNING alert objects only', () => {
    const engine = new AlertEngine();
    const budget = evaluateErrorBudget({
      sloId: 'EVENT_OUTBOX_DELIVERY',
      windowMs: 2_592_000_000n,
      elapsedMs: 259_200_000n,
      allowedFailures: 100n,
      observedFailures: 30n,
    });
    assert.equal(budget.burnRateBps, 30_000n);
    assert.equal(budget.burnCategory, 'SLOW');
    const fired = fireBurnRateAlert(engine, budget, '2026-08-20T00:00:00.000Z');
    assert.equal(fired?.code, 'SLOW_ERROR_BUDGET_BURN');
    assert.equal(fired?.severity, 'WARNING');
  });

  it('15-18. domain alerts fire for outbox, credential expiry, oracle quorum, and custody reconciliation', () => {
    const room = new ControlRoom();
    room.ingest({
      ...degradedPaymentPath(),
      economic: degradedEconomic(),
      custody: [
        { ...healthySnapshots().custody![0]!, reconciliationMismatches: 1n },
        healthySnapshots().custody![1]!,
      ],
    });
    assert.equal(room.alerts.has('OUTBOX_BACKLOG'), true);
    assert.equal(room.alerts.has('CREDENTIAL_EXPIRY'), true);
    assert.equal(room.alerts.has('ORACLE_QUORUM_DEGRADATION'), true);
    assert.equal(room.alerts.has('CUSTODY_RECONCILIATION_MISMATCH'), true);
  });

  it('19. supply reconciliation is CRITICAL', () => {
    const room = new ControlRoom();
    room.ingest({ economic: degradedEconomic() });
    assert.equal(room.alerts.has('SUPPLY_RECONCILIATION'), true);
    assert.equal(room.alerts.active().find((row) => row.code === 'SUPPLY_RECONCILIATION')?.severity, 'CRITICAL');
  });

  it('20. incident timeline is ordered and not rewritten', () => {
    let events = appendTimelineEvent([], {
      atUtc: '2026-08-20T00:02:00.000Z',
      kind: 'HUMAN_ACTION',
      actor: 'HUMAN',
      summary: 'operator acknowledged',
    });
    events = appendTimelineEvent(events, {
      atUtc: '2026-08-20T00:00:00.000Z',
      kind: 'OBSERVED',
      actor: 'SYSTEM',
      summary: 'degradation observed',
    });
    events = appendTimelineEvent(events, {
      atUtc: '2026-08-20T00:01:00.000Z',
      kind: 'DECIDED',
      actor: 'CONTROL_ROOM',
      summary: 'incident opened',
    });
    const ordered = orderedTimeline(events);
    assert.deepEqual(
      ordered.map((row) => row.summary),
      ['degradation observed', 'incident opened', 'operator acknowledged'],
    );
    assert.equal(ordered[0]?.sequence, 2n);
    assert.equal(events[0]?.summary, 'operator acknowledged');
  });

  it('21. incident evidence is safe and sealed', () => {
    const vault = createOpsEvidenceVault(new FrozenClock(asUtcInstant('2026-08-20T00:00:00.000Z')));
    const incident = createOperationalIncident({
      kind: 'PAYMENT_SUBMISSION_UNKNOWN_SURGE',
      startedAt: '2026-08-20T00:00:00.000Z',
      detectedAt: '2026-08-20T00:00:00.000Z',
      affectedComponents: ['payments'],
      safeSummary: 'SUBMISSION_UNKNOWN backlog',
      recoveryConditions: [{ id: 'provider_technically_healthy', satisfied: false, detail: 'still degraded' }],
    });
    const sealed = sealOperationalIncident(vault, incident);
    assert.equal(sealed.incident.evidenceRefs.length, 1);
    assertSafeTelemetryRecord(vault.list()[0]!.payload as Record<string, unknown>, 'evidence');
    const payload = JSON.stringify(vault.list()[0]!.payload);
    assert.equal(payload.includes('privateKey'), false);
    assert.equal(payload.includes('apiToken'), false);
  });

  it('22. resolved requires recovery conditions, not just a green health endpoint', () => {
    const incident = createOperationalIncident({
      kind: 'PAYMENT_SUBMISSION_UNKNOWN_SURGE',
      startedAt: '2026-08-20T00:00:00.000Z',
      detectedAt: '2026-08-20T00:00:00.000Z',
      affectedComponents: ['payments'],
      safeSummary: 'SUBMISSION_UNKNOWN backlog',
      recoveryConditions: [
        { id: 'provider_technically_healthy', satisfied: true, detail: 'green' },
        { id: 'submission_unknown_drained', satisfied: false, detail: 'backlog remains' },
        { id: 'reconciliation_complete', satisfied: false, detail: 'reconciliation remains' },
      ],
    });
    assert.throws(() => transitionIncident(incident, 'RESOLVED'));
    const recovering = withRecoveryConditions(incident, [
      { id: 'provider_technically_healthy', satisfied: true, detail: 'green' },
      { id: 'submission_unknown_drained', satisfied: true, detail: 'drained' },
      { id: 'reconciliation_complete', satisfied: true, detail: 'complete' },
    ]);
    assert.equal(recovering.status, 'RECOVERING');
    assert.equal(transitionIncident(recovering, 'RESOLVED').status, 'RESOLVED');
  });

  it('23-26. control room cannot post ledger, mint, issue authority, or enable LIVE flags', () => {
    const room = new ControlRoom();
    assert.equal(room.postLedger().ok, false);
    assert.equal(room.mint().ok, false);
    assert.equal(room.issueAuthority().ok, false);
    assert.equal(room.enableLiveFlags().ok, false);
    assert.equal(room.capabilities.canPostLedger, false);
    assert.equal(room.capabilities.canMint, false);
    assert.equal(room.capabilities.canIssueAuthority, false);
    assert.equal(room.capabilities.canEnableLiveFlags, false);
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_MONEY_ENABLED, false);
    assert.equal(LIVE_PAYMENTS_ENABLED, false);
    const source = controlRoomSource();
    assert.equal(source.includes('Ledger.postJournal'), false);
    assert.equal(source.includes('issueExecutionAuthority'), false);
    assert.equal(source.includes('LIVE_MONEY_ENABLED = true'), false);
    assert.equal(existsSync(join(ROOT, 'packages/observability')), false);
    assert.equal(existsSync(join(ROOT, 'packages/control-room')), false);
  });

  it('27. AI authority attempt raises an alert only and does not score a human', () => {
    const room = new ControlRoom();
    const attempt = aiAuthorityAttempt();
    assert.equal(attempt.humanScoreChanged, false);
    room.ingest({ ...healthySnapshots(), aiSafety: [attempt] });
    assert.equal(room.alerts.has('AI_AUTHORITY_ATTEMPT'), true);
    assert.equal(room.logs.records().some((row) => row.eventCode === 'AI_AUTHORITY_ATTEMPT'), true);
  });

  it('28. no real alert provider is contacted', () => {
    assert.equal(REAL_ALERT_PROVIDER_CONNECTED, false);
    assert.equal(CONTROL_ROOM_CAPABILITIES.realAlertProviderConnected, false);
    const source = readFileSync(join(CONTROL_ROOM_SRC, 'alerts.ts'), 'utf8');
    assert.equal(source.includes('pagerduty'), false);
    assert.equal(source.includes('slack.com'), false);
  });

  it('ingests snapshots and evaluates engineering SLOs', () => {
    const metrics = new MetricRegistry();
    ingestDomainSnapshots(metrics, healthySnapshots());
    ingestCredentialSnapshot(metrics, expiringCredential());
    const names = new Set(metrics.snapshot().map((row) => row.name));
    for (const name of newMetricCatalog()) {
      assert.equal(names.has(name), true, name);
    }
    const slos = evaluateEngineeringSlos(healthySnapshots());
    assert.equal(slos.every((row) => row.slo.label === SLO_LABEL), true);
    assert.equal(controlRoomDashboards().length >= 12, true);
  });

  it('demo walks healthy → incident → recovering → resolved', () => {
    const result = runControlRoomDemo() as {
      readonly healthyState: string;
      readonly degradedState: string;
      readonly incident: { readonly statusAfterOpen: string; readonly statusAfterRecovery: string; readonly statusAfterResolve: string };
      readonly flags: Record<string, string>;
    };
    assert.equal(result.healthyState, 'NORMAL');
    assert.equal(result.degradedState, 'INCIDENT');
    assert.equal(result.incident.statusAfterOpen, 'OPEN');
    assert.equal(result.incident.statusAfterRecovery, 'RECOVERING');
    assert.equal(result.incident.statusAfterResolve, 'RESOLVED');
    assert.equal(result.flags.CONTROL_ROOM_CAN_POST_LEDGER, 'false');
    assert.equal(result.flags.CONTROL_ROOM_CAN_MINT, 'false');
    assert.equal(result.flags.CONTROL_ROOM_CAN_ISSUE_AUTHORITY, 'false');
    assert.equal(result.flags.METRICS_CONTAIN_PII, 'false');
    assert.equal(result.flags.LOGS_CONTAIN_CREDENTIALS, 'false');
    assert.equal(result.flags.PROVIDER_HEALTH_EQUALS_LEGAL_APPROVAL, 'false');
    assert.equal(result.flags.ENGINEERING_SLOS_ONLY, 'true');
    assert.equal(result.flags.REAL_ALERT_PROVIDER_CONNECTED, 'false');
    assert.equal(result.flags.PRODUCTION_ACTIVE, 'false');
  });
});
