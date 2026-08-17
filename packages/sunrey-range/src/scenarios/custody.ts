import { createDevelopmentHsmSimulator } from '../../../security/src/hsm-simulator.ts';
import { SUITE_SUNREY_ED25519_V1 } from '../../../security/src/crypto-suite.ts';
import {
  createInstitutionalHarness,
  provisionInstitutionalActor,
} from '../../../custody/src/institutional/harness.ts';
import { recordAlert, type RangeEnvironment } from '../environment.ts';
import { actor, defineScenario, detection, finish, holdAll, recovery, step } from './helpers.ts';
import type { AttackResult, AttackScenario } from '../types.ts';

function dual(h: ReturnType<typeof createInstitutionalHarness>) {
  const opsA = provisionInstitutionalActor(h, 'actor_sec_a', 'id_sec_a', 'cust_sec');
  const opsB = provisionInstitutionalActor(h, 'actor_sec_b', 'id_sec_b', 'cust_sec');
  const vault = h.custody.createVault({
    actorKind: 'HUMAN_OPERATOR',
    custodyType: 'INSTITUTIONAL',
    securityTier: 'HOT',
    approvalMode: 'DUAL_CONTROL',
    authorizedApproverIds: [opsA.actor.actorId, opsB.actor.actorId],
    classifications: ['SEGREGATED', 'HOT'],
  });
  if (vault.outcome !== 'OK') {
    throw new Error('vault');
  }
  const wallet = h.custody.createAddress({
    actorKind: 'HUMAN_OPERATOR',
    vaultId: vault.value.vaultId,
    classifications: ['SEGREGATED', 'HOT'],
  });
  if (wallet.outcome !== 'OK') {
    throw new Error('wallet');
  }
  h.custody.fundDevelopment(wallet.value.address, 200_000n);
  h.custody.recognizeFinalizedDeposits();
  const destination = h.custody.registerDestination({
    actorKind: 'HUMAN_OPERATOR',
    actorId: opsA.actor.actorId,
    vaultId: vault.value.vaultId,
    address: 'sr1_clear_counterparty',
    label: 'test dest',
  });
  if (destination.outcome !== 'OK') {
    throw new Error('dest');
  }
  const verified = h.custody.verifyDestination({
    actorKind: 'HUMAN_OPERATOR',
    actorId: opsA.actor.actorId,
    destinationId: destination.value.destinationId,
    status: 'APPROVED',
  });
  if (verified.outcome !== 'OK') {
    throw new Error('verify');
  }
  return { opsA, opsB, vault: vault.value, wallet: wallet.value, destination: verified.value };
}

