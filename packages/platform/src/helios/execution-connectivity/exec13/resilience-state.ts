/**
 * EXEC13 connectivity resilience state machine and order gates.
 */

import { maxExec13ResilienceState } from './kill-switch.ts';
import type { Exec13DependencyPlane, Exec13OrderAction, Exec13ResilienceState } from './taxonomy.ts';
import type { Exec13OrderGateResult, Exec13ResilienceContext } from './types.ts';

const DEPENDENCY_STATE: Record<Exec13DependencyPlane, Exec13ResilienceState> = {
  broker: 'BROKER_DEGRADED',
  custodian: 'RECONCILIATION_REQUIRED',
  market_data: 'PAUSE_NEW',
  risk: 'PAUSE_NEW',
  kernel: 'FAILED_SAFE',
  database: 'RECONCILIATION_REQUIRED',
};

export function stateFromUnavailableDependencies(
  planes: readonly Exec13DependencyPlane[],
): Exec13ResilienceState {
  let state: Exec13ResilienceState = 'NORMAL';
  for (const plane of planes) {
    state = maxExec13ResilienceState(state, DEPENDENCY_STATE[plane]);
  }
  return state;
}

export function mergeExec13ResilienceContext(input: {
  readonly killSwitchState: Exec13ResilienceState;
  readonly killSwitchReasons: readonly string[];
  readonly dependencyUnavailable: readonly Exec13DependencyPlane[];
  readonly chaosForcedState?: Exec13ResilienceState | null;
}): Exec13ResilienceContext {
  const dependencyState = stateFromUnavailableDependencies(input.dependencyUnavailable);
  let connectivityState = maxExec13ResilienceState(input.killSwitchState, dependencyState);
  if (input.chaosForcedState) {
    connectivityState = maxExec13ResilienceState(connectivityState, input.chaosForcedState);
  }
  return Object.freeze({
    connectivityState,
    killSwitchReasons: Object.freeze([...input.killSwitchReasons]),
    dependencyUnavailable: Object.freeze([...input.dependencyUnavailable]),
  });
}

export function gateExec13OrderAction(
  context: Exec13ResilienceContext,
  action: Exec13OrderAction,
): Exec13OrderGateResult {
  const state = context.connectivityState;
  if (state === 'FAILED_SAFE') {
    return Object.freeze({ ok: false, code: 'FAILED_SAFE', state });
  }
  if (state === 'RECONCILIATION_REQUIRED' && action !== 'RECONCILE_QUERY') {
    return Object.freeze({ ok: false, code: 'RECONCILIATION_REQUIRED', state });
  }
  if (state === 'BROKER_DEGRADED' && (action === 'SUBMIT_NEW' || action === 'SUBMIT_REPLACE')) {
    return Object.freeze({ ok: false, code: 'BROKER_DEGRADED', state });
  }
  if (
    (state === 'PAUSE_NEW' || state === 'CANCEL_ONLY' || state === 'EXIT_ONLY') &&
    (action === 'SUBMIT_NEW' || action === 'SUBMIT_REPLACE')
  ) {
    if (state === 'EXIT_ONLY' && action === 'SUBMIT_EXIT') {
      return Object.freeze({ ok: true, action });
    }
    return Object.freeze({ ok: false, code: state, state });
  }
  if (state === 'CANCEL_ONLY' && action === 'SUBMIT_REPLACE') {
    return Object.freeze({ ok: false, code: 'CANCEL_ONLY', state });
  }
  return Object.freeze({ ok: true, action });
}
