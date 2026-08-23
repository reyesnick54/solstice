import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  createWalletProductSandbox,
  provisionSandboxOwner,
  runWalletSandboxScenario,
  WALLET_SANDBOX_SCENARIOS,
} from './sandbox.ts';
import { feeChangedMaterially } from './fees.ts';
import { mapExternalFinality, mapNativeFinality } from './finality.ts';
import { signingBoundarySnapshot } from './keys.ts';
import { validateAddressBinding } from './addresses.ts';

function owner(label: string) {
  const sandbox = createWalletProductSandbox();
  provisionSandboxOwner(sandbox, label);
  return { sandbox, ownerId: label, actor: sandbox.actor(label) };
}

describe('wallet product — model and ownership', () => {
  it('provisions a native wallet with client-safe fields and no signing material', () => {
    const { sandbox, ownerId } = owner('cust_model');
    const created = sandbox.product.provisionWallet({
      walletId: 'wal_model_sunrey',
      ownerId,
      assetId: 'SUNREY_COIN',
      custodyModel: 'SUNREY_NATIVE',
      seedMinorUnits: 2_000_000n,
    });
    assert.equal(created.ok, true);
    if (!created.ok) {
      throw new Error('expected wallet provision to succeed');
    }
    assert.equal(created.value.schema, 'sunrey.consumer.wallet.v1');
    assert.equal(created.value.status, 'ACTIVE');
    assert.equal(created.value.withdrawalEnabled, true);
    assert.equal(created.value.balance.availableMinorUnits, '2000000');
    assert.equal(created.value.balance.providerBalanceIsTruth, false);
    assert.equal(created.value.balance.blendedReturn, null);
    assert.equal(created.value.productionSigningAuthorized, false);
    assert.equal('privateKey' in created.value, false);
    const listed = sandbox.product.listWallets(ownerId);
    assert.equal(listed.length, 1);
    const denied = sandbox.product.getWallet('cust_other', 'wal_model_sunrey');
    assert.equal(denied.ok, false);
    if (denied.ok) {
      throw new Error('cross-user read should fail');
    }
    assert.equal(denied.code, 'RESOURCE_NOT_OWNED');
  });

  it('keeps withdrawal capability independent of wallet status', () => {
    const { sandbox, ownerId } = owner('cust_status');
    sandbox.product.provisionWallet({
      walletId: 'wal_status',
      ownerId,
      assetId: 'SUNREY_COIN',
      custodyModel: 'SUNREY_NATIVE',
    });
    const restricted = sandbox.product.setWalletStatus(ownerId, 'wal_status', 'RESTRICTED');
    assert.equal(restricted.ok, true);
    if (!restricted.ok) {
      throw new Error('expected success');
    }
    assert.equal(restricted.value.status, 'RESTRICTED');
    assert.equal(restricted.value.withdrawalEnabled, false);
    const frozen = sandbox.product.setWalletStatus(ownerId, 'wal_status', 'ACTIVE', false);
    assert.equal(frozen.ok, true);
    if (!frozen.ok) {
      throw new Error('expected success');
    }
    assert.equal(frozen.value.status, 'ACTIVE');
    assert.equal(frozen.value.withdrawalEnabled, false);
  });

  it('refuses INTERNAL_OPERATIONAL without approval', () => {
    const { sandbox, ownerId } = owner('cust_ops');
    const refused = sandbox.product.provisionWallet({
      ownerId,
      assetId: 'SUNREY_COIN',
      custodyModel: 'INTERNAL_OPERATIONAL',
    });
    assert.equal(refused.ok, false);
    const approved = sandbox.product.provisionWallet({
      ownerId,
      assetId: 'SUNREY_COIN',
      custodyModel: 'INTERNAL_OPERATIONAL',
      operationalApproved: true,
    });
    assert.equal(approved.ok, true);
    if (!approved.ok) {
      throw new Error('expected success');
    }
    assert.equal(approved.value.withdrawalEnabled, false);
  });
});

