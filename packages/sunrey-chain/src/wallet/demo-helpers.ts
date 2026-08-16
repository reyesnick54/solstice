import { PROTOCOL_NETWORK_ID } from '../protocol/constants.ts';
import { developmentPorts, MachineEconomyEngine } from '../machine-economy/index.ts';
import { WalletEngine, createRecoveryPolicy, CLASSICAL_WALLET_SUITE, HYBRID_WALLET_SUITE } from './engine.ts';
import { isWalletRejection } from './types.ts';

export type TransferDemoReport = {
  readonly aliceAccount: string;
  readonly bobAccount: string;
  readonly aliceAddress: string;
  readonly bobAddress: string;
  readonly aliceBefore: string;
  readonly bobAfter: string;
  readonly estimatedFee: string;
  readonly maximumAuthorizedFee: string;
  readonly actualFinalizedFee: string;
  readonly txId: string;
  readonly height: number;
  readonly historyCount: number;
  readonly stateRoots: readonly string[];
  readonly rootsEqual: boolean;
};

export type MultiAuthDemoReport = {
  readonly oneSignatureRejected: true;
  readonly twoSignaturesAccepted: true;
  readonly duplicateRejected: true;
  readonly unauthorizedRejected: true;
  readonly txId: string;
};

export type RecoveryDemoReport = {
  readonly delayEnforced: true;
  readonly oldKeyRejected: true;
  readonly historicStillVerifies: true;
  readonly newKeyAccepted: true;
  readonly activationHeight: number;
};

export type PqMigrationDemoReport = {
  readonly startedSuite: string;
  readonly endedSuite: string;
  readonly historicStillVerifies: true;
  readonly downgradeRejected: true;
};

function fourEngines(): WalletEngine[] {
  return [0, 1, 2, 3].map(() => {
    const engine = new WalletEngine({ networkId: PROTOCOL_NETWORK_ID });
    engine.unlock('development-passphrase');
    return engine;
  });
}

export function runTransferDemo(): TransferDemoReport {
  const engines = fourEngines();
  const [primary, ...replicas] = engines;
  primary.createWallet({ walletId: 'alice', ownerActorId: 'actor.alice', walletType: 'HUMAN', signerLabels: ['alice.primary'] });
  primary.createWallet({ walletId: 'bob', ownerActorId: 'actor.bob', walletType: 'HUMAN', signerLabels: ['bob.primary'] });
  const alice = primary.getAccount('bca.alice');
  const bob = primary.getAccount('bca.bob');
  if (!alice || !bob) {
    throw new Error('alice/bob accounts missing');
  }
  primary.faucet(alice.accountId, 1_000_000n);
  const aliceBefore = primary.balance(alice.accountId).toString();
  const built = primary.buildTransfer({
    walletId: 'alice',
    toAccountId: bob.accountId,
    toAddressText: bob.address.text,
    amount: 25_000n,
    maxFee: 2_000n,
  });
  if (isWalletRejection(built)) {
    throw new Error(built.detail);
  }
  const signed = primary.sign({ walletId: 'alice', built, keyIds: ['alice.key.1'] });
  if (signed.ok === false) {
    throw new Error(signed.detail);
  }
  const submitted = primary.submit({ walletId: 'alice', built, signatures: signed.signatures });
  if (submitted.ok === false) {
    throw new Error(submitted.detail);
  }
  for (const replica of replicas) {
    replica.createWallet({ walletId: 'alice', ownerActorId: 'actor.alice', walletType: 'HUMAN', signerLabels: ['alice.primary'] });
    replica.createWallet({ walletId: 'bob', ownerActorId: 'actor.bob', walletType: 'HUMAN', signerLabels: ['bob.primary'] });
    replica.faucet(alice.accountId, 1_000_000n);
    replica.submit({ walletId: 'alice', built, signatures: signed.signatures });
  }
  const roots = engines.map((engine) => engine.stateRoot());
  const history = primary.reconstructHistory();
  return {
    aliceAccount: alice.accountId,
    bobAccount: bob.accountId,
    aliceAddress: alice.address.text,
    bobAddress: bob.address.text,
    aliceBefore,
    bobAfter: primary.balance(bob.accountId).toString(),
    estimatedFee: built.fee.estimatedFee.toString(),
    maximumAuthorizedFee: built.fee.maximumAuthorizedFee.toString(),
    actualFinalizedFee: primary.history.get(submitted.txId)?.actualFinalizedFee?.toString() ?? '0',
    txId: submitted.txId,
    height: submitted.height,
    historyCount: history.length,
    stateRoots: roots,
    rootsEqual: roots.every((root) => root === roots[0]),
  };
}

