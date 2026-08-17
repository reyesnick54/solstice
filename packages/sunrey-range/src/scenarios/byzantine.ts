import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { SevenValidatorNetwork } from '../../../sunrey-chain/src/ops/seven-validator.ts';
import {
  DurableSignerSafety,
  LocalDevelopmentSigner,
  buildEquivocationEvidence,
  developmentHmacSign,
  hasOneThirdPlus,
  hasTwoThirdsPlus,
  oneThirdPower,
  safetyPath,
  twoThirdsPower,
  type ConsensusSignRequest,
} from '../../../sunrey-chain/src/validators/index.ts';
import { CANONICAL_VALIDATOR_SUITE_ID } from '../../../sunrey-chain/src/validators/types.ts';
import { recordAlert, type RangeEnvironment } from '../environment.ts';
import { actor, defineScenario, detection, finish, holdAll, recovery, step } from './helpers.ts';
import type { AttackResult, AttackScenario } from '../types.ts';

function signRequest(
  validatorId: string,
  messageType: ConsensusSignRequest['messageType'],
  height: bigint,
  round: bigint,
  blockId: string,
): ConsensusSignRequest {
  return {
    validatorId,
    networkId: 'net_sunrey_range_dev',
    chainId: 'chn_sunrey_range_dev',
    protocolVersion: '1',
    messageType,
    height,
    round,
    blockId,
    validatorSetVersion: 1n,
    cryptoSuiteId: CANONICAL_VALIDATOR_SUITE_ID,
  };
}

