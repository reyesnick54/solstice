import {
  CONTROL_ROOM_METRIC_NAMES,
  controlRoomMetricCatalog,
  requiredMetricCatalog,
} from '../observability.ts';
import { dashboardDefinitions } from '../dashboards.ts';
import { engineeringSlos } from '../slo.ts';
import { SLO_LABEL, type DashboardId } from '../types.ts';
import {
  ALLOWED_METRIC_LABEL_KEYS,
  CONTROL_ROOM_INCIDENT_KINDS,
  type ControlRoomIncidentKind,
  type SafeMetricLabels,
} from './types.ts';

export const CONTROL_ROOM_RUNBOOKS: Readonly<Record<ControlRoomIncidentKind, string>> = Object.freeze({
  PROVIDER_OUTAGE: 'docs/operations/alerts.md#provider_unavailable',
  DATABASE_FAILOVER: 'docs/operations/database-recovery.md',
  OUTBOX_BACKLOG: 'docs/operations/chunk-156-sunrey-control-room.md#outbox-backlog',
  CUSTODY_HSM_FAILURE: 'docs/operations/signer-failover.md',
  PAYMENT_SUBMISSION_UNKNOWN_SURGE: 'docs/operations/chunk-156-sunrey-control-room.md#payment-submission-unknown',
  ORACLE_QUORUM_LOSS: 'docs/operations/alerts.md#oracle_quorum_unavailable',
  SUPPLY_RECONCILIATION_FAILURE: 'docs/operations/chunk-156-sunrey-control-room.md#supply-reconciliation',
  CREDENTIAL_COMPROMISE: 'docs/operations/chunk-156-sunrey-control-room.md#credential-compromise',
  CHAIN_FINALITY_DEGRADATION: 'docs/operations/failure-domain-loss.md',
  AI_AUTHORITY_ATTEMPT: 'docs/operations/chunk-156-sunrey-control-room.md#ai-safety',
  LEDGER_IMBALANCE: 'docs/operations/chunk-156-sunrey-control-room.md#financial-safety',
  CROSS_ASSET_CUSTODY_MISMATCH: 'docs/operations/alerts.md#custody_reconciliation_mismatch',
});

export const CONTROL_ROOM_DASHBOARD_IDS = [
  'GLOBAL_SYSTEM',
  'CHAIN',
  'ECONOMIC_CONSTITUTION',
  'PAYMENTS',
  'PROVIDERS',
  'COMPLIANCE',
  'ORACLES',
  'CUSTODY',
  'EXCHANGE',
  'PERSISTENCE',
  'EVENT_FABRIC',
  'SECURITY',
] as const satisfies readonly DashboardId[];

export function existingMetricCatalogPreserved(): readonly string[] {
  return requiredMetricCatalog();
}

export function newMetricCatalog(): readonly string[] {
  return CONTROL_ROOM_METRIC_NAMES;
}

export function unifiedMetricCatalog(): readonly string[] {
  return controlRoomMetricCatalog();
}

export function engineeringSloCatalog() {
  return engineeringSlos();
}

export function controlRoomDashboards() {
  const required = new Set<string>(CONTROL_ROOM_DASHBOARD_IDS);
  return dashboardDefinitions().filter((row) => required.has(row.id));
}

export function runbookFor(kind: ControlRoomIncidentKind): string {
  return CONTROL_ROOM_RUNBOOKS[kind];
}

export function incidentKinds(): readonly ControlRoomIncidentKind[] {
  return CONTROL_ROOM_INCIDENT_KINDS;
}

export function assertAllowedMetricLabels(labels: SafeMetricLabels): SafeMetricLabels {
  for (const key of Object.keys(labels)) {
    if (!(ALLOWED_METRIC_LABEL_KEYS as readonly string[]).includes(key)) {
      throw new Error(`metrics label ${key} is not an allowed aggregate dimension`);
    }
  }
  return labels;
}

export function allEngineeringSlosLabeled(): boolean {
  return engineeringSlos().every((slo) => slo.label === SLO_LABEL);
}
