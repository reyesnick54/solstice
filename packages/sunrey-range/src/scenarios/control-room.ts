import { emptyControlRoom } from '../../../sunrey-chain/src/genesis-execution/control-room.ts';
import { ENVIRONMENT, LIVE_MONEY_ENABLED, LIVE_PAYMENTS_ENABLED, assertSimulationOnly } from '../../../config/src/flags.ts';
import { refuseDirectFinancialMutation, EventHandlerBypassError } from '../../../events/src/gate.ts';
import { rejectUnrestrictedMint } from '../../../sunrey-chain/src/economics/issuance.ts';
import { runProductionAttack, safetyScenario } from './production-helpers.ts';
import type { AttackResult, AttackScenario } from '../types.ts';
import type { RangeEnvironment } from '../environment.ts';

const INVARIANTS = [
  'CONTROL_ROOM_READ_ONLY',
  'LEDGER_APPEND_ONLY',
  'EXECUTION_AUTHORITY_REQUIRED',
  'PRODUCTION_NOT_ACTIVE',
  'KERNEL_CANNOT_BE_BYPASSED',
] as const;

export const controlRoomScenarios: readonly AttackScenario[] = [
  'CTRL-POST-JOURNAL',
  'CTRL-MINT',
  'CTRL-DISABLE-COMPLIANCE',
  'CTRL-ROTATE-FUNDS',
  'CTRL-APPROVE-CUSTODY',
  'CTRL-FLIP-LIVE',
].map((scenarioId, index) =>
  safetyScenario({
    scenarioId,
    seed: 16000 + index,
    category: 'CONTROL_ROOM_ABUSE',
    subsystem: 'control-room',
    attack: scenarioId.toLowerCase().replace('ctrl-', '').replaceAll('-', ' '),
    invariants: INVARIANTS,
    detection: 'CONTROL_ROOM_READ_ONLY',
  }),
);

export function runControlRoom(env: RangeEnvironment, scenario: AttackScenario): AttackResult {
  return runProductionAttack(env, scenario, () => {
    assertSimulationOnly();
    const room = emptyControlRoom({ sessionId: 'sess_range', mode: 'REHEARSAL' });
    const hasMutators = !('postJournal' in room || 'mint' in room || 'approveCustody' in room || 'flipLive' in room);
    let ledger = false;
    try {
      refuseDirectFinancialMutation();
    } catch (error) {
      ledger = error instanceof EventHandlerBypassError;
    }
    const blocked =
      room.productionActivated === false &&
      room.liveFlagsRemainDisabled === true &&
      room.capabilityActivationUnchanged === true &&
      hasMutators &&
      ledger &&
      ENVIRONMENT === 'simulation' &&
      LIVE_MONEY_ENABLED === false &&
      LIVE_PAYMENTS_ENABLED === false &&
      rejectUnrestrictedMint() === 'UNRESTRICTED_MINT_UNAVAILABLE';
    return {
      blocked,
      safetyHeld: blocked,
      detail: `${scenario.scenarioId} activated=${String(room.productionActivated)} live=${String(room.liveFlagsRemainDisabled)} mutators=${String(!hasMutators)}`,
    };
  });
}
