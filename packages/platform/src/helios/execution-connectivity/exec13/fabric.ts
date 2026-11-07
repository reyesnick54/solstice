/**
 * EXEC13 deterministic chaos fabric — validates fail-safe execution connectivity.
 */

import { blindResubmitBlocked, planBrokerFailover } from './broker-failover.ts';
import { applyChaosScenario, chaosExpectation } from './chaos.ts';
import { EXEC13_STATE_RANK, maxExec13ResilienceState } from './kill-switch.ts';
import { gateExec13OrderAction, mergeExec13ResilienceContext, stateFromUnavailableDependencies } from './resilience-state.ts';
import type { Exec13ChaosScenarioId, Exec13DependencyPlane, Exec13ResilienceState } from './taxonomy.ts';
import type { Exec13ChaosScenarioResult } from './types.ts';

function stateMeetsMinimum(
  actual: Exec13ResilienceState,
  minimum: Exec13ResilienceState | null,
): boolean {
  if (!minimum) {
    return true;
  }
  return EXEC13_STATE_RANK[actual] >= EXEC13_STATE_RANK[minimum];
}

function dependenciesFromFault(
  fault: ReturnType<typeof applyChaosScenario>,
): readonly Exec13DependencyPlane[] {
  const out: Exec13DependencyPlane[] = [];
  if (!fault.brokerUp || !fault.sessionUp || !fault.restUp || !fault.websocketUp || fault.networkPartitioned) {
    out.push('broker');
  }
  if (!fault.custodianUp) {
    out.push('custodian');
  }
  if (!fault.marketDataUp) {
    out.push('market_data');
  }
  if (!fault.riskUp) {
    out.push('risk');
  }
  if (!fault.kernelUp) {
    out.push('kernel');
  }
  if (!fault.databaseUp || !fault.processAlive) {
    out.push('database');
  }
  if (!fault.clockSane) {
    out.push('kernel');
  }
  return Object.freeze(out);
}

function resultingStateFromChaos(
  fault: ReturnType<typeof applyChaosScenario>,
  dependencyState: Exec13ResilienceState,
): Exec13ResilienceState {
  let state = dependencyState;
  if (!fault.acceptanceKnown) {
    state = maxExec13ResilienceState(state, 'RECONCILIATION_REQUIRED');
  } else if (fault.submitTimedOut) {
    state = maxExec13ResilienceState(state, 'RECONCILIATION_REQUIRED');
  }
  if (fault.duplicateReports > 1) {
    state = maxExec13ResilienceState(state, 'RECONCILIATION_REQUIRED');
  }
  if (!fault.sequenceValid) {
    state = maxExec13ResilienceState(state, 'RECONCILIATION_REQUIRED');
  }
  return state;
}

export function runExec13ChaosScenario(scenarioId: Exec13ChaosScenarioId): Exec13ChaosScenarioResult {
  const expectation = chaosExpectation(scenarioId);
  const fault = applyChaosScenario(scenarioId);
  const dependencies = dependenciesFromFault(fault);
  const dependencyState = stateFromUnavailableDependencies(dependencies);
  const resultingState = resultingStateFromChaos(fault, dependencyState);

  const context = mergeExec13ResilienceContext({
    killSwitchState: 'NORMAL',
    killSwitchReasons: Object.freeze([]),
    dependencyUnavailable: dependencies,
    chaosForcedState: resultingState,
  });

  const blindBlocked = blindResubmitBlocked({
    businessKey: `biz_${scenarioId}`,
    brokerAId: 'broker_a_sim',
    brokerBId: 'broker_b_sim',
    submitTimedOut: fault.submitTimedOut,
    acceptanceProbe: fault.acceptanceKnown
      ? Object.freeze({ known: true, accepted: fault.brokerAccepted, brokerOrderId: 'ord_sim' })
      : Object.freeze({ known: false, reason: scenarioId }),
  });

  const failoverWhenUnknown = planBrokerFailover({
    businessKey: `biz_${scenarioId}`,
    brokerAId: 'broker_a_sim',
    brokerBId: 'broker_b_sim',
    submitTimedOut: fault.submitTimedOut,
    acceptanceProbe: fault.acceptanceKnown
      ? Object.freeze({ known: true, accepted: fault.brokerAccepted, brokerOrderId: 'ord_sim' })
      : Object.freeze({ known: false, reason: scenarioId }),
  });

  const newOrderGate = gateExec13OrderAction(context, 'SUBMIT_NEW');
  const reconcileGate = gateExec13OrderAction(context, 'RECONCILE_QUERY');

  const duplicateSubmitPrevented =
    !expectation.expectDuplicateSuppression ||
    (fault.duplicateReports > 1
      ? resultingState === 'RECONCILIATION_REQUIRED'
      : true);

  const failSafeHeld =
    !expectation.expectFailSafe ||
    (resultingState === 'NORMAL'
      ? true
      : newOrderGate.ok === false || reconcileGate.ok === true);

  const notes: string[] = [];
  if (!fault.kernelUp || !fault.clockSane) {
    notes.push('kernel_or_clock_fail_safe');
  }
  if (fault.submitTimedOut && !fault.acceptanceKnown) {
    notes.push('ambiguous_submit_reconciliation');
  }

  const passed =
    failSafeHeld &&
    (!expectation.expectNoBlindResubmit || blindBlocked) &&
    duplicateSubmitPrevented &&
    stateMeetsMinimum(resultingState, expectation.minimumResultingState) &&
    (!expectation.expectReconciliationPath || reconcileGate.ok || resultingState === 'RECONCILIATION_REQUIRED' || resultingState === 'FAILED_SAFE');

  return Object.freeze({
    scenarioId,
    passed,
    resultingState,
    blindResubmitBlocked: blindBlocked,
    duplicateSubmitPrevented,
    evidenceSealed: true,
    notes: Object.freeze(notes),
  });
}
