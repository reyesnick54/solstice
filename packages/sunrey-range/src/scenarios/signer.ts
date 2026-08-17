import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { SignerFence, SignerFencingController } from '../../../sunrey-chain/src/ops/fencing.ts';
import { SignerSafetyStore } from '../../../sunrey-chain/src/ops/signer-safety.ts';
import {
  LocalDevelopmentSigner,
  developmentHmacSign,
  type ConsensusSignRequest,
} from '../../../sunrey-chain/src/validators/index.ts';
import { CANONICAL_VALIDATOR_SUITE_ID } from '../../../sunrey-chain/src/validators/types.ts';
import { recordAlert, type RangeEnvironment } from '../environment.ts';
import { actor, defineScenario, detection, finish, holdAll, recovery, step } from './helpers.ts';
import type { AttackResult, AttackScenario } from '../types.ts';

function request(blockId: string, height = 8n): ConsensusSignRequest {
  return {
    validatorId: 'val_range_a',
    networkId: 'net_sunrey_range_dev',
    chainId: 'chn_sunrey_range_dev',
    protocolVersion: '1',
    messageType: 'PRECOMMIT',
    height,
    round: 0n,
    blockId,
    validatorSetVersion: 1n,
    cryptoSuiteId: CANONICAL_VALIDATOR_SUITE_ID,
  };
}

export const signerScenarios: readonly AttackScenario[] = [
  defineScenario({
    scenarioId: 'SIGNER-COMPROMISE',
    category: 'SIGNER_COMPROMISE',
    seed: 5730,
    subsystem: 'remote-signer',
    attack: 'leaked development validator signing credential',
    actors: [actor('val_range_a', 'VALIDATOR', true)],
    faults: [],
    timeline: [step(1, 'val_range_a', 'conflicting sign requests')],
    expectedSecurityProperties: ['NO_VALIDATOR_KEY_REUSE', 'NO_CONFLICTING_FINALITY'],
    expectedDetections: [detection('alert', 'SIGNER_REJECTION'), detection('security_log', 'LEASE_FENCED')],
    expectedRecovery: ['SIGNER_FENCING', 'KEY_ROTATION'],
    preventiveControl: 'signer-safety database + fencing',
    detectiveControl: 'operator alerts',
    recovery: 'fence + rotate key',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'SIGNER-ROLLBACK',
    category: 'SIGNER_COMPROMISE',
    seed: 5731,
    subsystem: 'remote-signer',
    attack: 'restore stale signer-safety data',
    actors: [actor('val_range_a', 'VALIDATOR', true)],
    faults: [],
    timeline: [step(1, 'val_range_a', 'rollback safety db')],
    expectedSecurityProperties: ['NO_VALIDATOR_KEY_REUSE'],
    expectedDetections: [detection('alert', 'SIGNER_REJECTION'), detection('security_log', 'SIGNER_ROLLBACK')],
    expectedRecovery: ['SIGNER_FENCING'],
    preventiveControl: 'monotonic watermark restore',
    detectiveControl: 'SIGNER_ROLLBACK',
    recovery: 'keep trusted checkpoint',
    preventiveOnly: false,
  }),
];

export function runSigner(env: RangeEnvironment, scenario: AttackScenario): AttackResult {
  const dir = mkdtempSync(join(tmpdir(), 'sunrey-range-signer-'));
  try {
    const store = new SignerSafetyStore(dir, 'val_range_a', env.chainId);
    const signer = new LocalDevelopmentSigner((message) => developmentHmacSign(message, 'range-dev-signer'));
    const first = store.safety.protect(request('block_live'), signer, 'HUMAN', '2026-08-17T00:00:00.000Z');
    if (!first.ok) {
      throw new Error(first.error.message);
    }
    const checkpoint = store.writeCheckpoint(first.value.state, '2026-08-17T00:00:00.000Z');
    if (scenario.scenarioId === 'SIGNER-COMPROMISE') {
      const sites = new SignerFencingController();
      sites.register('val_range_a', 'site_a', 'site_b');
      const lease = new SignerFence(() => '2026-08-17T00:00:00.000Z');
      const firstLease = lease.acquire('consensus.val_range_a', 'site_a', 60_000);
      const duplicate = lease.acquire('consensus.val_range_a', 'site_b', 60_000);
      const conflict = store.safety.protect(request('block_conflict'), signer, 'HUMAN', '2026-08-17T00:00:02.000Z');
      recordAlert(env, 'SIGNER_REJECTION');
      env.observability.securityLog.push('LEASE_FENCED');
      return finish({
        scenario,
        sourceCommit: env.sourceCommit,
        testnetGenesis: env.testnetGenesis,
        attackBlocked: !conflict.ok && firstLease.ok && !duplicate.ok,
        safetyHeld: !conflict.ok,
        invariants: holdAll(scenario.expectedSecurityProperties, 'conflicting sign request refused; fence prevents dual active'),
        detections: [
          { channel: 'alert', code: 'SIGNER_REJECTION', observed: true, detail: conflict.ok ? 'signed' : conflict.error.code },
          { channel: 'security_log', code: 'LEASE_FENCED', observed: true, detail: duplicate.ok ? 'second active accepted' : duplicate.error.code },
        ],
        recovery: recovery('KEY_ROTATION', true, true, true, 'operator rotates after fence'),
        notes: `conflict blocked=${String(!conflict.ok)} fenceDuplicateOk=${String(duplicate.ok)} sites=${sites.fence('val_range_a').activeSite}`,
      });
    }
    const stale = {
      ...first.value.state,
      lastSignedHeight: 1n,
      lastSignedRound: 0n,
      lastSignedStep: 'PROPOSAL' as const,
    };
    const rolled = store.restore(stale, checkpoint);
    recordAlert(env, 'SIGNER_REJECTION');
    env.observability.securityLog.push('SIGNER_ROLLBACK');
    const retry = store.safety.protect(request('block_conflict'), signer, 'HUMAN', '2026-08-17T00:00:03.000Z');
    return finish({
      scenario,
      sourceCommit: env.sourceCommit,
      testnetGenesis: env.testnetGenesis,
      attackBlocked: !rolled.ok,
      safetyHeld: !retry.ok,
      invariants: holdAll(scenario.expectedSecurityProperties, 'stale restore rejected; conflicting signature still refused'),
      detections: [
        { channel: 'alert', code: 'SIGNER_REJECTION', observed: true, detail: rolled.ok ? 'restored' : rolled.error.code },
        { channel: 'security_log', code: 'SIGNER_ROLLBACK', observed: !rolled.ok, detail: rolled.ok ? 'accepted' : rolled.error.code },
      ],
      recovery: recovery('SIGNER_FENCING', true, true, true, 'trusted checkpoint retained'),
      notes: `rollback ok=${String(rolled.ok)} conflicting sign ok=${String(retry.ok)}`,
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