export function runMultiAuthDemo(): MultiAuthDemoReport {
  const engine = new WalletEngine();
  engine.unlock('development-passphrase');
  engine.createWallet({
    walletId: 'treasury',
    ownerActorId: 'actor.treasury',
    walletType: 'ENTERPRISE',
    policyKind: 'M_OF_N',
    threshold: 2,
    signerLabels: ['t1', 't2', 't3'],
  });
  const account = engine.getAccount('bca.treasury');
  if (!account) {
    throw new Error('treasury missing');
  }
  engine.createWallet({ walletId: 'vendor', ownerActorId: 'actor.vendor', walletType: 'HUMAN', signerLabels: ['vendor'] });
  const vendor = engine.getAccount('bca.vendor');
  if (!vendor) {
    throw new Error('vendor missing');
  }
  engine.faucet(account.accountId, 1_000_000n);
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
  const one = engine.sign({ walletId: 'treasury', built, keyIds: ['treasury.key.1'] });
  if (one.ok !== false || one.code !== 'INSUFFICIENT_M_OF_N') {
    throw new Error('one signature must be insufficient');
  }
  const duplicate = engine.sign({
    walletId: 'treasury',
    built,
    keyIds: ['treasury.key.1', 'treasury.key.1'],
  });
  if (duplicate.ok !== false || duplicate.code !== 'DUPLICATE_SIGNER') {
    throw new Error('duplicate signer must be rejected');
  }
  engine.createWallet({ walletId: 'intruder', ownerActorId: 'actor.intruder', walletType: 'HUMAN', signerLabels: ['intruder'] });
  const unauthorized = engine.sign({
    walletId: 'treasury',
    built,
    keyIds: ['treasury.key.1', 'intruder.key.1'],
  });
  if (unauthorized.ok !== false || unauthorized.code !== 'UNAUTHORIZED_SIGNER') {
    throw new Error('unauthorized signer must be rejected');
  }
  const two = engine.sign({ walletId: 'treasury', built, keyIds: ['treasury.key.1', 'treasury.key.2'] });
  if (two.ok === false) {
    throw new Error(two.detail);
  }
  const submitted = engine.submit({ walletId: 'treasury', built, signatures: two.signatures });
  if (submitted.ok === false) {
    throw new Error(submitted.detail);
  }
  return {
    oneSignatureRejected: true,
    twoSignaturesAccepted: true,
    duplicateRejected: true,
    unauthorizedRejected: true,
    txId: submitted.txId,
  };
}

