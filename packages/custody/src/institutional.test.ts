import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SUITE_SUNREY_ED25519_V1, SUITE_SUNREY_MLDSA_65_V1 } from '../../security/src/crypto-suite.ts';
import { createDevelopmentHsmSimulator } from '../../security/src/hsm-simulator.ts';
import { MpcSigningPort } from './institutional/signing.ts';
import {
  createColdSigner,
  createInstitutionalHarness,
  provisionInstitutionalActor,
} from './institutional/harness.ts';
import { runCustodyCommand } from './institutional/cli.ts';

function dualVault(h: ReturnType<typeof createInstitutionalHarness>) {
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
  return { opsA, opsB, vault: vault.value, wallet: wallet.value };
}

function approvedDestination(
  h: ReturnType<typeof createInstitutionalHarness>,
  vaultId: ReturnType<typeof dualVault>['vault']['vaultId'],
  actorId: string,
  address = 'sr1_clear_counterparty',
) {
  const destination = h.custody.registerDestination({
    actorKind: 'HUMAN_OPERATOR',
    actorId,
    vaultId,
    address,
    label: 'test dest',
  });
  if (destination.outcome !== 'OK') {
    throw new Error('dest');
  }
  const verified = h.custody.verifyDestination({
    actorKind: 'HUMAN_OPERATOR',
    actorId,
    destinationId: destination.value.destinationId,
    status: 'APPROVED',
  });
  if (verified.outcome !== 'OK') {
    throw new Error('verify');
  }
  return verified.value;
}

