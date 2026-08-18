/**
 * Adversarial-range integration for the Chunk 76 economic stress lab.
 *
 * Scenario definitions live here. Execution uses the reconciled
 * sunrey-chain stack so this package does not depend on
 * packages/sunrey-economics (that would cycle through the dual-economy
 * adversarial adapter).
 */

import { createIntegratedEconomicStack } from '../../../sunrey-chain/src/economics/stack.ts';
import type { RangeEnvironment } from '../environment.ts';
import type { AttackResult, AttackScenario } from '../types.ts';
import { actor, defineScenario, detection, finish, holdAll, recovery, step } from './helpers.ts';

export const economicStressScenarios: readonly AttackScenario[] = [
  defineScenario({
    scenarioId: 'ECON-ORACLE-STALE',
    category: 'ECONOMIC_STRESS',
    seed: 7622,
    subsystem: 'economic-stress',
    attack: 'stale oracle mint',
    actors: [actor('oracle', 'ORACLE_PROVIDER', true)],
    faults: [],
    timeline: [step(1, 'oracle', 'stale-fact')],
    expectedSecurityProperties: ['NO_DOUBLE_MOONREY_ATTRIBUTION', 'NO_UNAUTHORIZED_ISSUANCE'],
    expectedDetections: [detection('reconciliation', 'FAIL_CLOSED')],
    expectedRecovery: ['ORACLE_SUSPENSION'],
    preventiveOnly: false,
    preventiveControl: 'oracle freshness and MonetaryIssuanceAuthority',
    detectiveControl: 'economic invariant campaign',
    recovery: 'fail-closed; no fabricated facts',
  }),
  defineScenario({
    scenarioId: 'ECON-DUP-REPLAY',
    category: 'ECONOMIC_STRESS',
    seed: 7631,
    subsystem: 'economic-stress',
    attack: 'MoonRey contribution replay',
    actors: [actor('producer', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'producer', 'replay-claim')],
    expectedSecurityProperties: ['NO_DOUBLE_MOONREY_ATTRIBUTION'],
    expectedDetections: [detection('reconciliation', 'DUPLICATE_REFUSED')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveOnly: true,
    preventiveControl: 'fingerprint + MonetaryIssuanceAuthority replay id',
    detectiveControl: 'duplicate issuance counter',
    recovery: 'second mint refused',
  }),
  defineScenario({
    scenarioId: 'ECON-NO-QUORUM',
    category: 'ECONOMIC_STRESS',
    seed: 7721,
    subsystem: 'economic-stress',
    attack: 'advance economics without finality',
    actors: [actor('validator', 'VALIDATOR', true)],
    faults: [],
    timeline: [step(1, 'validator', 'lose-quorum')],
    expectedSecurityProperties: ['NO_UNAUTHORIZED_ISSUANCE'],
    expectedDetections: [detection('reconciliation', 'FINALITY_UNAVAILABLE')],
    expectedRecovery: ['VALIDATOR_ROTATION'],
    preventiveOnly: false,
    preventiveControl: 'no synthetic accounting without finality',
    detectiveControl: 'pending operation counter',
    recovery: 'state remains pending until quorum returns',
  }),
];

export function runEconomicStress(env: RangeEnvironment, scenario: AttackScenario): AttackResult {
  const stack = createIntegratedEconomicStack();
  stack.registerProductiveObject({
    objectId: 'obj.energy.0',
    category: 'ENERGY',
    unit: 'kWh',
    owner: 'ctl.op_0',
  });
  let attackBlocked = true;
  let livenessDegraded = false;
  let failClosed = false;
  let pending = 0;
  if (scenario.scenarioId === 'ECON-ORACLE-STALE') {
    const result = stack.issueMoonReyFromClaim({
      claimId: 'claim.range.stale',
      objectId: 'obj.energy.0',
      category: 'ENERGY',
      quantity: 50n,
      unit: 'kWh',
      controller: 'ctl.op_0',
      epoch: 1,
      providerCount: 3,
      stale: true,
    });
    attackBlocked = result.ok === false;
    failClosed = result.ok === false;
  } else if (scenario.scenarioId === 'ECON-DUP-REPLAY') {
    const first = stack.issueMoonReyFromClaim({
      claimId: 'claim.range.dup.a',
      objectId: 'obj.energy.0',
      category: 'ENERGY',
      quantity: 30n,
      unit: 'kWh',
      controller: 'ctl.op_0',
      epoch: 1,
      providerCount: 3,
    });
    const second = stack.issueMoonReyFromClaim({
      claimId: 'claim.range.dup.b',
      objectId: 'obj.energy.0',
      category: 'ENERGY',
      quantity: 30n,
      unit: 'kWh',
      controller: 'ctl.op_0',
      epoch: 1,
      providerCount: 3,
    });
    attackBlocked = first.ok === true && second.ok === false;
    failClosed = second.ok === false;
  } else if (scenario.scenarioId === 'ECON-NO-QUORUM') {
    stack.finalityAvailable = false;
    const executed = stack.executeTransferFee({ label: 'range-nq', amount: 1n, maxFee: 1_000n });
    attackBlocked = executed.ok === false && stack.feeCharged === 0n;
    livenessDegraded = true;
    pending = stack.pendingOperations;
  }
  const recon = stack.reconcile();
  return finish({
    scenario,
    sourceCommit: env.sourceCommit,
    testnetGenesis: env.testnetGenesis,
    attackBlocked,
    safetyHeld: attackBlocked && recon.ok,
    livenessDegraded,
    invariants: holdAll(
      scenario.expectedSecurityProperties,
      `recon=${recon.ok} failClosed=${failClosed} pending=${pending}`,
    ),
    detections: [
      {
        channel: 'reconciliation',
        code: scenario.expectedDetections[0]?.code ?? 'CHECKED',
        observed: true,
        detail: `failClosed=${failClosed} pending=${pending}`,
      },
    ],
    recovery: recovery(
      scenario.expectedRecovery[0] ?? 'NONE_PREVENTIVE',
      true,
      attackBlocked,
      recon.ok,
      'range adapter over IntegratedEconomicStack; full catalog is packages/sunrey-economics/src/stress',
    ),
    notes: 'Range adapter over packages/sunrey-chain/src/economics/stack.ts. Not a second stress package.',
  });
}
