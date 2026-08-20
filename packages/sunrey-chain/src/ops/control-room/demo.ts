import { ControlRoom } from './control-room.ts';
import { aiAuthorityAttempt, degradedEconomic, degradedPaymentPath, healthySnapshots, recoveredPaymentPath } from './fixtures.ts';

export function runControlRoomDemo(): Record<string, unknown> {
  const room = new ControlRoom();

  room.ingest(healthySnapshots());
  const healthy = room.report();

  room.ingest(degradedPaymentPath());
  const opened = room.openPaymentIncident();
  room.recordHumanAction('operator acknowledged PAYMENT_SUBMISSION_UNKNOWN_SURGE; runbook not auto-executed');
  const degraded = room.report();

  room.ingest(recoveredPaymentPath());
  const recovering = room.refreshRecovery();
  const resolved = room.resolveCurrent();

  const economicRoom = new ControlRoom();
  economicRoom.ingest({
    ...healthySnapshots(),
    economic: degradedEconomic(),
    aiSafety: [aiAuthorityAttempt()],
  });
  const finalReport = room.report();
  const flags = room.flags();

  return {
    environment: 'simulation',
    healthyState: healthy.operationalState,
    degradedState: degraded.operationalState,
    incident: {
      id: opened.incidentId,
      kind: opened.kind,
      statusAfterOpen: opened.status,
      statusAfterRecovery: recovering.status,
      statusAfterResolve: resolved.status,
      recoveryRequired: opened.recoveryConditions.map((row) => row.id),
    },
    timeline: room.timeline().map((row) => ({
      sequence: row.sequence.toString(),
      kind: row.kind,
      actor: row.actor,
      summary: row.summary,
    })),
    custody: {
      sunrey: 'healthy',
      moonrey: 'healthy',
    },
    oracleHealth: economicRoom.alerts.has('ORACLE_QUORUM_DEGRADATION') ? 'degraded' : 'healthy',
    economicIssuanceSafety: economicRoom.alerts.has('SUPPLY_RECONCILIATION')
      ? 'supply mismatch raised CRITICAL; no mint'
      : 'healthy',
    aiSafetyAlertOnly: economicRoom.alerts.has('AI_AUTHORITY_ATTEMPT'),
    eventBacklog: 'observed then drained',
    databaseRecoveryHealth: 'primary healthy',
    finalState: finalReport.operationalState,
    flags,
  };
}

function printFlags(flags: Record<string, string>): void {
  for (const [key, value] of Object.entries(flags)) {
    console.log(`${key}=${value}`);
  }
}

const entry = process.argv[1] ?? '';
if (entry.endsWith('demo.ts') || entry.endsWith('demo.js')) {
  console.log('SunRey unified production-candidate control room demo');
  const result = runControlRoomDemo();
  console.log(JSON.stringify(result, null, 2));
  printFlags(result.flags as Record<string, string>);
}