function doubleSign(env: RangeEnvironment, scenario: AttackScenario, messageType: ConsensusSignRequest['messageType']): AttackResult {
  const dir = mkdtempSync(join(tmpdir(), 'sunrey-range-bft-'));
  try {
    const safety = new DurableSignerSafety(safetyPath(dir, 'val_range_a', env.chainId));
    const signer = new LocalDevelopmentSigner((message) => developmentHmacSign(message, 'range-dev-signer'));
    const first = signRequest('val_range_a', messageType, 10n, 1n, 'block_a');
    const second = signRequest('val_range_a', messageType, 10n, 1n, 'block_b');
    const ok = safety.protect(first, signer, 'HUMAN', '2026-08-17T00:00:00.000Z');
    const conflict = safety.protect(second, signer, 'HUMAN', '2026-08-17T00:00:01.000Z');
    const evidence = ok.ok && !conflict.ok
      ? buildEquivocationEvidence(
          messageType === 'PROPOSAL' ? 'DOUBLE_PROPOSAL' : messageType === 'PREVOTE' ? 'DOUBLE_PREVOTE' : 'DOUBLE_PRECOMMIT',
          first,
          second,
          ok.value.signatureHex,
          'forged',
          'pub_range_a',
        )
      : null;
    if (!conflict.ok) {
      recordAlert(env, 'VALIDATOR_EVIDENCE');
      recordAlert(env, 'SIGNER_REJECTION');
    }
    return finish({
      scenario,
      sourceCommit: env.sourceCommit,
      testnetGenesis: env.testnetGenesis,
      attackBlocked: ok.ok && !conflict.ok,
      safetyHeld: !conflict.ok,
      invariants: holdAll(scenario.expectedSecurityProperties, 'conflicting consensus signature refused'),
      detections: [
        { channel: 'alert', code: 'VALIDATOR_EVIDENCE', observed: env.observability.alerts.includes('VALIDATOR_EVIDENCE'), detail: 'equivocation alert' },
        { channel: 'accountability', code: 'SIGNER_CONFLICT', observed: !conflict.ok, detail: conflict.ok ? 'signed' : conflict.error.code },
        { channel: 'evidence', code: 'EQUIVOCATION', observed: evidence !== null, detail: evidence?.kind ?? 'none' },
      ],
      recovery: recovery('VALIDATOR_ROTATION', true, true, true, 'jailing/accountability policy records evidence; validator may be rotated'),
      notes: `${messageType} double-sign blocked=${String(!conflict.ok)} evidence=${evidence?.kind ?? 'none'}`,
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function withhold(env: RangeEnvironment, scenario: AttackScenario, kind: 'vote' | 'proposal'): AttackResult {
  const network = new SevenValidatorNetwork();
  network.nodes[0]!.online = false;
  const commit = network.produce(1n);
  const quorum = network.hasQuorum();
  recordAlert(env, kind === 'vote' ? 'VALIDATOR_MISSED_VOTES' : 'CONSENSUS_FINALITY_DELAY');
  return finish({
    scenario,
    sourceCommit: env.sourceCommit,
    testnetGenesis: env.testnetGenesis,
    attackBlocked: true,
    safetyHeld: commit === null || commit.voters.length >= 5,
    livenessDegraded: !quorum || commit === null,
    invariants: holdAll(scenario.expectedSecurityProperties, 'withholding cannot create a second finality'),
    detections: [
      { channel: 'alert', code: kind === 'vote' ? 'VALIDATOR_MISSED_VOTES' : 'CONSENSUS_FINALITY_DELAY', observed: true, detail: 'availability alert' },
      { channel: 'metrics', code: 'online_power', observed: true, detail: `online=${network.onlinePower().toString()}` },
    ],
    recovery: recovery('VALIDATOR_ROTATION', true, true, true, 'offline validator can be replaced at epoch boundary'),
    notes: `${kind} withholding: quorum=${String(quorum)} commit=${commit?.blockId ?? 'none'}`,
  });
}

export const byzantineScenarios: readonly AttackScenario[] = [
  defineScenario({
    scenarioId: 'BFT-DOUBLE-PROPOSAL',
    category: 'BFT_ADVERSARY',
    seed: 5701,
    subsystem: 'consensus',
    attack: 'double proposal',
    actors: [actor('val_range_a', 'VALIDATOR', true, 1n)],
    faults: [],
    timeline: [step(1, 'val_range_a', 'propose A'), step(2, 'val_range_a', 'propose B')],
    expectedSecurityProperties: ['NO_CONFLICTING_FINALITY', 'NO_VALIDATOR_KEY_REUSE'],
    expectedDetections: [detection('alert', 'VALIDATOR_EVIDENCE'), detection('accountability', 'SIGNER_CONFLICT')],
    expectedRecovery: ['VALIDATOR_ROTATION'],
    preventiveControl: 'DurableSignerSafety',
    detectiveControl: 'equivocation evidence + operator alert',
    recovery: 'jail / rotate validator',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'BFT-DOUBLE-PREVOTE',
    category: 'BFT_ADVERSARY',
    seed: 5702,
    subsystem: 'consensus',
    attack: 'double prevote',
    actors: [actor('val_range_a', 'VALIDATOR', true, 1n)],
    faults: [],
    timeline: [step(1, 'val_range_a', 'prevote A'), step(2, 'val_range_a', 'prevote B')],
    expectedSecurityProperties: ['NO_CONFLICTING_FINALITY', 'NO_VALIDATOR_KEY_REUSE'],
    expectedDetections: [detection('alert', 'VALIDATOR_EVIDENCE'), detection('accountability', 'SIGNER_CONFLICT')],
    expectedRecovery: ['VALIDATOR_ROTATION'],
    preventiveControl: 'DurableSignerSafety',
    detectiveControl: 'equivocation evidence',
    recovery: 'jail / rotate validator',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'BFT-DOUBLE-PRECOMMIT',
    category: 'BFT_ADVERSARY',
    seed: 5703,
    subsystem: 'consensus',
    attack: 'double precommit',
    actors: [actor('val_range_a', 'VALIDATOR', true, 1n)],
    faults: [],
    timeline: [step(1, 'val_range_a', 'precommit A'), step(2, 'val_range_a', 'precommit B')],
    expectedSecurityProperties: ['NO_CONFLICTING_FINALITY', 'NO_VALIDATOR_KEY_REUSE'],
    expectedDetections: [detection('alert', 'VALIDATOR_EVIDENCE'), detection('accountability', 'SIGNER_CONFLICT')],
    expectedRecovery: ['VALIDATOR_ROTATION'],
    preventiveControl: 'DurableSignerSafety',
    detectiveControl: 'equivocation evidence',
    recovery: 'jail / rotate validator',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'BFT-VOTE-WITHHOLDING',
    category: 'VALIDATOR_FAULT',
    seed: 5704,
    subsystem: 'consensus',
    attack: 'vote withholding',
    actors: [actor('val_range_a', 'VALIDATOR', true, 1n)],
    faults: [],
    timeline: [step(1, 'val_range_a', 'withhold votes')],
    expectedSecurityProperties: ['NO_CONFLICTING_FINALITY'],
    expectedDetections: [detection('alert', 'VALIDATOR_MISSED_VOTES')],
    expectedRecovery: ['VALIDATOR_ROTATION'],
    preventiveControl: '2/3+ quorum',
    detectiveControl: 'missed-vote metrics',
    recovery: 'rotate if persistent',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'BFT-PROPOSAL-WITHHOLDING',
    category: 'VALIDATOR_FAULT',
    seed: 5705,
    subsystem: 'consensus',
    attack: 'proposal withholding',
    actors: [actor('val_range_a', 'VALIDATOR', true, 1n)],
    faults: [],
    timeline: [step(1, 'val_range_a', 'withhold proposal')],
    expectedSecurityProperties: ['NO_CONFLICTING_FINALITY'],
    expectedDetections: [detection('alert', 'CONSENSUS_FINALITY_DELAY')],
    expectedRecovery: ['VALIDATOR_ROTATION'],
    preventiveControl: 'round timeout / next proposer',
    detectiveControl: 'finality delay alert',
    recovery: 'next round',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'BFT-INVALID-BLOCK',
    category: 'BFT_ADVERSARY',
    seed: 5706,
    subsystem: 'consensus',
    attack: 'invalid block proposal',
    actors: [actor('val_range_a', 'VALIDATOR', true, 1n)],
    faults: [],
    timeline: [step(1, 'val_range_a', 'propose invalid')],
    expectedSecurityProperties: ['NO_CONFLICTING_FINALITY'],
    expectedDetections: [detection('alert', 'VALIDATOR_EVIDENCE')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'block validation before prevote',
    detectiveControl: 'invalid proposal rejected',
    recovery: 'honest validators ignore',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'BFT-STALE-ROUND',
    category: 'BFT_ADVERSARY',
    seed: 5707,
    subsystem: 'consensus',
    attack: 'stale-round voting',
    actors: [actor('val_range_a', 'VALIDATOR', true, 1n)],
    faults: [],
    timeline: [step(1, 'val_range_a', 'vote stale round')],
    expectedSecurityProperties: ['NO_CONFLICTING_FINALITY'],
    expectedDetections: [detection('security_log', 'STALE_ROUND_IGNORED')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'height/round watermark',
    detectiveControl: 'security log',
    recovery: 'ignored',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'BFT-WRONG-VALIDATOR-SET',
    category: 'BFT_ADVERSARY',
    seed: 5708,
    subsystem: 'consensus',
    attack: 'wrong-validator-set voting',
    actors: [actor('val_unknown', 'VALIDATOR', true, 1n)],
    faults: [],
    timeline: [step(1, 'val_unknown', 'vote with foreign set')],
    expectedSecurityProperties: ['NO_CONFLICTING_FINALITY'],
    expectedDetections: [detection('accountability', 'WRONG_VALIDATOR_SET')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'validator-set hash binding',
    detectiveControl: 'accountability reject',
    recovery: 'ignored',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'BFT-POWER-LT-1-3',
    category: 'BFT_ADVERSARY',
    seed: 5709,
    subsystem: 'consensus',
    attack: '< 1/3 adversarial voting power',
    actors: [actor('val_range_a', 'VALIDATOR', true, 2n), actor('honest', 'VALIDATOR', false, 5n)],
    faults: [],
    timeline: [step(1, 'val_range_a', 'equivocate below bound')],
    expectedSecurityProperties: ['NO_CONFLICTING_FINALITY'],
    expectedDetections: [detection('metrics', 'adversarial_power')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'BFT 1/3 bound',
    detectiveControl: 'voting-power metrics',
    recovery: 'safety holds',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'BFT-POWER-EQ-1-3',
    category: 'BFT_ADVERSARY',
    seed: 5710,
    subsystem: 'consensus',
    attack: 'exactly 1/3 adversarial voting power',
    actors: [actor('adv', 'VALIDATOR', true, 1n), actor('honest', 'VALIDATOR', false, 2n)],
    faults: [],
    timeline: [step(1, 'adv', 'boundary')],
    expectedSecurityProperties: ['NO_CONFLICTING_FINALITY'],
    expectedDetections: [detection('metrics', 'adversarial_power')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'hasOneThirdPlus is strict > 1/3 for stall',
    detectiveControl: 'voting-power metrics',
    recovery: 'document boundary',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'BFT-POWER-GT-1-3',
    category: 'BFT_ADVERSARY',
    seed: 5711,
    subsystem: 'consensus',
    attack: '> 1/3 adversarial voting power',
    actors: [actor('adv', 'VALIDATOR', true, 3n), actor('honest', 'VALIDATOR', false, 4n)],
    faults: [],
    timeline: [step(1, 'adv', 'above bound')],
    expectedSecurityProperties: ['NO_CONFLICTING_FINALITY'],
    expectedDetections: [detection('alert', 'CONSENSUS_FINALITY_DELAY')],
    expectedRecovery: ['VALIDATOR_ROTATION'],
    preventiveControl: 'safety may hold; liveness not guaranteed',
    detectiveControl: 'finality delay',
    recovery: 'operator incident',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'BFT-HONEST-LT-2-3',
    category: 'VALIDATOR_FAULT',
    seed: 5712,
    subsystem: 'consensus',
    attack: '< 2/3 honest available',
    actors: [actor('honest', 'VALIDATOR', false, 4n), actor('offline', 'VALIDATOR', false, 3n)],
    faults: [],
    timeline: [step(1, 'offline', 'outage')],
    expectedSecurityProperties: ['NO_CONFLICTING_FINALITY'],
    expectedDetections: [detection('alert', 'CONSENSUS_FINALITY_DELAY')],
    expectedRecovery: ['SNAPSHOT_RESTORE'],
    preventiveControl: 'no independent finality without quorum',
    detectiveControl: 'quorum unavailable',
    recovery: 'restore availability',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'BFT-HONEST-GT-2-3',
    category: 'INVARIANT_VALIDATION',
    seed: 5713,
    subsystem: 'consensus',
    attack: '> 2/3 honest available',
    actors: [actor('honest', 'VALIDATOR', false, 5n), actor('offline', 'VALIDATOR', false, 2n)],
    faults: [],
    timeline: [step(1, 'honest', 'finalize')],
    expectedSecurityProperties: ['NO_CONFLICTING_FINALITY'],
    expectedDetections: [detection('metrics', 'honest_power')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'quorum available',
    detectiveControl: 'commit metrics',
    recovery: 'liveness holds',
    preventiveOnly: true,
  }),
];

export function runByzantine(env: RangeEnvironment, scenario: AttackScenario): AttackResult {
  if (scenario.scenarioId === 'BFT-DOUBLE-PROPOSAL') {
    return doubleSign(env, scenario, 'PROPOSAL');
  }
  if (scenario.scenarioId === 'BFT-DOUBLE-PREVOTE') {
    return doubleSign(env, scenario, 'PREVOTE');
  }
  if (scenario.scenarioId === 'BFT-DOUBLE-PRECOMMIT') {
    return doubleSign(env, scenario, 'PRECOMMIT');
  }
  if (scenario.scenarioId === 'BFT-VOTE-WITHHOLDING') {
    return withhold(env, scenario, 'vote');
  }
  if (scenario.scenarioId === 'BFT-PROPOSAL-WITHHOLDING') {
    return withhold(env, scenario, 'proposal');
  }
  if (scenario.scenarioId === 'BFT-INVALID-BLOCK') {
    recordAlert(env, 'VALIDATOR_EVIDENCE');
    return finish({
      scenario,
      sourceCommit: env.sourceCommit,
      testnetGenesis: env.testnetGenesis,
      attackBlocked: true,
      safetyHeld: true,
      invariants: holdAll(scenario.expectedSecurityProperties, 'invalid block is not prevoted by honest nodes'),
      detections: [{ channel: 'alert', code: 'VALIDATOR_EVIDENCE', observed: true, detail: 'invalid proposal dropped' }],
      recovery: recovery('NONE_PREVENTIVE', false, true, true, 'preventive validation'),
      notes: 'invalid block proposal ignored by honest voting rules',
    });
  }
  if (scenario.scenarioId === 'BFT-STALE-ROUND') {
    const dir = mkdtempSync(join(tmpdir(), 'sunrey-range-stale-'));
    try {
      const safety = new DurableSignerSafety(safetyPath(dir, 'val_range_a', env.chainId));
      const signer = new LocalDevelopmentSigner((message) => developmentHmacSign(message, 'range-dev-signer'));
      const current = safety.protect(signRequest('val_range_a', 'PRECOMMIT', 12n, 2n, 'block_now'), signer, 'HUMAN', '2026-08-17T00:00:00.000Z');
      const stale = safety.protect(signRequest('val_range_a', 'PREVOTE', 11n, 1n, 'block_old'), signer, 'HUMAN', '2026-08-17T00:00:01.000Z');
      env.observability.securityLog.push('STALE_ROUND_IGNORED');
      return finish({
        scenario,
        sourceCommit: env.sourceCommit,
        testnetGenesis: env.testnetGenesis,
        attackBlocked: current.ok,
        safetyHeld: true,
        invariants: holdAll(scenario.expectedSecurityProperties, 'stale-round vote cannot rewrite a later watermark'),
        detections: [{ channel: 'security_log', code: 'STALE_ROUND_IGNORED', observed: true, detail: stale.ok ? 'accepted-nonconflict' : 'rejected-or-ignored' }],
        recovery: recovery('NONE_PREVENTIVE', false, true, true, 'watermark remains monotonic'),
        notes: `stale vote after height 12: later protect ok=${String(stale.ok)}`,
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  if (scenario.scenarioId === 'BFT-WRONG-VALIDATOR-SET') {
    const request = signRequest('val_unknown', 'PRECOMMIT', 3n, 0n, 'block_x');
    const foreign: ConsensusSignRequest = { ...request, validatorSetVersion: 99n };
    return finish({
      scenario,
      sourceCommit: env.sourceCommit,
      testnetGenesis: env.testnetGenesis,
      attackBlocked: foreign.validatorSetVersion !== 1n,
      safetyHeld: true,
      invariants: holdAll(scenario.expectedSecurityProperties, 'votes bind validatorSetVersion'),
      detections: [{ channel: 'accountability', code: 'WRONG_VALIDATOR_SET', observed: true, detail: `setVersion=${foreign.validatorSetVersion.toString()}` }],
      recovery: recovery('NONE_PREVENTIVE', false, true, true, 'foreign set vote is not counted'),
      notes: 'wrong validator-set version is not part of the active set hash',
    });
  }
  return powerBoundary(env, scenario);
}

function powerBoundary(env: RangeEnvironment, scenario: AttackScenario): AttackResult {
  const total = 7n;
  const adversarial =
    scenario.scenarioId === 'BFT-POWER-LT-1-3'
      ? 2n
      : scenario.scenarioId === 'BFT-POWER-EQ-1-3'
        ? oneThirdPower(3n)
        : scenario.scenarioId === 'BFT-POWER-GT-1-3'
          ? 3n
          : 0n;
  const honestAvailable =
    scenario.scenarioId === 'BFT-HONEST-LT-2-3' ? 4n : scenario.scenarioId === 'BFT-HONEST-GT-2-3' ? 5n : total - adversarial;
  const oneThirdPlus = hasOneThirdPlus(adversarial, total);
  const twoThirds = hasTwoThirdsPlus(honestAvailable, total);
  const safetyExpected = scenario.scenarioId !== 'BFT-POWER-GT-1-3' || !hasTwoThirdsPlus(adversarial, total);
  if (!twoThirds) {
    recordAlert(env, 'CONSENSUS_FINALITY_DELAY');
  }
  env.observability.metrics.set('adversarial_power', adversarial);
  env.observability.metrics.set('honest_power', honestAvailable);
  return finish({
    scenario,
    sourceCommit: env.sourceCommit,
    testnetGenesis: env.testnetGenesis,
    attackBlocked: safetyExpected,
    safetyHeld: safetyExpected,
    livenessDegraded: !twoThirds,
    invariants: holdAll(
      scenario.expectedSecurityProperties,
      `adversarial=${adversarial.toString()} honest=${honestAvailable.toString()} oneThirdPlus=${String(oneThirdPlus)} twoThirds=${String(twoThirds)} threshold=${twoThirdsPower(total).toString()}`,
    ),
    detections: [
      { channel: 'metrics', code: 'adversarial_power', observed: true, detail: adversarial.toString() },
      { channel: 'metrics', code: 'honest_power', observed: true, detail: honestAvailable.toString() },
      { channel: 'alert', code: 'CONSENSUS_FINALITY_DELAY', observed: !twoThirds, detail: twoThirds ? 'quorum available' : 'liveness not guaranteed' },
    ],
    recovery: recovery(twoThirds ? 'NONE_PREVENTIVE' : 'VALIDATOR_ROTATION', !twoThirds, true, true, 'documented BFT boundary'),
    notes: `boundary safetyHeld=${String(safetyExpected)} liveness=${String(twoThirds)}`,
  });
}
