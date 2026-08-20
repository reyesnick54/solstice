import { recordAlert, type RangeEnvironment } from '../environment.ts';
import { PRODUCTION_SAFETY_FIXTURE_VERSION } from '../types.ts';
import { proveIsolation } from '../production-safety.ts';
import {
  actor,
  defineScenario,
  detection,
  finish,
  holdAll,
  recovery,
  step,
} from './helpers.ts';
import type {
  AttackCategory,
  AttackResult,
  AttackScenario,
  DetectionChannel,
  RangeActor,
  RecoveryKind,
  SecurityInvariantId,
} from '../types.ts';

export type ProductionAttackOutcome = {
  readonly blocked: boolean;
  readonly safetyHeld: boolean;
  readonly livenessDegraded?: boolean;
  readonly detail: string;
  readonly detectionObserved?: boolean;
};

export function safetyScenario(input: {
  readonly scenarioId: string;
  readonly seed: number;
  readonly category: AttackCategory;
  readonly subsystem: string;
  readonly attack: string;
  readonly invariants: readonly SecurityInvariantId[];
  readonly detection: string;
  readonly detectionChannel?: DetectionChannel;
  readonly recovery?: RecoveryKind;
  readonly actors?: readonly RangeActor[];
  readonly preventive?: string;
  readonly detective?: string;
  readonly recoveryDetail?: string;
}): AttackScenario {
  return defineScenario({
    scenarioId: input.scenarioId,
    category: input.category,
    seed: input.seed,
    fixtureVersion: PRODUCTION_SAFETY_FIXTURE_VERSION,
    subsystem: input.subsystem,
    attack: input.attack,
    actors: input.actors ?? [actor('peer.malicious.1', 'MALICIOUS_PEER', true)],
    faults: [],
    timeline: [step(1, 'peer.malicious.1', input.attack)],
    expectedSecurityProperties: input.invariants,
    expectedDetections: [detection(input.detectionChannel ?? 'security_log', input.detection)],
    expectedRecovery: [input.recovery ?? 'NONE_PREVENTIVE'],
    preventiveControl: input.preventive ?? 'fail-closed fixture policy',
    detectiveControl: input.detective ?? input.detection,
    recovery: input.recoveryDetail ?? 'historical evidence retained; no consequential mutation',
    preventiveOnly: false,
  });
}

export function runProductionAttack(
  env: RangeEnvironment,
  scenario: AttackScenario,
  attack: (env: RangeEnvironment, scenario: AttackScenario) => ProductionAttackOutcome,
): AttackResult {
  const isolation = proveIsolation();
  if (env.credentials !== 'TEST_ONLY') {
    throw new Error('range must use TEST_ONLY credentials');
  }
  const outcome = attack(env, scenario);
  const code = scenario.expectedDetections[0]?.code ?? 'PRODUCTION_SAFETY';
  const channel = scenario.expectedDetections[0]?.channel ?? 'security_log';
  const observed = outcome.detectionObserved ?? outcome.blocked;
  if (observed) {
    recordAlert(env, code);
  }
  const recoveryKind = scenario.expectedRecovery[0] ?? 'NONE_PREVENTIVE';
  return finish({
    scenario,
    sourceCommit: env.sourceCommit,
    testnetGenesis: env.testnetGenesis,
    attackBlocked: outcome.blocked,
    safetyHeld: outcome.safetyHeld && isolation.productionActive === false && isolation.contactsPublicInternet === false,
    livenessDegraded: outcome.livenessDegraded ?? false,
    invariants: holdAll(
      scenario.expectedSecurityProperties,
      `${outcome.detail}; env=${isolation.environment}; fixture=${isolation.fixtureVersion}`,
    ),
    detections: [{ channel, code, observed, detail: outcome.detail }],
    recovery: recovery(recoveryKind, true, true, true, scenario.recovery),
    notes: outcome.detail,
  });
}