describe('wallet product — address and key boundary', () => {
  it('binds deposit addresses to the correct network and asset', () => {
    const { sandbox, ownerId } = owner('cust_addr');
    sandbox.product.provisionWallet({
      walletId: 'wal_addr_sun',
      ownerId,
      assetId: 'SUNREY_COIN',
      custodyModel: 'SUNREY_NATIVE',
    });
    sandbox.product.provisionWallet({
      walletId: 'wal_addr_moon',
      ownerId,
      assetId: 'MOONREY_COIN',
      custodyModel: 'SUNREY_NATIVE',
    });
    const sun = sandbox.product.depositAddress(ownerId, 'wal_addr_sun');
    const moon = sandbox.product.depositAddress(ownerId, 'wal_addr_moon');
    assert.equal(sun.ok, true);
    assert.equal(moon.ok, true);
    if (!sun.ok || !moon.ok) {
      throw new Error('address assign failed');
    }
    assert.equal(sun.value.address.startsWith('sr1'), true);
    assert.equal(moon.value.address.startsWith('mr1'), true);
    assert.equal(sun.value.assetId, 'SUNREY_COIN');
    assert.equal(moon.value.assetId, 'MOONREY_COIN');
    const mismatch = validateAddressBinding({
      address: sun.value.address,
      networkId: 'EXTERNAL_ETHEREUM',
      assetId: 'SUNREY_COIN',
    });
    assert.equal('ok' in mismatch && mismatch.ok === false, true);
  });

  it('never returns signing material to frontend or agent', () => {
    const { sandbox } = owner('cust_keys');
    const frontend = sandbox.product.signingMaterial('FRONTEND');
    const agent = sandbox.product.signingMaterial('AGENT');
    assert.equal(frontend.ok, false);
    assert.equal(agent.ok, false);
    assert.equal(sandbox.product.productionSigning().productionSigningAuthorized, false);
    const snapshot = signingBoundarySnapshot();
    assert.equal(snapshot.frontendReceivesKeys, false);
    assert.equal(snapshot.agentReceivesKeys, false);
    assert.equal(snapshot.productionSigningAuthorized, false);
  });
});

describe('wallet product — deposit finality', () => {
  it('does not mark a deposit final before BFT finality', () => {
    const { sandbox, ownerId, actor } = owner('cust_dep');
    sandbox.product.provisionWallet({
      walletId: 'wal_dep',
      ownerId,
      assetId: 'SUNREY_COIN',
      custodyModel: 'SUNREY_NATIVE',
    });
    const pending = sandbox.product.ingestDeposit({
      ownerId,
      walletId: 'wal_dep',
      amountMinorUnits: 1_000_000n,
      txRef: 'tx_pending',
      confirmations: 0,
      nativeFinality: 'MEMPOOL',
      actorId: actor.actorId,
    });
    assert.equal(pending.ok, true);
    if (!pending.ok) {
      throw new Error('expected success');
    }
    assert.equal(pending.value.finality, 'BROADCAST');
    const before = sandbox.product.getWallet(ownerId, 'wal_dep');
    assert.equal(before.ok, true);
    if (!before.ok) {
      throw new Error('expected success');
    }
    assert.equal(before.value.balance.availableMinorUnits, '0');
    const final = sandbox.product.ingestDeposit({
      ownerId,
      walletId: 'wal_dep',
      amountMinorUnits: 1_000_000n,
      txRef: 'tx_final',
      confirmations: 6,
      nativeFinality: 'BFT_FINALIZED',
      actorId: actor.actorId,
    });
    assert.equal(final.ok, true);
    if (!final.ok) {
      throw new Error('expected success');
    }
    assert.equal(final.value.finality, 'FINALIZED');
    const after = sandbox.product.getWallet(ownerId, 'wal_dep');
    assert.equal(after.ok, true);
    if (!after.ok) {
      throw new Error('expected success');
    }
    assert.equal(after.value.balance.availableMinorUnits, '1000000');
  });

  it('deduplicates the same deposit event', () => {
    const { sandbox, ownerId, actor } = owner('cust_dup');
    sandbox.product.provisionWallet({
      walletId: 'wal_dup',
      ownerId,
      assetId: 'SUNREY_COIN',
      custodyModel: 'SUNREY_NATIVE',
    });
    const first = sandbox.product.ingestDeposit({
      ownerId,
      walletId: 'wal_dup',
      amountMinorUnits: 500_000n,
      txRef: 'tx_dup',
      confirmations: 6,
      nativeFinality: 'BFT_FINALIZED',
      actorId: actor.actorId,
    });
    const second = sandbox.product.ingestDeposit({
      ownerId,
      walletId: 'wal_dup',
      amountMinorUnits: 500_000n,
      txRef: 'tx_dup',
      confirmations: 6,
      nativeFinality: 'BFT_FINALIZED',
      actorId: actor.actorId,
    });
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (!first.ok || !second.ok) {
      throw new Error('duplicate ingest failed');
    }
    assert.equal(first.value.transactionId, second.value.transactionId);
    const wallet = sandbox.product.getWallet(ownerId, 'wal_dup');
    assert.equal(wallet.ok, true);
    if (!wallet.ok) {
      throw new Error('expected success');
    }
    assert.equal(wallet.value.balance.availableMinorUnits, '500000');
  });
});

