import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_MONEY_ENABLED, LIVE_PAYMENTS_ENABLED } from '../../config/src/flags.ts';
import { MetricRegistry, StructuredLogSink, TraceCollector } from './ops/observability.ts';
import { assertSafeTelemetryRecord } from './ops/privacy.ts';
import {
  CHAOS_SCENARIOS,
  ENGINEERING_TARGET_LABEL,
  INCIDENT_STATUSES,
  IncidentStore,
  PRODUCTIZATION_ALERT_CODES,
  REQUIRED_RUNBOOKS,
  SEVERITY_LEVELS,
  SLI_IDS,
  SRE_CAPABILITIES,
  SRE_OWNER,
  SreReliabilityPlatform,
  TELEMETRY_SYSTEMS,
  applyChaos,
  assertEngineeringTargets,
  assertNoPiiMetricLabels,
  backupCatalogAligned,
  backupClaim,
  backupSchedules,
  buildControlRoomReadModel,
  chainRecoveryPlan,
  configurationBackupPolicy,
  createIncident,
  degradedModeCatalogComplete,
  degradedModes,
  emitOperationalLog,
  emitProductizationMetric,
  evaluateProductizationAlerts,
  globalKillSwitchExists,
  inventoryComplete,
  killSwitchCatalog,
  killSwitchCatalogComplete,
  namedStaffInvented,
  objectStorageBackupPolicies,
  pitrConfigured,
  pitrEngineeringTarget,
  pitrRestoreProbe,
  postmortemTemplate,
  productizationAlerts,
  productizationMetricCatalog,
  productizationSlos,
  recordMitigation,
  redactAttribute,
  rehearseChainRecovery,
  requiredLogFields,
  runRestoreTest,
  runSreDemo,
  runbookCatalog,
  runbookCatalogComplete,
  severityCatalogComplete,
  sliCatalogComplete,
  sliDefinitions,
  staffingGaps,
  telemetryBlindSpots,
  telemetryInventory,
  traceCriticalFlow,
  tracePropagated,
  transitionIncidentStatus,
} from './ops/sre/index.ts';
import { degradedPaymentPath, degradedSreSignals, healthySnapshots, incidentSreSignals } from './ops/sre/fixtures.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');

