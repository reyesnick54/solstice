import { ENVIRONMENT, LIVE_MONEY_ENABLED, LIVE_PAYMENTS_ENABLED } from '../../../../config/src/flags.ts';
import { AlertEngine } from '../alerts.ts';
import { ControlRoom } from '../control-room/control-room.ts';
import { healthySnapshots } from '../control-room/fixtures.ts';
import type { DomainSnapshots } from '../control-room/types.ts';
import { MetricRegistry, StructuredLogSink, TraceCollector } from '../observability.ts';
import { evaluateProductizationAlerts, mapToExistingAlertEngine } from './alerts.ts';
import { runAllChaosScenarios, type ChaosResult } from './chaos.ts';
import { degradedModes } from './continuity.ts';
import { createIncident, IncidentStore, transitionIncidentStatus } from './incident.ts';
import { killSwitchCatalog } from './kill-switches.ts';
import { emitOperationalLog } from './logging.ts';
import { emitProductizationMetric } from './metrics.ts';
import { staffingGaps } from './on-call.ts';
import { pitrConfigured, pitrRestoreProbe } from './pitr.ts';
import { buildControlRoomReadModel, type ReadModelSignals } from './read-model.ts';
import { runRestoreTest } from './restore.ts';
import { rehearseChainRecovery } from './chain-recovery.ts';
import { telemetryInventory } from './telemetry-audit.ts';
import { CRITICAL_TRACE_FLOWS, traceCriticalFlow } from './tracing.ts';
import { SRE_CAPABILITIES, type ControlRoomReadModel, type PersistentIncident, type RestoreTestRecord } from './types.ts';

export type SreSignals = ReadModelSignals & {
  readonly apiAvailable: boolean;
  readonly databaseHealthy: boolean;
  readonly errorRateBps: bigint;
  readonly queueDepth: bigint;
  readonly ledgerPostFailure: boolean;
  readonly providerHealthy: boolean;
  readonly reconciliationBreaks: bigint;
  readonly treasuryLiquidityWarning: boolean;
  readonly exchangeHalted: boolean;
  readonly chainStalled: boolean;
  readonly validatorLoss: boolean;
  readonly walletBacklog: bigint;
  readonly agentHealthy: boolean;
  readonly securityAnomaly: boolean;
  readonly vaultAccessAnomaly: boolean;
};

