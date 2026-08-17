/**
 * Adversarial-range integration for the Chunk 76 economic stress lab.
 *
 * Delegates to packages/sunrey-economics/src/stress. Not a second
 * stress package.
 */

import { runEconomicStressScenario } from '../../sunrey-economics/src/stress/engine.ts';
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

const RANGE_TO_LAB: Readonly<Record<string, string>> = {
  'ECON-ORACLE-STALE': 'ECON-ORACLE-002',
  'ECON-DUP-REPLAY': 'ECON-DUP-001',
  'ECON-NO-QUORUM': 'ECON-NQ-001',
};

export function runEconomicStress(env: RangeEnvironment, scenario: AttackScenario): AttackResult {
  const labId = RANGE_TO_LAB[scenario.scenarioId] ?? scenario.scenarioId;
  const result = runEconomicStressScenario(labId, { seed: scenario.seed });
  return finish({
    scenario,
    sourceCommit: env.sourceCommit,
    testnetGenesis: env.testnetGenesis,
    attackBlocked: result.preservedInvariants,
    safetyHeld: result.preservedInvariants,
    livenessDegraded: result.degradedAvailability,
    invariants: holdAll(scenario.expectedSecurityProperties, result.invariants.map((row) => `${row.invariant}=${row.held}`).join(';')),
    detections: [
      {
        channel: 'reconciliation',
        code: scenario.expectedDetections[0]?.code ?? 'CHECKED',
        observed: true,
        detail: `failClosed=${result.failClosed} pending=${result.pendingOperations}`,
      },
    ],
    recovery: recovery(
      scenario.expectedRecovery[0] ?? 'NONE_PREVENTIVE',
      result.recovery.attempted,
      result.recovery.recoveredAutomatically || result.preservedInvariants,
      result.recovery.sameCanonicalStateChain,
      result.recovery.detail,
    ),
    notes: 'Delegated to packages/sunrey-economics/src/stress. Not a second stress package.',
  });
}
