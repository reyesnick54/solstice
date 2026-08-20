/**
 * Read-only control-room projection of a full-platform burn-in.
 * The control room cannot mutate burn-in or bundle state.
 */

import type { BurnInRuntime, ControlRoomProjection } from './runtime.ts';
import { supplyReconciles } from './runtime.ts';

export function projectControlRoom(runtime: BurnInRuntime): ControlRoomProjection {
  return Object.freeze({
    healthTimeline: Object.freeze(runtime.checkpoints.map((row) => `${row.id}:${row.stateHash}`)),
    incidents: Object.freeze(
      Object.entries(runtime.providers)
        .filter(([, state]) => state === 'DOWN')
        .map(([id]) => `provider-down:${id}`),
    ),
    sloObservations: Object.freeze([
      `payments:${runtime.payments.get('pay.usd-sar.1')?.status ?? 'ABSENT'}`,
      `chain:${runtime.chainFinality}`,
    ]),
    reconciliationBacklog: runtime.unfinalizedCredits > 0n ? 1 : 0,
    providerHealth: Object.freeze({ ...runtime.providers }),
    chainHealth: runtime.chainFinality,
    economicHealth: runtime.growMyMoney.guaranteedReturn ? 'INVALID' : 'REHEARSAL',
    supplyHealth: supplyReconciles(runtime.sunrey) && supplyReconciles(runtime.moonrey) ? 'RECONCILED' : 'BROKEN',
    readOnly: true,
  });
}

export function refuseControlRoomMutation(runtime: BurnInRuntime, _action: string): never {
  runtime.controlRoomMutations += 1;
  throw new TypeError('control-room-is-read-only');
}

export function controlRoomRemainsReadOnly(runtime: BurnInRuntime): boolean {
  return runtime.controlRoomMutations === 0;
}