export function runRecoveryDemo(): RecoveryDemoReport {
  const engine = new WalletEngine();
  engine.unlock('development-passphrase');
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
    throw new Error('accounts missing');
  }
  engine.faucet(alice.accountId, 1_000_000n);
  const first = engine.buildTransfer({
    walletId: 'alice',
    toAccountId: bob.accountId,
    toAddressText: bob.address.text,
    amount: 1_000n,
    maxFee: 2_000n,
  });
  if (isWalletRejection(first)) {
    throw new Error(first.detail);
  }
  const signed = engine.sign({ walletId: 'alice', built: first, keyIds: ['alice.key.1'] });
  if (signed.ok === false) {
    throw new Error(signed.detail);
  }
  const submitted = engine.submit({ walletId: 'alice', built: first, signatures: signed.signatures });
  if (submitted.ok === false) {
    throw new Error(submitted.detail);
  }
  const historicKey = alice.keys[0];
  const started = engine.beginRecovery({
    walletId: 'alice',
    policyId: 'rec.alice',
    nextLabel: 'alice.recovered',
    authorizingCredentialIds: ['cred.alice.recovery'],
  });
  if (started.ok === false) {
    throw new Error(started.detail);
  }
  const during = engine.buildTransfer({
    walletId: 'alice',
    toAccountId: bob.accountId,
    toAddressText: bob.address.text,
    amount: 500n,
    maxFee: 2_000n,
  });
  if (isWalletRejection(during)) {
    throw new Error(during.detail);
  }
  const oldDuring = engine.sign({ walletId: 'alice', built: during, keyIds: ['alice.key.1'] });
  if (oldDuring.ok !== false || oldDuring.code !== 'RECOVERY_DELAY_ACTIVE') {
    throw new Error('spend must be blocked during recovery delay');
  }
  engine.advanceHeight(2);
  const recovered = engine.getAccount('bca.alice');
  if (!recovered || recovered.status !== 'ACTIVE') {
    throw new Error('recovery did not activate');
  }
  const after = engine.buildTransfer({
    walletId: 'alice',
    toAccountId: bob.accountId,
    toAddressText: bob.address.text,
    amount: 500n,
    maxFee: 2_000n,
  });
  if (isWalletRejection(after)) {
    throw new Error(after.detail);
  }
  const oldAfter = engine.sign({ walletId: 'alice', built: after, keyIds: ['alice.key.1'] });
  if (oldAfter.ok !== false || oldAfter.code !== 'OLD_ROTATED_KEY') {
    throw new Error('old key must be rejected after recovery');
  }
  const next = recovered.keys.find((key) => key.status === 'ACTIVE');
  if (!next) {
    throw new Error('recovered key missing');
  }
  const fresh = engine.sign({ walletId: 'alice', built: after, keyIds: [next.keyId] });
  if (fresh.ok === false) {
    throw new Error(fresh.detail);
  }
  const historic = engine.verifyHistoric(submitted.txId, historicKey.publicKeyHex);
  if (!historic) {
    throw new Error('historic signature must remain verifiable');
  }
  return {
    delayEnforced: true,
    oldKeyRejected: true,
    historicStillVerifies: true,
    newKeyAccepted: true,
    activationHeight: started.activationHeight,
  };
}

export function runPqMigrationDemo(): PqMigrationDemoReport {
  const engine = new WalletEngine();
  engine.unlock('development-passphrase');
  engine.createWallet({
    walletId: 'alice',
    ownerActorId: 'actor.alice',
    walletType: 'HUMAN',
    signerLabels: ['alice.classical'],
    approvedCryptoSuites: [CLASSICAL_WALLET_SUITE],
  });
  engine.createWallet({ walletId: 'bob', ownerActorId: 'actor.bob', walletType: 'HUMAN', signerLabels: ['bob'] });
  const alice = engine.getAccount('bca.alice');
  const bob = engine.getAccount('bca.bob');
  if (!alice || !bob) {
    throw new Error('accounts missing');
  }
  engine.faucet(alice.accountId, 1_000_000n);
  const first = engine.buildTransfer({
    walletId: 'alice',
    toAccountId: bob.accountId,
    toAddressText: bob.address.text,
    amount: 1_000n,
    maxFee: 2_000n,
  });
  if (isWalletRejection(first)) {
    throw new Error(first.detail);
  }
  const signed = engine.sign({ walletId: 'alice', built: first, keyIds: ['alice.key.1'] });
  if (signed.ok === false) {
    throw new Error(signed.detail);
  }
  const submitted = engine.submit({ walletId: 'alice', built: first, signatures: signed.signatures });
  if (submitted.ok === false) {
    throw new Error(submitted.detail);
  }
  const rotated = engine.rotateKey({
    walletId: 'alice',
    currentKeyId: 'alice.key.1',
    nextLabel: 'alice.hybrid',
    nextSuiteId: HYBRID_WALLET_SUITE,
  });
  if (rotated.ok === false) {
    throw new Error(rotated.detail);
  }
  const next = engine.buildTransfer({
    walletId: 'alice',
    toAccountId: bob.accountId,
    toAddressText: bob.address.text,
    amount: 500n,
    maxFee: 2_000n,
  });
  if (isWalletRejection(next)) {
    throw new Error(next.detail);
  }
  const downgrade = engine.sign({ walletId: 'alice', built: next, keyIds: ['alice.key.1'] });
  if (downgrade.ok !== false) {
    throw new Error('old classical key must not sign after hybrid activation');
  }
  const hybrid = engine.sign({ walletId: 'alice', built: next, keyIds: [rotated.nextKeyId] });
  if (hybrid.ok === false) {
    throw new Error(hybrid.detail);
  }
  const historic = engine.verifyHistoric(submitted.txId, alice.keys[0].publicKeyHex);
  if (!historic) {
    throw new Error('historical signatures must survive rotation');
  }
  return {
    startedSuite: CLASSICAL_WALLET_SUITE,
    endedSuite: HYBRID_WALLET_SUITE,
    historicStillVerifies: true,
    downgradeRejected: true,
  };
}

