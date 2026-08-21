import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { reconcileDigitalAssetPlanes } from '../packages/custody/src/provider-candidate/authority.ts';
import { runCustodyContractSuite } from '../packages/custody/src/provider-candidate/certification.ts';
import { createCustodyProviderA, createCustodyProviderB } from '../packages/custody/src/provider-candidate/sandbox.ts';
import {
  creditDepositAfterConfirmation,
  runDepositWorkflow,
  runWithdrawalWorkflow,
} from '../packages/custody/src/provider-candidate/workflows.ts';

describe('Phase D custody contract', () => {
  it('passes the custody certification suite', () => {
    const report = runCustodyContractSuite();
    assert.equal(report.outcome, 'CONTRACT_TEST_PASS');
    assert.equal(report.externalCertification, 'EXTERNAL_CERTIFICATION_REQUIRED');
    assert.equal(report.productionAuthorized, false);
  });

  it('keeps custody provider state off the fiat Ledger and AssetSupplyBook', () => {
    const adapter = createCustodyProviderA();
    adapter.createVault({ vaultId: 'v', label: 's' });
    adapter.createWallet({ vaultId: 'v', walletId: 'w', assetId: 'SUNREY_COIN', network: 'sim' });
    const balance = adapter.getBalance('w');
    assert.equal(balance.ok, true);
    if (!balance.ok) throw new Error('balance');
    assert.equal(balance.value.isFiatLedgerBalance, false);
    assert.equal(balance.value.isAssetSupplyBook, false);
    const planes = reconcileDigitalAssetPlanes({
      assetId: 'SUNREY_COIN',
      chainQuantity: 5n,
      custodyProviderQuantity: 4n,
      exchangeQuantity: 5n,
      customerReadModelQuantity: 5n,
    });
    assert.equal(planes.matched, false);
    assert.equal(planes.autoCorrectedLedger, false);
  });

  it('refuses unverified deposit credit and AI withdrawal bypass', () => {
    const unverified = runDepositWorkflow({
      depositRef: 'd',
      signatureVerified: false,
      networkFinalized: true,
      reorgSuspected: false,
      mappingKnown: true,
    });
    assert.equal(unverified.ok, false);
    const confirmed = runDepositWorkflow({
      depositRef: 'd2',
      signatureVerified: true,
      networkFinalized: true,
      reorgSuspected: false,
      mappingKnown: true,
    });
    assert.equal(confirmed.ok, true);
    if (!confirmed.ok) throw new Error('confirmed');
    const credited = creditDepositAfterConfirmation(confirmed.value);
    assert.equal(credited.ok, true);
    const adapter = createCustodyProviderB();
    adapter.createVault({ vaultId: 'v', label: 's' });
    adapter.createWallet({ vaultId: 'v', walletId: 'w', assetId: 'SUNREY_COIN', network: 'sim' });
    const ai = runWithdrawalWorkflow({
      withdrawalId: 'wd',
      authenticated: true,
      authorized: true,
      walletOwned: true,
      travelRuleSatisfied: true,
      riskCleared: true,
      stepUpApproved: true,
      executionAuthorityPresent: true,
      actorKind: 'AI_AGENT',
      adapter,
      walletId: 'w',
      destination: 'dest',
      assetId: 'SUNREY_COIN',
      quantity: 1n,
    });
    assert.equal(ai.ok, false);
  });
});