export const HEALTHY_SRE_SIGNALS: SreSignals = Object.freeze({
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

export class SreReliabilityPlatform {
  readonly capabilities = SRE_CAPABILITIES;
  readonly metrics = new MetricRegistry();
  readonly traces = new TraceCollector();
  readonly logs = new StructuredLogSink();
  readonly alerts = new AlertEngine();
  readonly incidents = new IncidentStore();
  readonly controlRoom = new ControlRoom();
  #snapshots: DomainSnapshots = healthySnapshots();
  #signals: SreSignals = HEALTHY_SRE_SIGNALS;

  constructor() {
    if (ENVIRONMENT !== 'simulation' || LIVE_MONEY_ENABLED || LIVE_PAYMENTS_ENABLED) {
      throw new Error('SRE platform refuses to start unless production remains disabled');
    }
  }

  ingest(snapshots: DomainSnapshots, signals: SreSignals = HEALTHY_SRE_SIGNALS): void {
    this.#snapshots = snapshots;
    this.#signals = signals;
    this.controlRoom.ingest(snapshots);
    emitProductizationMetric(this.metrics, 'api_requests', 1n, { status: signals.apiAvailable ? 'ok' : 'down' });
    emitProductizationMetric(this.metrics, 'database_health', signals.databaseHealthy ? 1n : 0n);
    emitProductizationMetric(this.metrics, 'queue_depth', signals.queueDepth);
    emitProductizationMetric(this.metrics, 'reconciliation_breaks', signals.reconciliationBreaks);
    emitProductizationMetric(this.metrics, 'agent_health', signals.agentHealthy ? 1n : 0n);
    emitProductizationMetric(this.metrics, 'exchange_health', signals.exchangeHalted ? 0n : 1n);
    emitProductizationMetric(this.metrics, 'chain_height', 4n);
    emitProductizationMetric(this.metrics, 'wallet_processing_backlog', signals.walletBacklog);
    emitProductizationMetric(this.metrics, 'vault_access_anomaly', signals.vaultAccessAnomaly ? 1n : 0n);
    emitOperationalLog(this.logs, {
      timestamp: '2026-08-23T09:00:00.000Z',
      service: 'sunrey-ops',
      requestId: 'req_sre',
      correlationId: 'corr_sre',
      traceId: 'tr_sre',
      severity: signals.securityAnomaly ? 'CRITICAL' : 'INFO',
      eventCode: signals.securityAnomaly ? 'SECURITY_ANOMALY' : 'SRE_INGEST',
      message: 'operational snapshot ingested',
    });
    const fired = evaluateProductizationAlerts(signals);
    mapToExistingAlertEngine(this.alerts, fired, '2026-08-23T09:00:00.000Z');
    for (const alert of fired) {
      this.incidents.put(
        createIncident({
          severity: alert.severity,
          services: ['API'],
          startedAt: '2026-08-23T09:00:00.000Z',
          detectedAt: '2026-08-23T09:00:00.000Z',
          customerImpact: alert.severity === 'SEV1' ? 'PARTIAL_OUTAGE' : 'DEGRADED',
          summary: alert.description,
          alertCode: alert.code,
        }),
      );
    }
    for (const flow of CRITICAL_TRACE_FLOWS) {
      traceCriticalFlow(this.traces, flow, {
        requestId: 'req_sre',
        correlationId: 'corr_sre',
        intentId: 'intent_sre',
        evidenceId: 'ev_sre',
        eventId: 'evt_sre',
      });
    }
  }

  readModel(): ControlRoomReadModel {
    return buildControlRoomReadModel({
      snapshots: this.#snapshots,
      incidents: this.incidents.active(),
      signals: this.#signals,
    });
  }

  resolveActive(summary = 'recovery conditions satisfied'): readonly PersistentIncident[] {
    return this.incidents.active().map((incident) => {
      let current = incident;
      if (current.status === 'DETECTED') {
        current = this.incidents.update(
          transitionIncidentStatus(current, 'INVESTIGATING', '2026-08-23T09:05:00.000Z', 'INCIDENT_COMMANDER', 'investigating'),
        );
      }
      if (current.status === 'INVESTIGATING') {
        current = this.incidents.update(
          transitionIncidentStatus(current, 'MITIGATING', '2026-08-23T09:10:00.000Z', 'OPERATIONS_AUTHORITY', 'mitigating'),
        );
      }
      if (current.status === 'MITIGATING') {
        current = this.incidents.update(
          transitionIncidentStatus(current, 'MONITORING', '2026-08-23T09:15:00.000Z', 'OPERATIONS_AUTHORITY', 'monitoring'),
        );
      }
      return this.incidents.update(
        transitionIncidentStatus(current, 'RESOLVED', '2026-08-23T09:20:00.000Z', 'INCIDENT_COMMANDER', summary),
      );
    });
  }

  inventory() {
    return telemetryInventory();
  }

  restore(): RestoreTestRecord {
    return runRestoreTest();
  }

  chaos(): readonly ChaosResult[] {
    return runAllChaosScenarios();
  }

  chainRecovery() {
    return rehearseChainRecovery();
  }

  pitrReady(): boolean {
    return pitrConfigured() && pitrRestoreProbe();
  }

  killSwitches() {
    return killSwitchCatalog();
  }

  continuity() {
    return degradedModes();
  }

  staffingGaps() {
    return staffingGaps();
  }

  productionDisabled(): boolean {
    return ENVIRONMENT === 'simulation' && !LIVE_MONEY_ENABLED && !LIVE_PAYMENTS_ENABLED && this.capabilities.productionActive === false;
  }
}

export function runSreDemo(): {
  readonly overall: ControlRoomReadModel['overall'];
  readonly restore: RestoreTestRecord['result'];
  readonly chaosPassed: boolean;
  readonly productionDisabled: true;
} {
  const platform = new SreReliabilityPlatform();
  platform.ingest(healthySnapshots());
  const restore = platform.restore();
  const chaos = platform.chaos();
  return {
    overall: platform.readModel().overall,
    restore: restore.result,
    chaosPassed: chaos.every((row) => row.financialIntegritySurvived && row.productionRemainedDisabled),
    productionDisabled: true,
  };
}