describe('Phase I Prompt 3 — observability, SRE, incident response, backups, DR', () => {
  it('1. telemetry inventory covers every required system and records blind spots', () => {
    assert.equal(inventoryComplete(), true);
    assert.equal(telemetryInventory().length, TELEMETRY_SYSTEMS.length);
    const systems = new Set(telemetryInventory().map((row) => row.system));
    for (const system of TELEMETRY_SYSTEMS) {
      assert.equal(systems.has(system), true);
    }
    assert.equal(telemetryBlindSpots().length > 0, true);
    assert.equal(
      telemetryInventory().every((row) => !/apy|yield|blended/i.test(row.notes)),
      true,
    );
  });

  it('2. metric emission uses only aggregate labels and refuses PII', () => {
    const registry = new MetricRegistry();
    emitProductizationMetric(registry, 'api_requests', 4n, { status: 'ok', environment: 'simulation' });
    emitProductizationMetric(registry, 'ledger_post_success', 1n);
    emitProductizationMetric(registry, 'queue_depth', 0n);
    emitProductizationMetric(registry, 'reconciliation_breaks', 0n);
    emitProductizationMetric(registry, 'agent_health', 1n);
    emitProductizationMetric(registry, 'exchange_health', 1n);
    emitProductizationMetric(registry, 'chain_height', 4n);
    const snapshot = registry.snapshot();
    assert.equal(snapshot.length >= 7, true);
    for (const sample of snapshot) {
      assertSafeTelemetryRecord(sample, 'metrics');
      assertNoPiiMetricLabels(sample.labels);
    }
    assert.throws(() => assertNoPiiMetricLabels({ customerId: 'cust_1' }));
    assert.equal(productizationMetricCatalog().includes('api_requests'), true);
    assert.equal(productizationMetricCatalog().includes('job_age_ms'), true);
  });

  it('3. structured logs include required fields and redact secrets; logs are not evidence', () => {
    const sink = new StructuredLogSink();
    const record = emitOperationalLog(sink, {
      timestamp: '2026-08-23T09:00:00.000Z',
      service: 'sunrey-platform-api',
      requestId: 'req_1',
      correlationId: 'corr_1',
      traceId: 'tr_1',
      severity: 'INFO',
      eventCode: 'API_REQUEST',
      message: 'request completed',
      attributes: { authorization: 'Bearer secret-token', note: 'ok' },
    });
    for (const field of requiredLogFields()) {
      assert.equal(field in record, true);
    }
    assert.equal(record.environment, 'simulation');
    assert.equal(record.canonicalFinancialEvidence, false);
    assert.equal(record.attributes.authorization, '[REDACTED]');
    assert.equal(record.attributes.note, 'ok');
    assert.equal(redactAttribute('apiKey', 'sk_live_example'), '[REDACTED]');
    assert.equal(sink.records().length, 1);
  });

  it('4. critical traces propagate one traceId across Kernel, Agent, and Exchange flows', () => {
    const traces = new TraceCollector();
    const api = traceCriticalFlow(traces, 'API_KERNEL_LEDGER', {
      requestId: 'req_api',
      correlationId: 'corr_api',
      intentId: 'intent_api',
      evidenceId: 'ev_api',
      eventId: 'evt_api',
    });
    const agent = traceCriticalFlow(traces, 'AGENT_PROPOSAL', {
      requestId: 'req_agent',
      correlationId: 'corr_agent',
    });
    const exchange = traceCriticalFlow(traces, 'EXCHANGE_SETTLEMENT', {
      requestId: 'req_ex',
      correlationId: 'corr_ex',
    });
    assert.equal(tracePropagated(api), true);
    assert.equal(tracePropagated(agent), true);
    assert.equal(tracePropagated(exchange), true);
    assert.equal(api.spans[0]!.name, 'api.request');
    assert.equal(api.spans.at(-1)!.name, 'evidence.seal');
    assert.equal(agent.spans.some((span) => span.name === 'proposal.gate'), true);
    assert.equal(exchange.spans.some((span) => span.name === 'exchange.match'), true);
    assert.equal(api.lineage?.canIssueOrRenewAuthority, false);
  });

  it('5. SLIs and ENGINEERING_TARGET SLOs exist without contractual SLAs', () => {
    assert.equal(sliCatalogComplete(), true);
    assert.equal(sliDefinitions().length, SLI_IDS.length);
    const slos = productizationSlos();
    assertEngineeringTargets(slos);
    assert.equal(slos.every((row) => row.label === ENGINEERING_TARGET_LABEL), true);
    assert.equal(slos.every((row) => row.contractualSla === false), true);
    assert.equal(slos.every((row) => row.humanApproved === false), true);
  });

  it('6. alerts fire for required conditions and never auto-execute', () => {
    const healthy = evaluateProductizationAlerts({
      apiAvailable: true,
      databaseHealthy: true,
      errorRateBps: 0n,
      queueDepth: 0n,
      ledgerPostFailure: false,
      providerHealthy: true,
      reconciliationBreaks: 0n,
      treasuryLiquidityWarning: false,
      exchangeHalted: false,
      chainStalled: false,
      validatorLoss: false,
      walletBacklog: 0n,
      agentHealthy: true,
      securityAnomaly: false,
      vaultAccessAnomaly: false,
    });
    assert.equal(healthy.length, 0);
    const fired = evaluateProductizationAlerts({
      apiAvailable: false,
      databaseHealthy: false,
      errorRateBps: 800n,
      queueDepth: 200n,
      ledgerPostFailure: true,
      providerHealthy: false,
      reconciliationBreaks: 2n,
      treasuryLiquidityWarning: true,
      exchangeHalted: true,
      chainStalled: true,
      validatorLoss: true,
      walletBacklog: 40n,
      agentHealthy: false,
      securityAnomaly: true,
      vaultAccessAnomaly: true,
    });
    assert.equal(fired.length, PRODUCTIZATION_ALERT_CODES.length);
    assert.equal(fired.every((row) => row.autoExecute === false), true);
    assert.equal(productizationAlerts().length, PRODUCTIZATION_ALERT_CODES.length);
    assert.equal(severityCatalogComplete(), true);
    assert.equal(SEVERITY_LEVELS.includes('SEV1'), true);
  });

  it('7. persistent incidents support required fields and states', () => {
    const store = new IncidentStore();
    let incident = store.put(
      createIncident({
        severity: 'SEV1',
        services: ['API', 'LEDGER'],
        startedAt: '2026-08-23T09:00:00.000Z',
        detectedAt: '2026-08-23T09:00:01.000Z',
        customerImpact: 'PARTIAL_OUTAGE',
        summary: 'API and ledger posting degraded',
        alertCode: 'API_OUTAGE',
        commander: 'INCIDENT_COMMANDER',
      }),
    );
    assert.equal(incident.status, 'DETECTED');
    assert.equal(incident.commander, 'INCIDENT_COMMANDER');
    assert.equal(incident.autoExecuteRunbook, false);
    assert.equal(incident.evidence.length > 0, true);
    incident = store.update(transitionIncidentStatus(incident, 'INVESTIGATING', '2026-08-23T09:05:00.000Z', 'INCIDENT_COMMANDER', 'investigating'));
    incident = store.update(transitionIncidentStatus(incident, 'MITIGATING', '2026-08-23T09:10:00.000Z', 'OPERATIONS_AUTHORITY', 'mitigating'));
    incident = store.update(transitionIncidentStatus(incident, 'MONITORING', '2026-08-23T09:15:00.000Z', 'OPERATIONS_AUTHORITY', 'monitoring'));
    incident = store.update(transitionIncidentStatus(incident, 'RESOLVED', '2026-08-23T09:20:00.000Z', 'INCIDENT_COMMANDER', 'resolved'));
    incident = store.update(transitionIncidentStatus(incident, 'POSTMORTEM_REQUIRED', '2026-08-23T09:25:00.000Z', 'INCIDENT_COMMANDER', 'postmortem'));
    incident = store.update(transitionIncidentStatus(incident, 'CLOSED', '2026-08-23T10:00:00.000Z', 'INCIDENT_COMMANDER', 'closed'));
    assert.equal(incident.status, 'CLOSED');
    assert.equal(incident.resolvedAt, '2026-08-23T09:20:00.000Z');
    assert.equal(incident.postmortemReference?.includes(incident.incidentId), true);
    assert.deepEqual(INCIDENT_STATUSES, [
      'DETECTED',
      'INVESTIGATING',
      'MITIGATING',
      'MONITORING',
      'RESOLVED',
      'POSTMORTEM_REQUIRED',
      'CLOSED',
    ]);
    assert.throws(() => transitionIncidentStatus(incident, 'DETECTED', '2026-08-23T11:00:00.000Z', 'SYSTEM', 'no'));
  });

  it('8. financial-integrity incidents require a mitigation before resolve', () => {
    const incident = createIncident({
      severity: 'SEV1',
      services: ['LEDGER'],
      startedAt: '2026-08-23T09:00:00.000Z',
      detectedAt: '2026-08-23T09:00:01.000Z',
      customerImpact: 'FINANCIAL_INTEGRITY',
      summary: 'ledger invariant failed',
      alertCode: 'LEDGER_POSTING_FAILURE',
    });
    const investigating = transitionIncidentStatus(incident, 'INVESTIGATING', '2026-08-23T09:05:00.000Z', 'INCIDENT_COMMANDER', 'investigating');
    const mitigating = transitionIncidentStatus(investigating, 'MITIGATING', '2026-08-23T09:06:00.000Z', 'TREASURY', 'halt writes');
    assert.throws(() => transitionIncidentStatus(mitigating, 'RESOLVED', '2026-08-23T09:07:00.000Z', 'INCIDENT_COMMANDER', 'too soon'));
    const recorded = recordMitigation(mitigating, '2026-08-23T09:06:30.000Z', 'mutations paused; no invented journals', 'TREASURY');
    const resolved = transitionIncidentStatus(recorded, 'RESOLVED', '2026-08-23T09:08:00.000Z', 'INCIDENT_COMMANDER', 'integrity held');
    assert.equal(resolved.status, 'RESOLVED');
  });

  it('9. control-room read model covers required planes and hides secrets', () => {
    const platform = new SreReliabilityPlatform();
    platform.ingest(healthySnapshots());
    const healthy = platform.readModel();
    assert.equal(healthy.environment, 'simulation');
    assert.equal(healthy.productionActive, false);
    assert.equal(healthy.secretsPresent, false);
    assert.equal(healthy.overall, 'HEALTHY');
    assert.equal(healthy.killSwitches.length, 8);
    platform.ingest(degradedPaymentPath(), degradedSreSignals());
    const degraded = platform.readModel();
    assert.equal(degraded.overall === 'DEGRADED' || degraded.overall === 'INCIDENT', true);
    assert.equal(degraded.payments !== 'HEALTHY' || degraded.providers !== 'HEALTHY', true);
    assert.equal(degraded.agent, 'UNAVAILABLE');
    const incidentRoom = buildControlRoomReadModel({
      snapshots: healthySnapshots(),
      incidents: [
        createIncident({
          severity: 'SEV1',
          services: ['API'],
          startedAt: '2026-08-23T09:00:00.000Z',
          detectedAt: '2026-08-23T09:00:01.000Z',
          customerImpact: 'FULL_OUTAGE',
          summary: 'API down',
          alertCode: 'API_OUTAGE',
        }),
      ],
      signals: incidentSreSignals(),
    });
    assert.equal(incidentRoom.overall, 'INCIDENT');
    assert.equal(incidentRoom.security, 'ANOMALY');
  });

  it('10. kill-switch catalog is domain-scoped and has no global off switch', () => {
    assert.equal(killSwitchCatalogComplete(), true);
    assert.equal(globalKillSwitchExists(), false);
    assert.equal(killSwitchCatalog().every((row) => row.globalDestructiveOff === false), true);
    assert.equal(killSwitchCatalog().every((row) => row.controlRoomCanEngage === false), true);
    const domains = killSwitchCatalog().map((row) => row.domain);
    for (const required of ['PROVIDER', 'PAYMENTS', 'FX', 'CARDS', 'AGENT', 'EXCHANGE_MARKET', 'WITHDRAWALS', 'DATA_MARKETPLACE']) {
      assert.equal(domains.includes(required as (typeof domains)[number]), true);
    }
  });

  it('11. required runbooks exist on disk and never auto-execute', () => {
    assert.equal(runbookCatalogComplete(), true);
    assert.equal(runbookCatalog().length, REQUIRED_RUNBOOKS.length);
    for (const runbook of runbookCatalog()) {
      assert.equal(existsSync(join(ROOT, runbook.path)), true, runbook.path);
      assert.equal(runbook.autoExecute, false);
    }
  });

  it('12. backup configuration, object storage, and config backup exclude secrets', () => {
    assert.equal(backupCatalogAligned(), true);
    assert.equal(backupSchedules().every((row) => row.integrityVerification && row.restoreTestingRequired), true);
    assert.equal(backupClaim('CONFIGURED_UNTESTED').works, false);
    assert.equal(backupClaim('RESTORE_TESTED').works, true);
    assert.equal(objectStorageBackupPolicies().every((row) => row.secretsCopiedIntoOrdinaryArchive === false), true);
    const config = configurationBackupPolicy();
    assert.equal(config.ordinaryArchiveContainsSecrets, false);
    assert.equal(config.secretsRestoredViaSecretSystem, true);
  });

  it('13. restore test actually runs against an isolated blank target', () => {
    const record = runRestoreTest();
    assert.equal(record.result, 'PASS');
    assert.equal(record.backupCreated, true);
    assert.equal(record.isolatedBlankTarget, true);
    assert.equal(record.restored, true);
    assert.equal(record.integrityValidated, true);
    assert.equal(record.applicationSmokePassed, true);
    assert.equal(record.ledgerInvariantsPassed, true);
    assert.equal(record.inventedJournals, false);
    assert.equal(record.claimBackupWorks, true);
  });

  it('14. PITR is local WAL archive with engineering RPO/RTO only', () => {
    const target = pitrEngineeringTarget();
    assert.equal(pitrConfigured(), true);
    assert.equal(pitrRestoreProbe(), true);
    assert.equal(target.mode, 'LOCAL_WAL_ARCHIVE');
    assert.equal(target.managedCloudPitrClaimed, false);
    assert.equal(target.label, ENGINEERING_TARGET_LABEL);
    assert.equal(target.humanApproved, false);
    assert.equal(target.targetRpoMs, 120_000n);
    assert.equal(target.targetRtoMs, 600_000n);
  });

  it('15. chain recovery rehearses snapshots, restart, and genesis protection', () => {
    const plan = chainRecoveryPlan();
    assert.equal(plan.unverifiedProviderAccepted, false);
    assert.equal(plan.genesisProtection, true);
    const rehearsal = rehearseChainRecovery();
    assert.equal(rehearsal.snapshotVerified, true);
    assert.equal(rehearsal.genesisProtected, true);
    assert.equal(rehearsal.unverifiedRefused, true);
    assert.equal(rehearsal.restartSafe, true);
  });

  it('16. chaos scenarios keep financial integrity and production disabled', () => {
    for (const scenario of CHAOS_SCENARIOS) {
      const result = applyChaos(scenario);
      assert.equal(result.applied, true);
      assert.equal(result.financialIntegritySurvived, true);
      assert.equal(result.inventedJournals, false);
      assert.equal(result.productionRemainedDisabled, true);
      assert.equal(result.liveFlagsUnchanged, true);
    }
  });

  it('17. degraded modes keep Money UI usable and do not invent providers', () => {
    assert.equal(degradedModeCatalogComplete(), true);
    const modes = degradedModes();
    assert.equal(modes.find((row) => row.id === 'AGENT_UNAVAILABLE')?.moneyUiUsable, true);
    assert.equal(modes.find((row) => row.id === 'EXCHANGE_UNAVAILABLE')?.remainsAvailable.includes('banking'), true);
    assert.equal(modes.find((row) => row.id === 'FX_PROVIDER_UNAVAILABLE')?.remainsAvailable.includes('same-currency transfers'), true);
    assert.equal(modes.find((row) => row.id === 'CUSTODY_UNAVAILABLE')?.paused.includes('withdrawals'), true);
    assert.equal(modes.every((row) => row.inventSubstituteProvider === false), true);
  });

  it('18. on-call roles exist without invented named staff', () => {
    assert.equal(namedStaffInvented(), false);
    assert.equal(staffingGaps().length >= 4, true);
    assert.equal(SRE_OWNER, 'packages/sunrey-chain/src/ops');
  });

  it('19. postmortem template is blameless and complete', () => {
    const template = postmortemTemplate();
    assert.equal(template.blame, false);
    assert.equal(template.focus, 'systems');
    assert.equal(template.sections.length, 8);
    assert.equal(existsSync(join(ROOT, template.path)), true);
  });

  it('20. platform demo, production gates, and required documents hold', () => {
    const demo = runSreDemo();
    assert.equal(demo.restore, 'PASS');
    assert.equal(demo.chaosPassed, true);
    assert.equal(demo.productionDisabled, true);
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_MONEY_ENABLED, false);
    assert.equal(LIVE_PAYMENTS_ENABLED, false);
    assert.equal(SRE_CAPABILITIES.productionActive, false);
    assert.equal(SRE_CAPABILITIES.canPostLedger, false);
    assert.equal(SRE_CAPABILITIES.canEngageGlobalKillSwitch, false);
    for (const doc of [
      'docs/productization/PHASE_I_03_SRE_DR.md',
      'docs/productization/SUNREY_INCIDENT_RESPONSE_PLAN.md',
      'docs/productization/SUNREY_PRODUCTION_RUNBOOK_INDEX.md',
      'docs/productization/SUNREY_DISASTER_RECOVERY_PLAN.md',
    ]) {
      assert.equal(existsSync(join(ROOT, doc)), true, doc);
      const text = readFileSync(join(ROOT, doc), 'utf8');
      assert.equal(/PRODUCTION_ACTIVE=true|ENVIRONMENT=production|LIVE_MONEY_ENABLED=true/.test(text), false, doc);
    }
  });
});
