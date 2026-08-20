import { ENVIRONMENT } from '../../../../config/src/flags.ts';
import {
  CONTROL_ROOM_CAPABILITIES,
  CONTROL_ROOM_PLANE,
  CONTROL_ROOM_SCHEMA_VERSION,
  type ControlRoomRecommendation,
  type ControlRoomReport,
  type DomainSnapshots,
  type OperationalIncident,
} from './types.ts';
import { operationalState } from './readiness.ts';

export function controlRoomReport(input: {
  readonly snapshots: DomainSnapshots;
  readonly incidents: readonly OperationalIncident[];
  readonly recommendations?: readonly ControlRoomRecommendation[];
  readonly maintenance?: boolean;
}): ControlRoomReport {
  if (ENVIRONMENT !== 'simulation') {
    throw new Error('ENVIRONMENT must remain simulation');
  }
  return Object.freeze({
    schemaVersion: CONTROL_ROOM_SCHEMA_VERSION,
    plane: CONTROL_ROOM_PLANE,
    environment: 'simulation',
    productionActive: false,
    engineeringSlosOnly: true,
    operationalState: operationalState(input),
    capabilities: CONTROL_ROOM_CAPABILITIES,
    incidents: Object.freeze([...input.incidents]),
    recommendations: Object.freeze([...(input.recommendations ?? [])]),
    realAlertProviderConnected: false,
  });
}

export function demoFlags(report: ControlRoomReport): Record<string, string> {
  return {
    CONTROL_ROOM_CAN_POST_LEDGER: String(report.capabilities.canPostLedger),
    CONTROL_ROOM_CAN_MINT: String(report.capabilities.canMint),
    CONTROL_ROOM_CAN_ISSUE_AUTHORITY: String(report.capabilities.canIssueAuthority),
    METRICS_CONTAIN_PII: String(report.capabilities.metricsContainPii),
    LOGS_CONTAIN_CREDENTIALS: String(report.capabilities.logsContainCredentials),
    PROVIDER_HEALTH_EQUALS_LEGAL_APPROVAL: String(report.capabilities.providerHealthEqualsLegalApproval),
    ENGINEERING_SLOS_ONLY: String(report.engineeringSlosOnly),
    REAL_ALERT_PROVIDER_CONNECTED: String(report.realAlertProviderConnected),
    PRODUCTION_ACTIVE: String(report.productionActive),
  };
}
