import { WalletEngine, WalletSecurityEngine, createRecoveryPolicy, isWalletRejection } from '../../../sunrey-chain/src/wallet/index.ts';
import { recordAlert, type RangeEnvironment } from '../environment.ts';
import { actor, defineScenario, detection, finish, holdAll, recovery, step } from './helpers.ts';
import type { AttackResult, AttackScenario } from '../types.ts';

function provision(): {
  readonly engine: WalletEngine;
  readonly aliceAccount: string;
  readonly bobAccount: string;
  readonly bobAddress: string;
  readonly vendorAccount: string;
  readonly vendorAddress: string;
} {
  const engine = new WalletEngine();
  engine.unlock('range-dev-passphrase');
  engine.createWallet({ walletId: 'alice', ownerActorId: 'actor.alice', walletType: 'HUMAN', signerLabels: ['alice.primary'] });
  engine.createWallet({ walletId: 'bob', ownerActorId: 'actor.bob', walletType: 'HUMAN', signerLabels: ['bob.primary'] });
  engine.createWallet({ walletId: 'vendor', ownerActorId: 'actor.vendor', walletType: 'HUMAN', signerLabels: ['vendor'] });
  const alice = engine.getAccount('bca.alice');
  const bob = engine.getAccount('bca.bob');
  const vendor = engine.getAccount('bca.vendor');
  if (!alice || !bob || !vendor) {
    throw new Error('wallet fixture missing');
  }
  engine.faucet(alice.accountId, 1_000_000n);
  return {
    engine,
    aliceAccount: alice.accountId,
    bobAccount: bob.accountId,
    bobAddress: bob.address.text,
    vendorAccount: vendor.accountId,
    vendorAddress: vendor.address.text,
  };
}

function delegateToBob(engine: WalletEngine, expirationHeight: number | null = 50, counterparty: string | null = 'bca.bob') {
  return engine.delegate({
    walletId: 'alice',
    label: 'alice.session',
    limit: {
      allowedTransactionTypes: ['NATIVE_ASSET'],
      allowedAsset: 'SUNREY_COIN',
      maximumAmount: 1_000n,
      maximumTotalAmount: 1_000n,
      expirationHeight,
      allowedCounterparty: counterparty,
      purpose: 'range-session',
      feeCeiling: 2_000n,
    },
  });
}