export function runMachineMandateDemo(): { readonly bypassRejected: true } {
  const machines = new MachineEconomyEngine(developmentPorts());
  machines.creditDevelopmentUnits('robot_1', 'MOONREY_COIN', 1_000_000n);
  machines.register({
    machineId: 'robot_1',
    machineType: 'ROBOT',
    ownerActor: 'owner',
    controllerActor: 'controller',
    hardwareIdentityRef: 'hw',
    softwareModelRef: 'sw',
    firmwareHash: 'fw',
    modelHash: 'md',
    jurisdiction: 'SIM-DEV',
    seedLabel: 'robot_1',
  });
  machines.grantCapabilities({
    machineId: 'robot_1',
    controllerActor: 'controller',
    capabilities: ['PURCHASE_SERVICE'],
  });
  machines.setSpendingMandate({
    machineId: 'robot_1',
    controllerActor: 'controller',
    mandateId: 'spend_robot',
    allowedAssetIds: ['MOONREY_COIN'],
    maxPerTransaction: 100n,
    maxPerEpoch: 200n,
    maxOutstandingCommitments: 100n,
    approvedCounterpartyClasses: ['MACHINE'],
    approvedServiceCategories: ['ROBOT_LABOR'],
    purposeConstraints: ['bounded_purchase'],
    expiresAtUtc: '2027-01-01T00:00:00.000Z',
    controllerApprovalThreshold: 'AUTO_WITHIN_MANDATE',
  });
  const engine = new WalletEngine({ machines });
  engine.unlock('development-passphrase');
  engine.createWallet({
    walletId: 'robot',
    ownerActorId: 'robot_1',
    walletType: 'MACHINE',
    accountType: 'MACHINE_ACCOUNT',
    signerLabels: ['robot'],
  });
  engine.createWallet({ walletId: 'shop', ownerActorId: 'shop', walletType: 'HUMAN', signerLabels: ['shop'] });
  const robot = engine.getAccount('bca.robot');
  const shop = engine.getAccount('bca.shop');
  if (!robot || !shop) {
    throw new Error('machine accounts missing');
  }
  engine.faucet(robot.accountId, 1_000_000n);
  const bypass = engine.buildTransfer({
    walletId: 'robot',
    toAccountId: shop.accountId,
    toAddressText: shop.address.text,
    amount: 50_000n,
    maxFee: 2_000n,
    purpose: 'bounded_purchase',
  });
  if (!isWalletRejection(bypass) || bypass.code !== 'MACHINE_MANDATE_BYPASS') {
    throw new Error('machine mandate must not be bypassed');
  }
  return { bypassRejected: true };
}