describe('institutional native-asset custody', () => {
  it('rejects HSM private extraction, wrong purpose, and wrong CryptoSuite', () => {
    const hsm = createDevelopmentHsmSimulator();
    assert.equal(typeof (hsm as { extractPrivateKey?: unknown }).extractPrivateKey, 'undefined');
    const generated = hsm.generateKey({ purpose: 'WALLET_SIGNING', suiteId: SUITE_SUNREY_ED25519_V1 });
    if (generated.ok !== true) {
      throw new Error('generate failed');
    }
    const consensus = hsm.generateKey({
      purpose: 'VALIDATOR_CONSENSUS_SIGNING',
      suiteId: SUITE_SUNREY_ED25519_V1,
    });
    assert.equal(consensus.ok, false);
    const signed = hsm.signCanonicalDigest({
      handle: generated.value,
      digest: Buffer.alloc(32, 1),
      purpose: 'WALLET_SIGNING',
      suiteId: SUITE_SUNREY_MLDSA_65_V1,
    });
    assert.equal(signed.ok, false);
    const mpc = new MpcSigningPort();
    assert.equal(mpc.implementationState, 'PORT_ONLY');
    assert.equal(mpc.sign().ok, false);
  });

  it('requires dual control and rejects an unapproved destination or over-limit withdrawal', () => {
    const h = createInstitutionalHarness();
    const { opsA, opsB, vault, wallet } = dualVault(h);
    h.custody.fundDevelopment(wallet.address, 200_000n);
    h.custody.recognizeFinalizedDeposits();
    const pending = h.custody.registerDestination({
      actorKind: 'HUMAN_OPERATOR',
      actorId: opsA.actor.actorId,
      vaultId: vault.vaultId,
      address: 'sr1_not_approved',
      label: 'pending',
    });
    if (pending.outcome !== 'OK') {
      throw new Error('pending');
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
    assert.equal(unapproved.outcome, 'REJECTED');
    if (unapproved.outcome !== 'REJECTED') {
      throw new Error('unapproved');
    }
    assert.equal(unapproved.code, 'UNAPPROVED_DESTINATION');

    const destination = approvedDestination(h, vault.vaultId, opsA.actor.actorId);
    const over = h.custody.requestWithdrawal({
      actorId: opsA.actor.actorId,
      actorKind: 'HUMAN_OPERATOR',
      customerId: opsA.customer.id,
      vaultId: vault.vaultId,
      walletId: wallet.walletId,
      destinationId: destination.destinationId,
      quantity: 2_000_000n,
    });
    assert.equal(over.outcome, 'REJECTED');

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
    if (one.outcome !== 'OK') {
      throw new Error('one');
    }
    assert.equal(one.value.state, 'AWAITING_APPROVAL');
    const simulatedEarly = h.custody.simulateWithdrawal(requested.value.withdrawalId);
    assert.equal(simulatedEarly.outcome, 'REJECTED');
    const two = h.custody.approveWithdrawal({
      actorId: opsB.actor.actorId,
      actorKind: 'HUMAN_OPERATOR',
      withdrawalId: requested.value.withdrawalId,
      decision: 'APPROVE',
    });
    if (two.outcome !== 'OK') {
      throw new Error('two');
    }
    assert.equal(two.value.state, 'APPROVED');
  });

  it('rejects an altered transaction after approval and a mempool-only deposit', () => {
    const h = createInstitutionalHarness();
    const { opsA, opsB, vault, wallet } = dualVault(h);
    h.custody.fundDevelopment(wallet.address, 50_000n);
    assert.equal(h.custody.listDeposits().length, 0);
    const recognized = h.custody.recognizeFinalizedDeposits();
    assert.equal(recognized.length, 1);
    const destination = approvedDestination(h, vault.vaultId, opsA.actor.actorId);
    const requested = h.custody.requestWithdrawal({
      actorId: opsA.actor.actorId,
      actorKind: 'HUMAN_OPERATOR',
      customerId: opsA.customer.id,
      vaultId: vault.vaultId,
      walletId: wallet.walletId,
      destinationId: destination.destinationId,
      quantity: 1_000n,
    });
    if (requested.outcome !== 'OK') {
      throw new Error('req');
    }
    h.custody.approveWithdrawal({
      actorId: opsA.actor.actorId,
      actorKind: 'HUMAN_OPERATOR',
      withdrawalId: requested.value.withdrawalId,
      decision: 'APPROVE',
    });
    h.custody.approveWithdrawal({
      actorId: opsB.actor.actorId,
      actorKind: 'HUMAN_OPERATOR',
      withdrawalId: requested.value.withdrawalId,
      decision: 'APPROVE',
    });
    h.custody.simulateWithdrawal(requested.value.withdrawalId);
    const altered = h.custody.rejectAlteredPreview(requested.value.withdrawalId, '00'.repeat(16));
    assert.equal(altered.outcome, 'REJECTED');
    if (altered.outcome !== 'REJECTED') {
      throw new Error('altered');
    }
    assert.equal(altered.code, 'ALTERED_TRANSACTION');
  });

  it('records one economic withdrawal under submission ambiguity', () => {
    const h = createInstitutionalHarness({ unknownNext: true });
    const { opsA, opsB, vault, wallet } = dualVault(h);
    h.custody.fundDevelopment(wallet.address, 40_000n);
    h.custody.recognizeFinalizedDeposits();
    const destination = approvedDestination(h, vault.vaultId, opsA.actor.actorId);
    const requested = h.custody.requestWithdrawal({
      actorId: opsA.actor.actorId,
      actorKind: 'HUMAN_OPERATOR',
      customerId: opsA.customer.id,
      vaultId: vault.vaultId,
      walletId: wallet.walletId,
      destinationId: destination.destinationId,
      quantity: 2_000n,
    });
    if (requested.outcome !== 'OK') {
      throw new Error('req');
    }
    h.custody.approveWithdrawal({
      actorId: opsA.actor.actorId,
      actorKind: 'HUMAN_OPERATOR',
      withdrawalId: requested.value.withdrawalId,
      decision: 'APPROVE',
    });
    h.custody.approveWithdrawal({
      actorId: opsB.actor.actorId,
      actorKind: 'HUMAN_OPERATOR',
      withdrawalId: requested.value.withdrawalId,
      decision: 'APPROVE',
    });
    h.custody.simulateWithdrawal(requested.value.withdrawalId);
    const unknown = h.custody.signAndSubmitWithdrawal({
      actorKind: 'HUMAN_OPERATOR',
      withdrawalId: requested.value.withdrawalId,
    });
    if (unknown.outcome !== 'OK') {
      throw new Error('unknown');
    }
    assert.equal(unknown.value.state, 'SUBMISSION_UNKNOWN');
    assert.equal(unknown.value.submittedOnce, true);
    const again = h.custody.signAndSubmitWithdrawal({
      actorKind: 'HUMAN_OPERATOR',
      withdrawalId: requested.value.withdrawalId,
    });
    assert.equal(again.outcome, 'REJECTED');
    if (again.outcome !== 'REJECTED') {
      throw new Error('again');
    }
    assert.equal(again.code, 'NO_BLIND_RESUBMIT');
    h.custody.queryUnknownWithdrawal(requested.value.withdrawalId);
    h.custody.finalizeBlock();
    const recovered = h.custody.recognizeFinality(requested.value.withdrawalId);
    if (recovered.outcome !== 'OK') {
      throw new Error('recovered');
    }
    assert.equal(recovered.value.state, 'FINALIZED');
  });

  it('binds cold signatures to approved bytes and refuses compromised or AI actors', () => {
    const h = createInstitutionalHarness({ offlineCold: true });
    const { opsA, opsB, vault, wallet } = dualVault(h);
    h.custody.fundDevelopment(wallet.address, 70_000n);
    h.custody.recognizeFinalizedDeposits();
    const destination = approvedDestination(h, vault.vaultId, opsA.actor.actorId);
    const requested = h.custody.requestWithdrawal({
      actorId: opsA.actor.actorId,
      actorKind: 'HUMAN_OPERATOR',
      customerId: opsA.customer.id,
      vaultId: vault.vaultId,
      walletId: wallet.walletId,
      destinationId: destination.destinationId,
      quantity: 3_000n,
    });
    if (requested.outcome !== 'OK') {
      throw new Error('req');
    }
    h.custody.approveWithdrawal({
      actorId: opsA.actor.actorId,
      actorKind: 'HUMAN_OPERATOR',
      withdrawalId: requested.value.withdrawalId,
      decision: 'APPROVE',
    });
    h.custody.approveWithdrawal({
      actorId: opsB.actor.actorId,
      actorKind: 'HUMAN_OPERATOR',
      withdrawalId: requested.value.withdrawalId,
      decision: 'APPROVE',
    });
    h.custody.simulateWithdrawal(requested.value.withdrawalId);
    const exported = h.custody.exportColdPackage(requested.value.withdrawalId);
    if (exported.outcome !== 'OK') {
      throw new Error('export');
    }
    const aiApprove = h.custody.approveWithdrawal({
      actorId: opsA.actor.actorId,
      actorKind: 'AI',
      withdrawalId: requested.value.withdrawalId,
      decision: 'APPROVE',
    });
    assert.equal(aiApprove.outcome, 'REJECTED');
    const aiHalt = h.custody.setSecurityControl({
      kind: 'SIGNING_HALT',
      active: true,
      actorId: 'model',
      actorKind: 'AI',
    });
    assert.equal(aiHalt.outcome, 'REJECTED');
    if (aiHalt.outcome !== 'REJECTED') {
      throw new Error('ai halt');
    }
    assert.equal(aiHalt.code, 'AI_CANNOT_CHANGE_CONTROLS');

    const cold = createColdSigner(h);
    const imported = h.custody.importColdSignature({
      actorKind: 'HUMAN_OPERATOR',
      withdrawalId: requested.value.withdrawalId,
      pack: exported.value,
      imported: {
        signedCanonicalHex: 'ff'.repeat(8),
        signerPublicKeyHex: 'x',
        suiteId: SUITE_SUNREY_ED25519_V1,
        signatureHex: '',
      },
      isolatedSigner: { sign: (request) => cold.signIsolated(request) },
    });
    assert.equal(imported.outcome, 'REJECTED');
    if (imported.outcome !== 'REJECTED') {
      throw new Error('altered cold');
    }
    assert.equal(imported.code, 'ALTERED_TRANSACTION');

    const good = h.custody.importColdSignature({
      actorKind: 'HUMAN_OPERATOR',
      withdrawalId: requested.value.withdrawalId,
      pack: exported.value,
      imported: {
        signedCanonicalHex: exported.value.unsignedCanonicalHex,
        signerPublicKeyHex: 'isolated',
        suiteId: SUITE_SUNREY_ED25519_V1,
        signatureHex: '',
      },
      isolatedSigner: { sign: (request) => cold.signIsolated(request) },
    });
    assert.equal(good.outcome, 'OK');

    const second = h.custody.requestWithdrawal({
      actorId: opsA.actor.actorId,
      actorKind: 'HUMAN_OPERATOR',
      customerId: opsA.customer.id,
      vaultId: vault.vaultId,
      walletId: wallet.walletId,
      destinationId: destination.destinationId,
      quantity: 1_000n,
    });
    if (second.outcome !== 'OK') {
      throw new Error('second');
    }
    h.custody.approveWithdrawal({
      actorId: opsA.actor.actorId,
      actorKind: 'HUMAN_OPERATOR',
      withdrawalId: second.value.withdrawalId,
      decision: 'APPROVE',
    });
    h.custody.approveWithdrawal({
      actorId: opsB.actor.actorId,
      actorKind: 'HUMAN_OPERATOR',
      withdrawalId: second.value.withdrawalId,
      decision: 'APPROVE',
    });
    h.custody.simulateWithdrawal(second.value.withdrawalId);
    const compromised = h.custody.reportCompromise({
      actorKind: 'HUMAN_SECURITY',
      vaultId: vault.vaultId,
      walletId: wallet.walletId,
    });
    assert.equal(compromised.outcome, 'OK');
    const after = h.custody.signAndSubmitWithdrawal({
      actorKind: 'HUMAN_OPERATOR',
      withdrawalId: second.value.withdrawalId,
    });
    assert.equal(after.outcome, 'REJECTED');
    if (after.outcome !== 'REJECTED') {
      throw new Error('compromised sign');
    }
    assert.equal(after.code, 'KEY_COMPROMISED');
  });

  it('never auto-adjusts on-chain holdings during reconciliation and exposes the exchange port', () => {
    const h = createInstitutionalHarness();
    const { opsA, vault, wallet } = dualVault(h);
    h.custody.fundDevelopment(wallet.address, 12_000n);
    h.custody.recognizeFinalizedDeposits();
    const before = h.chain.holding(wallet.address, 'SUNREY_COIN');
    const recon = h.custody.reconcile();
    assert.equal(recon.outcome, 'MATCHED');
    assert.equal(recon.autoAdjustedOnChain, false);
    assert.equal(recon.autoCorrected, false);
    assert.equal(h.chain.holding(wallet.address, 'SUNREY_COIN'), before);
    assert.equal(h.custody.exchangeDepositAddress(vault.vaultId), wallet.address);
    const reserved = h.custody.reserveForExchange(vault.vaultId, 1_000n);
    assert.equal('reservationId' in reserved, true);
    assert.equal(h.custody.signSettlement().code, 'REQUIRES_CUSTODY_APPROVAL');
    const proposal = h.custody.proposeRebalance({
      fromVaultId: vault.vaultId,
      toVaultId: vault.vaultId,
      proposedBy: 'AI',
    });
    assert.equal(proposal.outcome, 'REJECTED');
    const recovery = h.custody.recoveryManifest(vault.vaultId);
    if (recovery.outcome !== 'OK') {
      throw new Error('recovery');
    }
    assert.equal(recovery.value.containsPlaintextSigningMaterial, false);
    const cli = runCustodyCommand(h.custody, ['signer', 'status'], {
      actorId: opsA.actor.actorId,
      actorKind: 'HUMAN_OPERATOR',
    });
    assert.equal(cli.ok, true);
    assert.match(cli.output, /REMOTE_SIGNER|LOCAL_DEVELOPMENT|HSM/);
  });
});