describe('wallet product — withdrawal proposal and execution', () => {
  it('quotes a withdrawal and executes only after step-up, validation, analytics, and Kernel', () => {
    const { sandbox, ownerId, actor } = owner('cust_wd');
    sandbox.product.provisionWallet({
      walletId: 'wal_wd',
      ownerId,
      assetId: 'SUNREY_COIN',
      custodyModel: 'SUNREY_NATIVE',
      seedMinorUnits: 3_000_000n,
    });
    const privileged = sandbox.product.quoteWithdrawal(
      ownerId,
      'wal_wd',
      { destination: 'sr1peerxxxxxxxx', amountMinorUnits: '100000', signingKey: 'hex' },
      actor,
    );
    assert.equal(privileged.ok, false);
    const quoted = sandbox.product.quoteWithdrawal(
      ownerId,
      'wal_wd',
      { destination: 'sr1peerxxxxxxxx', amountMinorUnits: '100000' },
      actor,
    );
    assert.equal(quoted.ok, true);
    if (!quoted.ok) {
      throw new Error('expected success');
    }
    assert.equal(quoted.value.estimate, true);
    assert.equal(quoted.value.fees.estimate, true);
    const noStepUp = sandbox.product.createWithdrawal(
      ownerId,
      'wal_wd',
      { quoteId: quoted.value.quoteId },
      { ...actor, stepUpSatisfied: false },
    );
    assert.equal(noStepUp.ok, false);
    if (noStepUp.ok) {
      throw new Error('step-up bypass');
    }
    assert.equal(noStepUp.code, 'STEP_UP_REQUIRED');
    const executed = sandbox.product.createWithdrawal(ownerId, 'wal_wd', { quoteId: quoted.value.quoteId }, actor);
    assert.equal(executed.ok, true);
    if (!executed.ok) {
      throw new Error('expected success');
    }
    assert.equal(executed.value.finality, 'FINALIZED');
    assert.equal(executed.value.productionSigningAuthorized, false);
    const fetched = sandbox.product.getWithdrawal(ownerId, 'wal_wd', executed.value.withdrawalId);
    assert.equal(fetched.ok, true);
  });

  it('rejects a wrong-network destination before signing', () => {
    const { sandbox, ownerId, actor } = owner('cust_net');
    sandbox.product.provisionWallet({
      walletId: 'wal_net',
      ownerId,
      assetId: 'SUNREY_COIN',
      custodyModel: 'SUNREY_NATIVE',
      seedMinorUnits: 1_000_000n,
    });
    const result = sandbox.product.createWithdrawal(
      ownerId,
      'wal_net',
      { destination: '0xabc1230000000000000000000000000000000000', amountMinorUnits: '1000', networkId: 'SUNREY_CHAIN' },
      actor,
    );
    assert.equal(result.ok, false);
    if (result.ok) {
      throw new Error('wrong network accepted');
    }
    assert.equal(result.code === 'INVALID_ADDRESS_FORMAT' || result.code === 'ADDRESS_NETWORK_MISMATCH', true);
  });

  it('lets an Agent create a proposal but not sign or broadcast', () => {
    const { sandbox, ownerId, actor } = owner('cust_agent');
    sandbox.product.provisionWallet({
      walletId: 'wal_agent',
      ownerId,
      assetId: 'SUNREY_COIN',
      custodyModel: 'SUNREY_NATIVE',
      seedMinorUnits: 1_000_000n,
    });
    const proposal = sandbox.product.createWithdrawal(
      ownerId,
      'wal_agent',
      { destination: 'sr1peerxxxxxxxx', amountMinorUnits: '100000' },
      { ...actor, originatedFromAgent: true },
    );
    assert.equal(proposal.ok, true);
    if (!proposal.ok) {
      throw new Error('expected success');
    }
    assert.equal(proposal.value.status, 'PROPOSED');
    assert.equal(proposal.value.originatedFromAgent, true);
    assert.equal(proposal.value.finality, 'PENDING');
    assert.equal(proposal.value.txRef, null);
    const restrictions = sandbox.product.agentRestrictions();
    assert.equal(restrictions.mayCreateWithdrawalProposal, true);
    assert.equal(restrictions.maySign, false);
    assert.equal(restrictions.mayBroadcast, false);
    assert.equal(restrictions.mayBypassStepUp, false);
    assert.equal(restrictions.mayBypassCompliance, false);
  });
});

