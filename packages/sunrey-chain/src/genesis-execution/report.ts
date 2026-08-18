/**
 * Tamper-evident LaunchExecutionReport.
 */

import { eventsTipHash, digestText, LAUNCH_REPORT_DOMAIN } from './hash.ts';
import type { LaunchExecutionReport, LaunchExecutionSession } from './types.ts';

export function buildLaunchExecutionReport(session: LaunchExecutionSession): LaunchExecutionReport {
  const previousReportHash = 'GENESIS';
  const eventsHash = eventsTipHash(session.events);
  const reportHash = digestText(
    LAUNCH_REPORT_DOMAIN,
    session.sessionId,
    session.mode,
    session.plan.planHash,
    session.authorization?.authorizationSetHash ?? 'NONE',
    session.permit?.permitHash ?? 'NONE',
    session.genesis?.genesisHash ?? 'NONE',
    session.firstBlock?.verified ? '1' : '0',
    session.supplyAudit?.ok ? '1' : '0',
    eventsHash,
    previousReportHash,
    session.state,
  );
  return Object.freeze({
    schemaVersion: 1,
    title: 'SunRey Launch Execution Report',
    sessionId: session.sessionId,
    mode: session.mode,
    planHash: session.plan.planHash,
    authorizationSetHash: session.authorization?.authorizationSetHash ?? null,
    permitHash: session.permit?.permitHash ?? null,
    genesisHash: session.genesis?.genesisHash ?? null,
    firstBlockVerified: session.firstBlock?.verified === true,
    supplyAuditOk: session.supplyAudit?.ok === true,
    controlRoom: session.controlRoom,
    eventsHash,
    previousReportHash,
    reportHash,
    executionState: session.state,
    capabilityActivationUnchanged: true,
    realProductionExecutionPerformed: false,
    mainnetEnabled: false,
    liveFlagsRemainDisabled: true,
  });
}