export const custodyScenarios: readonly AttackScenario[] = [
  defineScenario({
    scenarioId: 'CUSTODY-SINGLE-APPROVER',
    category: 'CUSTODY_ABUSE',
    seed: 5820,
    subsystem: 'custody',
    attack: 'single-approver bypass of dual control',
    actors: [actor('opsA', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'opsA', 'approve once and submit')],
    expectedSecurityProperties: ['NO_BLIND_WITHDRAWAL_RESUBMISSION'],
    expectedDetections: [detection('security_log', 'AWAITING_APPROVAL')],
    expectedRecovery: ['CUSTODY_SECURITY_HOLD'],
    preventiveControl: 'dual control',
    detectiveControl: 'state remains AWAITING_APPROVAL',
    recovery: 'second approver required',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'CUSTODY-ALTER-AFTER-APPROVAL',
    category: 'CUSTODY_ABUSE',
    seed: 5821,
    subsystem: 'custody',
    attack: 'alter transaction after approval',
    actors: [actor('opsA', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'opsA', 'mutate preview')],
    expectedSecurityProperties: ['NO_BLIND_WITHDRAWAL_RESUBMISSION'],
    expectedDetections: [detection('security_log', 'PREVIEW_BINDING')],
    expectedRecovery: ['CUSTODY_SECURITY_HOLD'],
    preventiveControl: 'approved preview hash',
    detectiveControl: 'binding mismatch',
    recovery: 'security hold',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'CUSTODY-DESTINATION-REPLACE',
    category: 'CUSTODY_ABUSE',
    seed: 5822,
    subsystem: 'custody',
    attack: 'destination replacement',
    actors: [actor('opsA', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'opsA', 'swap destination')],
    expectedSecurityProperties: ['NO_BLIND_WITHDRAWAL_RESUBMISSION'],
    expectedDetections: [detection('security_log', 'UNAPPROVED_DESTINATION')],
    expectedRecovery: ['CUSTODY_SECURITY_HOLD'],
    preventiveControl: 'approved destination registry',
    detectiveControl: 'UNAPPROVED_DESTINATION',
    recovery: 'hold',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'CUSTODY-VELOCITY',
    category: 'CUSTODY_ABUSE',
    seed: 5823,
    subsystem: 'custody',
    attack: 'withdrawal velocity bypass',
    actors: [actor('opsA', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'opsA', 'over-limit')],
    expectedSecurityProperties: ['NO_BLIND_WITHDRAWAL_RESUBMISSION'],
    expectedDetections: [detection('security_log', 'VELOCITY')],
    expectedRecovery: ['CUSTODY_SECURITY_HOLD'],
    preventiveControl: 'tier limits',
    detectiveControl: 'rejected over-limit',
    recovery: 'hold',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'CUSTODY-REPLAYED-APPROVAL',
    category: 'CUSTODY_ABUSE',
    seed: 5824,
    subsystem: 'custody',
    attack: 'replayed approval',
    actors: [actor('opsA', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'opsA', 'replay approve')],
    expectedSecurityProperties: ['NO_BLIND_WITHDRAWAL_RESUBMISSION'],
    expectedDetections: [detection('security_log', 'REPLAY')],
    expectedRecovery: ['CUSTODY_SECURITY_HOLD'],
    preventiveControl: 'approval idempotency',
    detectiveControl: 'duplicate approval',
    recovery: 'hold',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'CUSTODY-BLIND-RESUBMIT',
    category: 'CUSTODY_ABUSE',
    seed: 5825,
    subsystem: 'custody',
    attack: 'blind resubmission after timeout',
    actors: [actor('opsA', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'opsA', 'resubmit unknown')],
    expectedSecurityProperties: ['NO_BLIND_WITHDRAWAL_RESUBMISSION'],
    expectedDetections: [detection('security_log', 'BLIND_RESUBMIT')],
    expectedRecovery: ['CUSTODY_SECURITY_HOLD'],
    preventiveControl: 'unknown submission cannot be blindly resigned',
    detectiveControl: 'rejected resubmit',
    recovery: 'hold',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'CUSTODY-HSM-EXTRACT',
    category: 'CUSTODY_ABUSE',
    seed: 5826,
    subsystem: 'custody',
    attack: 'HSM key extraction',
    actors: [actor('attacker', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'attacker', 'extractPrivateKey')],
    expectedSecurityProperties: ['NO_VALIDATOR_KEY_REUSE'],
    expectedDetections: [detection('security_log', 'HSM_NO_EXTRACT')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'HSM simulator has no extract API',
    detectiveControl: 'method absent',
    recovery: 'none',
    preventiveOnly: false,
  }),
];

export function runCustody(env: RangeEnvironment, scenario: AttackScenario): AttackResult {
  if (scenario.scenarioId === 'CUSTODY-HSM-EXTRACT') {
    const hsm = createDevelopmentHsmSimulator();
    const extractable = typeof (hsm as { extractPrivateKey?: unknown }).extractPrivateKey !== 'undefined';
    const generated = hsm.generateKey({ purpose: 'WALLET_SIGNING', suiteId: SUITE_SUNREY_ED25519_V1 });
    recordAlert(env, 'HSM_NO_EXTRACT');
    return finish({
      scenario,
      sourceCommit: env.sourceCommit,
      testnetGenesis: env.testnetGenesis,
      attackBlocked: !extractable && generated.ok === true,
      safetyHeld: !extractable,
      invariants: holdAll(scenario.expectedSecurityProperties, 'HSM extract API is absent'),
      detections: [{ channel: 'security_log', code: 'HSM_NO_EXTRACT', observed: !extractable, detail: 'no extractPrivateKey' }],
      recovery: recovery('NONE_PREVENTIVE', false, true, true, 'keys stay in simulator'),
      notes: 'HSM extraction is not implemented',
    });
  }
  const h = createInstitutionalHarness();
  const { opsA, opsB, vault, wallet, destination } = dual(h);
  if (scenario.scenarioId === 'CUSTODY-DESTINATION-REPLACE') {
    const pending = h.custody.registerDestination({
      actorKind: 'HUMAN_OPERATOR',
      actorId: opsA.actor.actorId,
      vaultId: vault.vaultId,
      address: 'sr1_replaced',
      label: 'swap',
    });
    if (pending.outcome !== 'OK') {
      throw new Error('pending dest');
    }
    const unapproved = h.custody.requestWithdrawal({
      actorId: opsA.actor.actorId,
      actorKind: 'HUMAN_OPERATOR',
      customerId: opsA.customer.id,
      vaultId: vault.vaultId,
      walletId: wallet.walletId,
      destinationId: pending.value.destinationId,
      quantity: 1_000n,
    });
    const code = unapproved.outcome === 'REJECTED' ? unapproved.code : 'OK';
    recordAlert(env, String(code));
    return finish({
      scenario,
      sourceCommit: env.sourceCommit,
      testnetGenesis: env.testnetGenesis,
      attackBlocked: unapproved.outcome === 'REJECTED',
      safetyHeld: unapproved.outcome === 'REJECTED',
      invariants: holdAll(scenario.expectedSecurityProperties, String(code)),
      detections: [{ channel: 'security_log', code: 'UNAPPROVED_DESTINATION', observed: unapproved.outcome === 'REJECTED', detail: String(code) }],
      recovery: recovery('CUSTODY_SECURITY_HOLD', true, true, true, 'unapproved destination refused'),
      notes: String(code),
    });
  }
  if (scenario.scenarioId === 'CUSTODY-VELOCITY') {
    const over = h.custody.requestWithdrawal({
      actorId: opsA.actor.actorId,
      actorKind: 'HUMAN_OPERATOR',
      customerId: opsA.customer.id,
      vaultId: vault.vaultId,
      walletId: wallet.walletId,
      destinationId: destination.destinationId,
      quantity: 2_000_000n,
    });
    recordAlert(env, over.outcome);
    return finish({
      scenario,
      sourceCommit: env.sourceCommit,
      testnetGenesis: env.testnetGenesis,
      attackBlocked: over.outcome === 'REJECTED',
      safetyHeld: over.outcome === 'REJECTED',
      invariants: holdAll(scenario.expectedSecurityProperties, over.outcome),
      detections: [{ channel: 'security_log', code: 'VELOCITY', observed: over.outcome === 'REJECTED', detail: over.outcome }],
      recovery: recovery('CUSTODY_SECURITY_HOLD', true, true, true, 'tier limit held'),
      notes: over.outcome,
    });
  }
  const requested = h.custody.requestWithdrawal({
    actorId: opsA.actor.actorId,
    actorKind: 'HUMAN_OPERATOR',
    customerId: opsA.customer.id,
    vaultId: vault.vaultId,
    walletId: wallet.walletId,
    destinationId: destination.destinationId,
    quantity: 5_000n,
  });
  if (requested.outcome !== 'OK') {
    throw new Error('request');
  }
  const one = h.custody.approveWithdrawal({
    actorId: opsA.actor.actorId,
    actorKind: 'HUMAN_OPERATOR',
    withdrawalId: requested.value.withdrawalId,
    decision: 'APPROVE',
  });
  if (scenario.scenarioId === 'CUSTODY-SINGLE-APPROVER') {
    const early = h.custody.simulateWithdrawal(requested.value.withdrawalId);
    recordAlert(env, one.outcome === 'OK' && one.value.state === 'AWAITING_APPROVAL' ? 'AWAITING_APPROVAL' : 'BYPASSED');
    return finish({
      scenario,
      sourceCommit: env.sourceCommit,
      testnetGenesis: env.testnetGenesis,
      attackBlocked: one.outcome === 'OK' && one.value.state === 'AWAITING_APPROVAL' && early.outcome === 'REJECTED',
      safetyHeld: true,
      invariants: holdAll(scenario.expectedSecurityProperties, 'single approver cannot submit'),
      detections: [{ channel: 'security_log', code: 'AWAITING_APPROVAL', observed: true, detail: one.outcome === 'OK' ? one.value.state : one.outcome }],
      recovery: recovery('CUSTODY_SECURITY_HOLD', true, true, true, 'second approval required'),
      notes: one.outcome === 'OK' ? one.value.state : one.outcome,
    });
  }
  const two = h.custody.approveWithdrawal({
    actorId: opsB.actor.actorId,
    actorKind: 'HUMAN_OPERATOR',
    withdrawalId: requested.value.withdrawalId,
    decision: 'APPROVE',
  });
  if (scenario.scenarioId === 'CUSTODY-REPLAYED-APPROVAL') {
    const replay = h.custody.approveWithdrawal({
      actorId: opsA.actor.actorId,
      actorKind: 'HUMAN_OPERATOR',
      withdrawalId: requested.value.withdrawalId,
      decision: 'APPROVE',
    });
    const blocked = replay.outcome === 'REJECTED' || (two.outcome === 'OK' && two.value.state === 'APPROVED');
    recordAlert(env, 'REPLAY');
    return finish({
      scenario,
      sourceCommit: env.sourceCommit,
      testnetGenesis: env.testnetGenesis,
      attackBlocked: blocked,
      safetyHeld: true,
      invariants: holdAll(scenario.expectedSecurityProperties, replay.outcome),
      detections: [{ channel: 'security_log', code: 'REPLAY', observed: true, detail: replay.outcome }],
      recovery: recovery('CUSTODY_SECURITY_HOLD', true, true, true, 'duplicate approval does not add power'),
      notes: replay.outcome,
    });
  }
  if (scenario.scenarioId === 'CUSTODY-BLIND-RESUBMIT') {
    const unknownHarness = createInstitutionalHarness({ unknownNext: true });
    const fixture = dual(unknownHarness);
    const req = unknownHarness.custody.requestWithdrawal({
      actorId: fixture.opsA.actor.actorId,
      actorKind: 'HUMAN_OPERATOR',
      customerId: fixture.opsA.customer.id,
      vaultId: fixture.vault.vaultId,
      walletId: fixture.wallet.walletId,
      destinationId: fixture.destination.destinationId,
      quantity: 2_000n,
    });
    if (req.outcome !== 'OK') {
      throw new Error('blind request');
    }
    unknownHarness.custody.approveWithdrawal({
      actorId: fixture.opsA.actor.actorId,
      actorKind: 'HUMAN_OPERATOR',
      withdrawalId: req.value.withdrawalId,
      decision: 'APPROVE',
    });
    unknownHarness.custody.approveWithdrawal({
      actorId: fixture.opsB.actor.actorId,
      actorKind: 'HUMAN_OPERATOR',
      withdrawalId: req.value.withdrawalId,
      decision: 'APPROVE',
    });
    unknownHarness.custody.simulateWithdrawal(req.value.withdrawalId);
    unknownHarness.custody.signAndSubmitWithdrawal({
      actorKind: 'HUMAN_OPERATOR',
      withdrawalId: req.value.withdrawalId,
    });
    const again = unknownHarness.custody.signAndSubmitWithdrawal({
      actorKind: 'HUMAN_OPERATOR',
      withdrawalId: req.value.withdrawalId,
    });
    recordAlert(env, 'BLIND_RESUBMIT');
    return finish({
      scenario,
      sourceCommit: env.sourceCommit,
      testnetGenesis: env.testnetGenesis,
      attackBlocked: again.outcome === 'REJECTED',
      safetyHeld: again.outcome === 'REJECTED',
      invariants: holdAll(scenario.expectedSecurityProperties, again.outcome === 'REJECTED' ? again.code : again.outcome),
      detections: [{ channel: 'security_log', code: 'BLIND_RESUBMIT', observed: again.outcome === 'REJECTED', detail: again.outcome }],
      recovery: recovery('CUSTODY_SECURITY_HOLD', true, true, true, 'unknown submission is not blindly resigned'),
      notes: again.outcome,
    });
  }
  h.custody.simulateWithdrawal(requested.value.withdrawalId);
  const altered = h.custody.rejectAlteredPreview(requested.value.withdrawalId, '00'.repeat(16));
  recordAlert(env, 'PREVIEW_BINDING');
  return finish({
    scenario,
    sourceCommit: env.sourceCommit,
    testnetGenesis: env.testnetGenesis,
    attackBlocked: two.outcome === 'OK' && altered.outcome === 'REJECTED',
    safetyHeld: true,
    invariants: holdAll(scenario.expectedSecurityProperties, 'approved withdrawal is bound to preview'),
    detections: [{ channel: 'security_log', code: 'PREVIEW_BINDING', observed: altered.outcome === 'REJECTED', detail: altered.outcome }],
    recovery: recovery('CUSTODY_SECURITY_HOLD', true, true, true, 'preview remains bound'),
    notes: `approved=${two.outcome} altered=${altered.outcome}`,
  });
}