describe('wallet product — analytics, Travel Rule, fees, reconciliation', () => {
  it('feeds blockchain analytics into risk without making it authorization', () => {
    const { sandbox, ownerId, actor } = owner('cust_ba');
    sandbox.product.provisionWallet({
      walletId: 'wal_ba',
      ownerId,
      assetId: 'SUNREY_COIN',
      custodyModel: 'SUNREY_NATIVE',
      seedMinorUnits: 1_000_000n,
    });
    const quoted = sandbox.product.quoteWithdrawal(
      ownerId,
      'wal_ba',
      { destination: 'sr1mixerdestxxxxxxxx', amountMinorUnits: '100000' },
      actor,
    );
    assert.equal(quoted.ok, true);
    if (!quoted.ok) {
      throw new Error('expected success');
    }
    assert.equal(quoted.value.risk, 'REVIEW');
    assert.equal(quoted.value.requiredApproval, 'MANUAL_REVIEW');
  });

  it('exposes customer-safe Travel Rule state without counterparty PII', () => {
    const { sandbox, ownerId, actor } = owner('cust_tr');
    sandbox.product.provisionWallet({
      walletId: 'wal_tr',
      ownerId,
      assetId: 'SUNREY_COIN',
      custodyModel: 'SUNREY_NATIVE',
      seedMinorUnits: 3_000_000n,
    });
    const quoted = sandbox.product.quoteWithdrawal(
      ownerId,
      'wal_tr',
      { destination: 'sr1vaspcounterpartyxx', amountMinorUnits: '2000000' },
      actor,
    );
    assert.equal(quoted.ok, true);
    if (!quoted.ok) {
      throw new Error('expected success');
    }
    assert.equal(quoted.value.travelRuleRequired, true);
    assert.equal(quoted.value.travelRule, 'ADDITIONAL_INFORMATION_REQUIRED');
    const serialized = JSON.stringify(quoted.value);
    assert.equal(serialized.includes('Simulation Counterparty VASP'), false);
    assert.equal(serialized.includes('vasp_'), false);
  });

  it('marks fee lines as estimates and revalidates material changes', () => {
    assert.equal(feeChangedMaterially(100n, 130n), true);
    assert.equal(feeChangedMaterially(100n, 105n), false);
    assert.equal(mapNativeFinality({ native: 'BFT_FINALIZED', confirmations: 1 }), 'FINALIZED');
    assert.equal(mapExternalFinality({ confirmations: 1, requiredConfirmations: 6, broadcast: true }), 'CONFIRMING');
  });

  it('records reconciliation breaks and does not silently correct', () => {
    const sandbox = createWalletProductSandbox({ exchangeMismatch: true });
    provisionSandboxOwner(sandbox, 'cust_recon');
    sandbox.product.provisionWallet({
      walletId: 'wal_recon',
      ownerId: 'cust_recon',
      assetId: 'SUNREY_COIN',
      custodyModel: 'SUNREY_NATIVE',
      seedMinorUnits: 1_000_000n,
    });
    const broken = sandbox.product.reconcileWallet('cust_recon', 'wal_recon');
    assert.equal(broken.ok, true);
    if (!broken.ok) {
      throw new Error('expected success');
    }
    assert.equal(broken.value.length > 0, true);
    for (const row of broken.value) {
      assert.equal(row.autoCorrected, false);
    }
  });
});

describe('wallet product — sandbox scenarios', () => {
  it('runs every deterministic wallet scenario', () => {
    for (const scenario of WALLET_SANDBOX_SCENARIOS) {
      const result = runWalletSandboxScenario(scenario);
      assert.equal(result.ok, true, `${scenario}: ${result.ok ? '' : result.code + ' ' + result.message}`);
    }
  });
});
