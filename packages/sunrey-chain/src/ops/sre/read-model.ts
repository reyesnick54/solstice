import { ENVIRONMENT } from '../../../../config/src/flags.ts';
import type { DomainSnapshots } from '../control-room/types.ts';
import { killSwitchCatalog } from './kill-switches.ts';
import type { ControlRoomReadModel, PersistentIncident } from './types.ts';

export type ReadModelSignals = {
  readonly apiAvailable?: boolean;
  readonly agentHealthy?: boolean;
  readonly exchangeHalted?: boolean;
  readonly chainStalled?: boolean;
  readonly treasuryLiquidityWarning?: boolean;
  readonly walletBacklog?: bigint;
  readonly vaultAccessAnomaly?: boolean;
};

export function buildControlRoomReadModel(input: {
  readonly snapshots: DomainSnapshots;
  readonly incidents: readonly PersistentIncident[];
  readonly signals?: ReadModelSignals;
}): ControlRoomReadModel {
  if (ENVIRONMENT !== 'simulation') {
    throw new Error('ENVIRONMENT must remain simulation');
  }
  const paymentsUnknown = (input.snapshots.payments ?? []).reduce((sum, row) => sum + row.submissionUnknown, 0n);
  const providerDown = (input.snapshots.providers ?? []).some((row) => row.technicalHealth === 'UNAVAILABLE');
  const providerDegraded = (input.snapshots.providers ?? []).some((row) => row.technicalHealth !== 'TECHNICALLY_HEALTHY');
  const reconBreaks =
    (input.snapshots.payments ?? []).reduce((sum, row) => sum + row.reconciliationRequired, 0n) +
    (input.snapshots.custody ?? []).reduce((sum, row) => sum + row.reconciliationMismatches, 0n) +
    (input.snapshots.exchange?.reconciliationMismatches ?? 0n) +
    (input.snapshots.economic?.supplyReconciliationMismatches ?? 0n);
  const db = input.snapshots.persistence;
  const queueBacklog = (db?.outboxBacklog ?? 0n) + (input.snapshots.events?.outboxBacklog ?? 0n);
  const securityAnomaly = Boolean(
    input.snapshots.security?.credentialMisuse ||
      input.snapshots.security?.secretLeakGuardRejection ||
      input.signals?.vaultAccessAnomaly,
  );
  const payments = paymentsUnknown > 0n || providerDegraded ? (providerDown ? 'UNAVAILABLE' : 'DEGRADED') : 'HEALTHY';
  const providers = providerDown ? 'UNAVAILABLE' : providerDegraded ? 'DEGRADED' : 'HEALTHY';
  const treasury = input.signals?.treasuryLiquidityWarning ? 'WARNING' : 'HEALTHY';
  const reconciliation = reconBreaks > 0n ? 'BREAK' : 'MATCHED';
  const agent = input.signals?.agentHealthy === false ? 'UNAVAILABLE' : 'HEALTHY';
  const exchange = input.signals?.exchangeHalted
    ? 'HALTED'
    : (input.snapshots.exchange?.pendingSettlements ?? 0n) > 0n
      ? 'UNAVAILABLE'
      : 'HEALTHY';
  const chain = input.signals?.chainStalled ? 'STALLED' : input.snapshots.economic?.oracleQuorumDegraded ? 'DEGRADED' : 'HEALTHY';
  const custodyHsm = (input.snapshots.custody ?? []).every((row) => row.hsmHealthy);
  const custodyUnknown = (input.snapshots.custody ?? []).reduce((sum, row) => sum + row.submissionUnknown, 0n);
  const custody = !custodyHsm ? 'UNAVAILABLE' : custodyUnknown > 0n ? 'WITHDRAWALS_PAUSED' : 'HEALTHY';
  const database = db && !db.primaryHealthy ? 'UNAVAILABLE' : (db?.replicaLagMs ?? 0n) > 0n ? 'DEGRADED' : 'HEALTHY';
  const queues = queueBacklog > 0n ? 'BACKLOG' : 'HEALTHY';
  const security = securityAnomaly ? 'ANOMALY' : 'QUIET';
  const activeIncidents = input.incidents.filter((row) => row.status !== 'CLOSED' && row.status !== 'RESOLVED');
  const overall =
    activeIncidents.some((row) => row.severity === 'SEV1') ||
    database === 'UNAVAILABLE' ||
    payments === 'UNAVAILABLE' ||
    security === 'ANOMALY'
      ? 'INCIDENT'
      : activeIncidents.length > 0 ||
          payments === 'DEGRADED' ||
          providers !== 'HEALTHY' ||
          reconciliation === 'BREAK' ||
          agent !== 'HEALTHY' ||
          exchange !== 'HEALTHY' ||
          chain !== 'HEALTHY' ||
          custody !== 'HEALTHY' ||
          database !== 'HEALTHY' ||
          queues !== 'HEALTHY'
        ? 'DEGRADED'
        : 'HEALTHY';

  return Object.freeze({
    schemaVersion: 1,
    plane: 'READ_OPERATIONS',
    environment: 'simulation',
    productionActive: false,
    overall,
    payments,
    providers,
    treasury,
    reconciliation,
    agent,
    exchange,
    chain,
    custody,
    database,
    queues,
    security,
    activeIncidents: Object.freeze([...activeIncidents]),
    killSwitches: killSwitchCatalog(),
    secretsPresent: false,
  });
}
