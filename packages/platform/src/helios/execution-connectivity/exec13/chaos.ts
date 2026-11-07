/**
 * EXEC13 chaos injection — simulation-only broker/network fault catalog.
 */

import { EXEC13_CHAOS_SCENARIOS, type Exec13ChaosScenarioId, type Exec13ResilienceState } from './taxonomy.ts';
import type { Exec13ChaosExpectation } from './types.ts';

export function listExec13ChaosScenarios(): readonly Exec13ChaosScenarioId[] {
  return EXEC13_CHAOS_SCENARIOS;
}

export function chaosExpectation(scenarioId: Exec13ChaosScenarioId): Exec13ChaosExpectation {
  const base = {
    scenarioId,
    expectFailSafe: true,
    expectNoBlindResubmit: false,
    expectDuplicateSuppression: false,
    expectReconciliationPath: false,
    minimumResultingState: null as Exec13ResilienceState | null,
  };

  switch (scenarioId) {
    case 'submission_timeout':
      return Object.freeze({
        ...base,
        expectNoBlindResubmit: true,
        expectReconciliationPath: true,
        minimumResultingState: 'RECONCILIATION_REQUIRED',
      });
    case 'ack_lost':
      return Object.freeze({
        ...base,
        expectReconciliationPath: true,
        minimumResultingState: 'RECONCILIATION_REQUIRED',
      });
    case 'process_crash_after_broker_submit':
      return Object.freeze({
        ...base,
        expectNoBlindResubmit: true,
        expectReconciliationPath: true,
        minimumResultingState: 'RECONCILIATION_REQUIRED',
      });
    case 'duplicate_ack':
    case 'duplicate_fill':
      return Object.freeze({
        ...base,
        expectDuplicateSuppression: true,
      });
    case 'partial_fill_during_cancel':
    case 'fill_during_replace':
    case 'cancel_rejected':
    case 'replace_rejected':
    case 'out_of_order_execution_reports':
    case 'trade_correction':
    case 'trade_bust':
      return Object.freeze({
        ...base,
        expectReconciliationPath: true,
      });
    case 'rest_outage':
    case 'fix_session_disconnect':
    case 'websocket_disconnect':
    case 'session_reset':
    case 'sequence_reset':
    case 'broker_unavailable':
      return Object.freeze({
        ...base,
        minimumResultingState: 'BROKER_DEGRADED',
      });
    case 'custodian_unavailable':
      return Object.freeze({
        ...base,
        minimumResultingState: 'RECONCILIATION_REQUIRED',
      });
    case 'market_data_unavailable':
    case 'risk_unavailable':
      return Object.freeze({
        ...base,
        minimumResultingState: 'PAUSE_NEW',
      });
    case 'kernel_unavailable':
      return Object.freeze({
        ...base,
        minimumResultingState: 'FAILED_SAFE',
      });
    case 'database_restart':
      return Object.freeze({
        ...base,
        minimumResultingState: 'RECONCILIATION_REQUIRED',
      });
    case 'clock_drift':
      return Object.freeze({
        ...base,
        minimumResultingState: 'FAILED_SAFE',
      });
    case 'network_partition':
      return Object.freeze({
        ...base,
        expectNoBlindResubmit: true,
        minimumResultingState: 'BROKER_DEGRADED',
        expectReconciliationPath: true,
      });
    default: {
      const _exhaustive: never = scenarioId;
      throw new Error(`unknown chaos scenario ${_exhaustive}`);
    }
  }
}

export type Exec13ChaosFaultSurface = {
  readonly submitTimedOut: boolean;
  readonly acceptanceKnown: boolean;
  readonly brokerAccepted: boolean;
  readonly duplicateReports: number;
  readonly sessionUp: boolean;
  readonly restUp: boolean;
  readonly websocketUp: boolean;
  readonly sequenceValid: boolean;
  readonly brokerUp: boolean;
  readonly custodianUp: boolean;
  readonly marketDataUp: boolean;
  readonly riskUp: boolean;
  readonly kernelUp: boolean;
  readonly databaseUp: boolean;
  readonly processAlive: boolean;
  readonly clockSane: boolean;
  readonly networkPartitioned: boolean;
};

export function applyChaosScenario(scenarioId: Exec13ChaosScenarioId): Exec13ChaosFaultSurface {
  const healthy: Exec13ChaosFaultSurface = Object.freeze({
    submitTimedOut: false,
    acceptanceKnown: true,
    brokerAccepted: true,
    duplicateReports: 0,
    sessionUp: true,
    restUp: true,
    websocketUp: true,
    sequenceValid: true,
    brokerUp: true,
    custodianUp: true,
    marketDataUp: true,
    riskUp: true,
    kernelUp: true,
    databaseUp: true,
    processAlive: true,
    clockSane: true,
    networkPartitioned: false,
  });

  switch (scenarioId) {
    case 'submission_timeout':
      return Object.freeze({ ...healthy, submitTimedOut: true, acceptanceKnown: false });
    case 'ack_lost':
      return Object.freeze({ ...healthy, acceptanceKnown: false });
    case 'duplicate_ack':
      return Object.freeze({ ...healthy, duplicateReports: 2 });
    case 'duplicate_fill':
      return Object.freeze({ ...healthy, duplicateReports: 2 });
    case 'partial_fill_during_cancel':
    case 'fill_during_replace':
    case 'cancel_rejected':
    case 'replace_rejected':
    case 'out_of_order_execution_reports':
    case 'trade_correction':
    case 'trade_bust':
      return Object.freeze({ ...healthy, sequenceValid: false });
    case 'rest_outage':
      return Object.freeze({ ...healthy, restUp: false });
    case 'fix_session_disconnect':
      return Object.freeze({ ...healthy, sessionUp: false });
    case 'websocket_disconnect':
      return Object.freeze({ ...healthy, websocketUp: false });
    case 'session_reset':
      return Object.freeze({ ...healthy, sessionUp: false, sequenceValid: false });
    case 'sequence_reset':
      return Object.freeze({ ...healthy, sequenceValid: false });
    case 'broker_unavailable':
      return Object.freeze({ ...healthy, brokerUp: false });
    case 'custodian_unavailable':
      return Object.freeze({ ...healthy, custodianUp: false });
    case 'market_data_unavailable':
      return Object.freeze({ ...healthy, marketDataUp: false });
    case 'risk_unavailable':
      return Object.freeze({ ...healthy, riskUp: false });
    case 'kernel_unavailable':
      return Object.freeze({ ...healthy, kernelUp: false });
    case 'database_restart':
      return Object.freeze({ ...healthy, databaseUp: false });
    case 'process_crash_after_broker_submit':
      return Object.freeze({
        ...healthy,
        processAlive: false,
        acceptanceKnown: false,
        submitTimedOut: true,
      });
    case 'clock_drift':
      return Object.freeze({ ...healthy, clockSane: false });
    case 'network_partition':
      return Object.freeze({
        ...healthy,
        networkPartitioned: true,
        restUp: false,
        websocketUp: false,
        brokerUp: false,
        submitTimedOut: true,
        acceptanceKnown: false,
      });
    default: {
      const _exhaustive: never = scenarioId;
      throw new Error(`unknown chaos scenario ${_exhaustive}`);
    }
  }
}
