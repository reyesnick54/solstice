/**
 * ALPHA01 bridge — execution twin environments align with forward evidence lanes.
 */

import { resolveExecutionTwinEnvironment } from './taxonomy.ts';
import type { ExecutionTwinEnvironmentKind } from './taxonomy.ts';
import type { ForwardAlphaEvidenceLane } from '@solstice/strategy-lab';

export const HELIOS_ALPHA01_EXECUTION_TWIN_FORWARD_BRIDGE_SCHEMA =
  'sunrey.helios.alpha01.execution-twin-forward-bridge.v1' as const;

const LANE_TO_TWIN: Readonly<Partial<Record<ForwardAlphaEvidenceLane, ExecutionTwinEnvironmentKind>>> = Object.freeze({
  FORWARD_SHADOW: 'SHADOW',
  FORWARD_PAPER: 'PAPER',
  LIVE_CAPITAL: 'LIVE',
  HISTORICAL_BACKTEST: 'HISTORICAL_REPLAY',
  WALK_FORWARD: 'HISTORICAL_REPLAY',
  SEALED_HOLDOUT: 'HISTORICAL_REPLAY',
});

export function forwardAlphaLaneExecutionTwinEnvironment(
  lane: ForwardAlphaEvidenceLane,
): ExecutionTwinEnvironmentKind {
  const mapped = LANE_TO_TWIN[lane] ?? 'HISTORICAL_REPLAY';
  return resolveExecutionTwinEnvironment(mapped) ?? 'HISTORICAL_REPLAY';
}

export type Alpha01ExecutionTwinForwardBinding = {
  readonly schema: typeof HELIOS_ALPHA01_EXECUTION_TWIN_FORWARD_BRIDGE_SCHEMA;
  readonly evidenceLane: ForwardAlphaEvidenceLane;
  readonly twinEnvironment: ExecutionTwinEnvironmentKind;
  readonly liveCapital: boolean;
};

export function bindForwardAlphaLaneToExecutionTwin(lane: ForwardAlphaEvidenceLane): Alpha01ExecutionTwinForwardBinding {
  const twinEnvironment = forwardAlphaLaneExecutionTwinEnvironment(lane);
  return Object.freeze({
    schema: HELIOS_ALPHA01_EXECUTION_TWIN_FORWARD_BRIDGE_SCHEMA,
    evidenceLane: lane,
    twinEnvironment,
    liveCapital: lane === 'LIVE_CAPITAL',
  });
}