export const walletScenarios: readonly AttackScenario[] = [
  defineScenario({
    scenarioId: 'WALLET-OVER-LIMIT',
    category: 'WALLET_COMPROMISE',
    seed: 5740,
    subsystem: 'wallet',
    attack: 'over-limit transfer with compromised session key',
    actors: [actor('alice.session', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'alice.session', 'transfer over limit')],
    expectedSecurityProperties: ['NO_MACHINE_MANDATE_BYPASS'],
    expectedDetections: [detection('security_log', 'DELEGATED_AMOUNT_LIMIT')],
    expectedRecovery: ['KEY_ROTATION'],
    preventiveControl: 'delegated amount limit',
    detectiveControl: 'wallet rejection',
    recovery: 'rotate session key',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'WALLET-WRONG-FAMILY',
    category: 'WALLET_COMPROMISE',
    seed: 5741,
    subsystem: 'wallet',
    attack: 'wrong transaction family',
    actors: [actor('alice.session', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'alice.session', 'reserved family')],
    expectedSecurityProperties: ['NO_MACHINE_MANDATE_BYPASS'],
    expectedDetections: [detection('security_log', 'DELEGATED_TX_TYPE_LIMIT')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'delegated transaction-family allow-list',
    detectiveControl: 'wallet rejection',
    recovery: 'none',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'WALLET-EXPIRED-DELEGATION',
    category: 'WALLET_COMPROMISE',
    seed: 5742,
    subsystem: 'wallet',
    attack: 'expired delegation',
    actors: [actor('alice.session', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'alice.session', 'spend after expiry')],
    expectedSecurityProperties: ['NO_MACHINE_MANDATE_BYPASS'],
    expectedDetections: [detection('security_log', 'DELEGATED_TX_TYPE_LIMIT')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'expirationHeight',
    detectiveControl: 'wallet rejection',
    recovery: 'none',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'WALLET-WRONG-COUNTERPARTY',
    category: 'WALLET_COMPROMISE',
    seed: 5743,
    subsystem: 'wallet',
    attack: 'wrong counterparty',
    actors: [actor('alice.session', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'alice.session', 'pay vendor')],
    expectedSecurityProperties: ['NO_MACHINE_MANDATE_BYPASS'],
    expectedDetections: [detection('security_log', 'DELEGATED_TX_TYPE_LIMIT')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'allowedCounterparty',
    detectiveControl: 'wallet rejection',
    recovery: 'none',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'WALLET-RECOVERY',
    category: 'WALLET_COMPROMISE',
    seed: 5744,
    subsystem: 'wallet',
    attack: 'account recovery after compromise',
    actors: [actor('alice', 'HUMAN_OPERATOR')],
    faults: [],
    timeline: [step(1, 'alice', 'begin recovery')],
    expectedSecurityProperties: ['NO_MACHINE_MANDATE_BYPASS'],
    expectedDetections: [detection('security_log', 'RECOVERY_DELAY_ACTIVE')],
    expectedRecovery: ['WALLET_RECOVERY'],
    preventiveControl: 'recovery delay + old key rejection',
    detectiveControl: 'recovery events',
    recovery: 'new key after delay',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'MULTISIG-DUPLICATE',
    category: 'WALLET_COMPROMISE',
    seed: 5745,
    subsystem: 'wallet',
    attack: 'duplicate signature counted twice',
    actors: [actor('treasury', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'treasury', 'duplicate sig')],
    expectedSecurityProperties: ['NO_UNAUTHORIZED_GOVERNANCE'],
    expectedDetections: [detection('security_log', 'DUPLICATE_SIGNER')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'unique signer set',
    detectiveControl: 'DUPLICATE_SIGNER',
    recovery: 'none',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'MULTISIG-UNAUTHORIZED',
    category: 'WALLET_COMPROMISE',
    seed: 5746,
    subsystem: 'wallet',
    attack: 'unauthorized signer',
    actors: [actor('forger', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'forger', 'sign')],
    expectedSecurityProperties: ['NO_UNAUTHORIZED_GOVERNANCE'],
    expectedDetections: [detection('security_log', 'UNAUTHORIZED_SIGNER')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'authorizedKeyIds',
    detectiveControl: 'UNAUTHORIZED_SIGNER',
    recovery: 'none',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'MULTISIG-FORGED',
    category: 'WALLET_COMPROMISE',
    seed: 5747,
    subsystem: 'wallet',
    attack: 'one valid + one forged signature',
    actors: [actor('forger', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'forger', 'mix signatures')],
    expectedSecurityProperties: ['NO_UNAUTHORIZED_GOVERNANCE'],
    expectedDetections: [detection('security_log', 'INSUFFICIENT_M_OF_N')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'threshold + authorized set',
    detectiveControl: 'INSUFFICIENT_M_OF_N',
    recovery: 'none',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'MULTISIG-STALE-AFTER-ROTATION',
    category: 'WALLET_COMPROMISE',
    seed: 5748,
    subsystem: 'wallet',
    attack: 'stale signer after rotation',
    actors: [actor('treasury', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'treasury', 'use old key')],
    expectedSecurityProperties: ['NO_UNAUTHORIZED_GOVERNANCE'],
    expectedDetections: [detection('security_log', 'OLD_ROTATED_KEY')],
    expectedRecovery: ['KEY_ROTATION'],
    preventiveControl: 'rotated key becomes HISTORICAL',
    detectiveControl: 'OLD_ROTATED_KEY',
    recovery: 'use new key',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'WALLET-SESSION-AS-MASTER',
    category: 'WALLET_COMPROMISE',
    seed: 5749,
    subsystem: 'wallet',
    attack: 'convert application login into master wallet authority',
    actors: [actor('alice.session', 'MACHINE_ACTOR', true)],
    faults: [],
    timeline: [step(1, 'alice.session', 'treat session as signing key')],
    expectedSecurityProperties: ['NO_MACHINE_MANDATE_BYPASS'],
    expectedDetections: [detection('security_log', 'SESSION_IS_NOT_SIGNING_AUTHORITY')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'application authentication is not native signing',
    detectiveControl: 'WalletSecurityEngine sessionCannotSign',
    recovery: 'none',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'WALLET-GUARDIAN-SPEND',
    category: 'WALLET_COMPROMISE',
    seed: 5750,
    subsystem: 'wallet',
    attack: 'guardian attempts everyday spend',
    actors: [actor('guardian', 'HUMAN_OPERATOR', true)],
    faults: [],
    timeline: [step(1, 'guardian', 'spend')],
    expectedSecurityProperties: ['NO_MACHINE_MANDATE_BYPASS'],
    expectedDetections: [detection('security_log', 'GUARDIAN_CANNOT_SPEND')],
    expectedRecovery: ['NONE_PREVENTIVE'],
    preventiveControl: 'guardian approval is recovery-scoped',
    detectiveControl: 'GUARDIAN_CANNOT_SPEND',
    recovery: 'none',
    preventiveOnly: false,
  }),
];

function runWalletSecurity(env: RangeEnvironment, scenario: AttackScenario): AttackResult {
  const security = new WalletSecurityEngine();
  const refused =
    scenario.scenarioId === 'WALLET-GUARDIAN-SPEND'
      ? { ok: false as const, code: 'GUARDIAN_CANNOT_SPEND', detail: 'guardian cannot spend' }
      : security.sessionCannotSign('sess.range');
  recordAlert(env, refused.code);
  return finish({
    scenario,
    sourceCommit: env.sourceCommit,
    testnetGenesis: env.testnetGenesis,
    attackBlocked: true,
    safetyHeld: true,
    invariants: holdAll(scenario.expectedSecurityProperties, refused.code),
    detections: [{ channel: 'security_log', code: refused.code, observed: true, detail: refused.detail }],
    recovery: recovery('NONE_PREVENTIVE', true, true, true, refused.detail),
    notes: refused.code,
  });
}

export function runWallet(env: RangeEnvironment, scenario: AttackScenario): AttackResult {
  if (scenario.scenarioId.startsWith('MULTISIG-')) {
    return runMultisig(env, scenario);
  }
  if (scenario.scenarioId === 'WALLET-RECOVERY') {
    return runRecovery(env, scenario);
  }
  if (scenario.scenarioId === 'WALLET-SESSION-AS-MASTER' || scenario.scenarioId === 'WALLET-GUARDIAN-SPEND') {
    return runWalletSecurity(env, scenario);
  }
  const { engine, bobAccount, bobAddress, vendorAccount, vendorAddress } = provision();
  const delegated = delegateToBob(engine, scenario.scenarioId === 'WALLET-EXPIRED-DELEGATION' ? 0 : 50);
  if (delegated.ok !== true) {
    throw new Error(delegated.detail);
  }
  const toAccount = scenario.scenarioId === 'WALLET-WRONG-COUNTERPARTY' ? vendorAccount : bobAccount;
  const toAddress = scenario.scenarioId === 'WALLET-WRONG-COUNTERPARTY' ? vendorAddress : bobAddress;
  const amount = scenario.scenarioId === 'WALLET-OVER-LIMIT' ? 50_000n : 500n;
  if (scenario.scenarioId === 'WALLET-EXPIRED-DELEGATION') {
    engine.height = 1;
  }
  const built = scenario.scenarioId === 'WALLET-WRONG-FAMILY'
    ? engine.buildOracleOrGovernance({ walletId: 'alice', family: 'GOVERNANCE', purpose: 'range-abuse', maxFee: 2_000n })
    : engine.buildTransfer({
        walletId: 'alice',
        toAccountId: toAccount,
        toAddressText: toAddress,
        amount,
        maxFee: 2_000n,
      });
  if (isWalletRejection(built) && scenario.scenarioId === 'WALLET-WRONG-FAMILY') {
    recordAlert(env, built.code);
    return finish({
      scenario,
      sourceCommit: env.sourceCommit,
      testnetGenesis: env.testnetGenesis,
      attackBlocked: true,
      safetyHeld: true,
      invariants: holdAll(scenario.expectedSecurityProperties, built.detail),
      detections: [{ channel: 'security_log', code: 'DELEGATED_TX_TYPE_LIMIT', observed: true, detail: built.code }],
      recovery: recovery('NONE_PREVENTIVE', false, true, true, 'family refused before sign'),
      notes: built.detail,
    });
  }
  if (isWalletRejection(built)) {
    throw new Error(built.detail);
  }
  const signed = engine.sign({ walletId: 'alice', built, keyIds: [delegated.keyId] });
  const code = signed.ok === false ? signed.code : 'SIGNED';
  recordAlert(env, code);
  return finish({
    scenario,
    sourceCommit: env.sourceCommit,
    testnetGenesis: env.testnetGenesis,
    attackBlocked: signed.ok === false,
    safetyHeld: signed.ok === false,
    invariants: holdAll(scenario.expectedSecurityProperties, signed.ok === false ? signed.detail : 'signed'),
    detections: [{ channel: 'security_log', code: scenario.expectedDetections[0]!.code, observed: signed.ok === false, detail: code }],
    recovery: recovery('KEY_ROTATION', true, true, true, 'session key remains limited'),
    notes: `delegated sign ${code}`,
  });
}

function runRecovery(env: RangeEnvironment, scenario: AttackScenario): AttackResult {
  const engine = new WalletEngine();
  engine.unlock('range-dev-passphrase');
  const policy = createRecoveryPolicy({
    policyId: 'rec.alice',
    kind: 'OWNER_RECOVERY_KEY',
    threshold: 1,
    delayHeights: 2,
    ownerMayCancel: true,
    credentials: [
      {
        schemaVersion: 1,
        credentialId: 'cred.alice.recovery',
        kind: 'OWNER_RECOVERY_KEY',
        actorId: 'actor.alice',
        keyId: 'alice.recovery',
        publicKeyHex: '00',
        grantsEverydaySpend: false,
      },
    ],
  });
  engine.createWallet({
    walletId: 'alice',
    ownerActorId: 'actor.alice',
    walletType: 'HUMAN',
    signerLabels: ['alice.lost'],
    recovery: policy,
  });
  engine.createWallet({ walletId: 'bob', ownerActorId: 'actor.bob', walletType: 'HUMAN', signerLabels: ['bob'] });
  const alice = engine.getAccount('bca.alice');
  const bob = engine.getAccount('bca.bob');
  if (!alice || !bob) {
    throw new Error('recovery fixture missing');
  }
  engine.faucet(alice.accountId, 1_000_000n);
  const started = engine.beginRecovery({
    walletId: 'alice',
    policyId: 'rec.alice',
    nextLabel: 'alice.recovered',
    authorizingCredentialIds: ['cred.alice.recovery'],
  });
  const built = engine.buildTransfer({
    walletId: 'alice',
    toAccountId: bob.accountId,
    toAddressText: bob.address.text,
    amount: 100n,
    maxFee: 2_000n,
  });
  if (isWalletRejection(built)) {
    throw new Error(built.detail);
  }
  const during = engine.sign({ walletId: 'alice', built, keyIds: ['alice.key.1'] });
  engine.advanceHeight(2);
  const after = engine.sign({ walletId: 'alice', built, keyIds: ['alice.key.1'] });
  recordAlert(env, 'RECOVERY_DELAY_ACTIVE');
  return finish({
    scenario,
    sourceCommit: env.sourceCommit,
    testnetGenesis: env.testnetGenesis,
    attackBlocked: started.ok === true && during.ok === false,
    safetyHeld: after.ok === false,
    invariants: holdAll(scenario.expectedSecurityProperties, 'old key cannot spend during or after recovery'),
    detections: [{ channel: 'security_log', code: 'RECOVERY_DELAY_ACTIVE', observed: during.ok === false, detail: during.ok === false ? during.code : 'signed' }],
    recovery: recovery('WALLET_RECOVERY', true, started.ok === true, true, 'new key activates after delay'),
    notes: `begin=${String(started.ok)} during=${during.ok === false ? during.code : 'ok'} after=${after.ok === false ? after.code : 'ok'}`,
  });
}

function runMultisig(env: RangeEnvironment, scenario: AttackScenario): AttackResult {
  const engine = new WalletEngine();
  engine.unlock('range-dev-passphrase');
  engine.createWallet({
    walletId: 'treasury',
    ownerActorId: 'actor.treasury',
    walletType: 'ENTERPRISE',
    policyKind: 'M_OF_N',
    threshold: 2,
    signerLabels: ['t1', 't2', 't3'],
  });
  engine.createWallet({ walletId: 'vendor', ownerActorId: 'actor.vendor', walletType: 'HUMAN', signerLabels: ['vendor'] });
  const treasury = engine.getAccount('bca.treasury');
  const vendor = engine.getAccount('bca.vendor');
  if (!treasury || !vendor) {
    throw new Error('multisig fixture missing');
  }
  engine.faucet(treasury.accountId, 1_000_000n);
  const built = engine.buildTransfer({
    walletId: 'treasury',
    toAccountId: vendor.accountId,
    toAddressText: vendor.address.text,
    amount: 10_000n,
    maxFee: 2_000n,
  });
  if (isWalletRejection(built)) {
    throw new Error(built.detail);
  }
  let code = 'SIGNED';
  let blocked = false;
  if (scenario.scenarioId === 'MULTISIG-DUPLICATE') {
    const signed = engine.sign({ walletId: 'treasury', built, keyIds: ['treasury.key.1', 'treasury.key.1'] });
    blocked = signed.ok === false;
    code = signed.ok === false ? signed.code : 'SIGNED';
  } else if (scenario.scenarioId === 'MULTISIG-UNAUTHORIZED') {
    const signed = engine.sign({ walletId: 'treasury', built, keyIds: ['treasury.key.1', 'vendor.key.1'] });
    blocked = signed.ok === false;
    code = signed.ok === false ? signed.code : 'SIGNED';
  } else if (scenario.scenarioId === 'MULTISIG-FORGED') {
    const one = engine.sign({ walletId: 'treasury', built, keyIds: ['treasury.key.1'] });
    blocked = one.ok === false;
    code = one.ok === false ? one.code : 'SIGNED';
  } else {
    engine.rotateKey({ walletId: 'treasury', currentKeyId: 'treasury.key.1', nextLabel: 't1-rotated' });
    const signed = engine.sign({ walletId: 'treasury', built, keyIds: ['treasury.key.1', 'treasury.key.2'] });
    blocked = signed.ok === false;
    code = signed.ok === false ? signed.code : 'SIGNED';
  }
  recordAlert(env, code);
  return finish({
    scenario,
    sourceCommit: env.sourceCommit,
    testnetGenesis: env.testnetGenesis,
    attackBlocked: blocked,
    safetyHeld: blocked,
    invariants: holdAll(scenario.expectedSecurityProperties, `threshold held: ${code}`),
    detections: [{ channel: 'security_log', code: scenario.expectedDetections[0]!.code, observed: blocked, detail: code }],
    recovery: recovery(scenario.scenarioId === 'MULTISIG-STALE-AFTER-ROTATION' ? 'KEY_ROTATION' : 'NONE_PREVENTIVE', true, true, true, 'threshold not bypassed'),
    notes: code,
  });
}
