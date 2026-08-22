/**
 * Custody provider certification suite. Engineering contract tests only.
 * Passing does not mark external certification complete.
 */

import { signFixtureCallback } from './callbacks.ts';
import { ingestCustodyWebhook, resetCustodyWebhooks } from './webhook-events.ts';
import { createCustodyProviderA, type DeterministicCustodyAdapter } from './sandbox.ts';
import { creditDepositAfterConfirmation, runDepositWorkflow, runWithdrawalWorkflow } from './workflows.ts';
import { reconcileDigitalAssetPlanes } from './authority.ts';

export type CustodyContractCase = {
  readonly id: string;
  readonly passed: boolean;
  readonly detail: string;
};

export type CustodyCertificationReport = {
  readonly adapterId: string;
  readonly contractTests: readonly CustodyContractCase[];
  readonly outcome: 'CONTRACT_TEST_PASS' | 'CONTRACT_TEST_FAIL';
  readonly externalCertification: 'EXTERNAL_CERTIFICATION_REQUIRED';
  readonly productionAuthorized: false;
};

function caseResult(id: string, passed: boolean, detail: string): CustodyContractCase {
  return Object.freeze({ id, passed, detail });
}

export function runCustodyContractSuite(adapter: DeterministicCustodyAdapter = createCustodyProviderA()): CustodyCertificationReport {
  resetCustodyWebhooks();
  adapter.setScenario('healthy');
  const cases: CustodyContractCase[] = [];

  const vault = adapter.createVault({ vaultId: 'vault_1', label: 'sandbox' });
  cases.push(caseResult('wallet_vault', vault.ok, vault.ok ? 'vault created' : vault.error.message));

  const wallet = adapter.createWallet({
    vaultId: 'vault_1',
    walletId: 'wal_1',
    assetId: 'SUNREY_COIN',
    network: 'sunrey-sim',
  });
  cases.push(caseResult('wallet_creation', wallet.ok, wallet.ok ? wallet.value.address : wallet.error.message));
  cases.push(caseResult('address', wallet.ok && wallet.value.address.includes(adapter.providerId), 'normalized address'));

  const deposit = adapter.simulateDeposit('wal_1', 100n, 'dep_1');
  cases.push(caseResult('deposit', deposit.ok && deposit.value.depositLifecycle === 'confirmed', 'simulated deposit'));

  const confirming = runDepositWorkflow({
    depositRef: 'dep_confirm',
    signatureVerified: true,
    networkFinalized: false,
    reorgSuspected: false,
    mappingKnown: true,
  });
  cases.push(
    caseResult(
      'confirmation',
      confirming.ok && confirming.value.lifecycle === 'confirming',
      'confirming before finality',
    ),
  );

  const confirmed = runDepositWorkflow({
    depositRef: 'dep_ok',
    signatureVerified: true,
    networkFinalized: true,
    reorgSuspected: false,
    mappingKnown: true,
  });
  const credited = confirmed.ok ? creditDepositAfterConfirmation(confirmed.value) : confirmed;
  cases.push(caseResult('credited', credited.ok && credited.value.creditedCustomerProduct, 'credit after confirmation'));

  const unverified = runDepositWorkflow({
    depositRef: 'dep_bad',
    signatureVerified: false,
    networkFinalized: true,
    reorgSuspected: false,
    mappingKnown: true,
  });
  cases.push(caseResult('unverified_callback', !unverified.ok, 'unverified callback does not credit'));

  adapter.setScenario('pending');
  const pending = adapter.createWithdrawal({
    withdrawalId: 'wd_pending',
    walletId: 'wal_1',
    destination: 'dest_1',
    assetId: 'SUNREY_COIN',
    quantity: 1n,
  });
  cases.push(caseResult('pending', pending.ok && pending.value.withdrawalLifecycle === 'pending', 'pending withdrawal'));

  adapter.setScenario('healthy');
  const workflow = runWithdrawalWorkflow({
    withdrawalId: 'wd_ok',
    authenticated: true,
    authorized: true,
    walletOwned: true,
    travelRuleSatisfied: true,
    riskCleared: true,
    stepUpApproved: true,
    executionAuthorityPresent: true,
    actorKind: 'HUMAN',
    adapter,
    walletId: 'wal_1',
    destination: 'dest_1',
    assetId: 'SUNREY_COIN',
    quantity: 10n,
  });
  cases.push(caseResult('withdrawal', workflow.ok && workflow.value.adapterInvoked, 'full withdrawal workflow'));

  const approved = adapter.approveWithdrawal('wd_ok');
  cases.push(caseResult('approval', approved.ok && approved.value.withdrawalLifecycle === 'finalized', 'approve/sign'));

  const ai = runWithdrawalWorkflow({
    withdrawalId: 'wd_ai',
    authenticated: true,
    authorized: true,
    walletOwned: true,
    travelRuleSatisfied: true,
    riskCleared: true,
    stepUpApproved: true,
    executionAuthorityPresent: true,
    actorKind: 'AI_AGENT',
    adapter,
    walletId: 'wal_1',
    destination: 'dest_1',
    assetId: 'SUNREY_COIN',
    quantity: 1n,
  });
  cases.push(caseResult('ai_bypass', !ai.ok, 'AI cannot bypass workflow'));

  adapter.setScenario('rejected');
  const rejected = adapter.createWithdrawal({
    withdrawalId: 'wd_rej',
    walletId: 'wal_1',
    destination: 'dest_1',
    assetId: 'SUNREY_COIN',
    quantity: 1n,
  });
  cases.push(caseResult('rejected', rejected.ok && rejected.value.withdrawalLifecycle === 'rejected', 'rejected'));

  adapter.setScenario('failed');
  const failed = adapter.createWithdrawal({
    withdrawalId: 'wd_fail',
    walletId: 'wal_1',
    destination: 'dest_1',
    assetId: 'SUNREY_COIN',
    quantity: 1n,
  });
  cases.push(caseResult('failed', failed.ok && failed.value.withdrawalLifecycle === 'failed', 'failed'));

  adapter.setScenario('unknown_transaction');
  const unknown = adapter.getTransaction('missing');
  cases.push(caseResult('unknown_transaction', !unknown.ok, 'unknown transaction fail-closed'));

  adapter.setScenario('healthy');
  const fee = adapter.getNetworkFee('SUNREY_COIN');
  cases.push(caseResult('fee', fee.ok && fee.value.quantity === 1n, 'network fee'));

  const planes = reconcileDigitalAssetPlanes({
    assetId: 'SUNREY_COIN',
    chainQuantity: 90n,
    custodyProviderQuantity: 90n,
    exchangeQuantity: 90n,
    customerReadModelQuantity: 90n,
  });
  cases.push(caseResult('reconciliation', planes.matched && planes.autoCorrectedLedger === false, 'authority planes'));

  const mismatch = reconcileDigitalAssetPlanes({
    assetId: 'SUNREY_COIN',
    chainQuantity: 90n,
    custodyProviderQuantity: 80n,
    exchangeQuantity: 90n,
    customerReadModelQuantity: 90n,
  });
  cases.push(caseResult('reconciliation_break', !mismatch.matched && mismatch.autoCorrectedLedger === false, 'break persists'));

  const material = 'deposit:wal_1:100';
  const firstHook = ingestCustodyWebhook({
    eventId: 'wh_1',
    kind: 'deposit',
    providerId: adapter.providerId,
    callback: {
      callbackId: 'cb_1',
      kind: 'DEPOSIT',
      assetId: 'SUNREY_COIN',
      quantity: 100n,
      destination: wallet.ok ? wallet.value.address : 'addr',
      transactionRef: 'dep_wh',
      material,
      signatureHex: signFixtureCallback(material, 'sandbox-custody'),
    },
    hmacSecret: 'sandbox-custody',
  });
  const replay = ingestCustodyWebhook({
    eventId: 'wh_1',
    kind: 'deposit',
    providerId: adapter.providerId,
    callback: {
      callbackId: 'cb_1',
      kind: 'DEPOSIT',
      assetId: 'SUNREY_COIN',
      quantity: 100n,
      destination: wallet.ok ? wallet.value.address : 'addr',
      transactionRef: 'dep_wh',
      material,
      signatureHex: signFixtureCallback(material, 'sandbox-custody'),
    },
    hmacSecret: 'sandbox-custody',
  });
  cases.push(caseResult('duplicate_webhook', firstHook.ok && !replay.ok, 'duplicate webhook rejected'));

  adapter.setScenario('wrong_environment');
  const env = adapter.createVault({ vaultId: 'prod', label: 'no' });
  cases.push(caseResult('environment_isolation', !env.ok, 'wrong environment fail-closed'));

  const passed = cases.every((row) => row.passed);
  return Object.freeze({
    adapterId: adapter.adapterId,
    contractTests: Object.freeze(cases),
    outcome: passed ? 'CONTRACT_TEST_PASS' : 'CONTRACT_TEST_FAIL',
    externalCertification: 'EXTERNAL_CERTIFICATION_REQUIRED',
    productionAuthorized: false,
  });
}
