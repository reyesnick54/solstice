import { SUITE_SUNREY_ED25519_V1 } from '../../security/src/crypto-suite.ts';
import { createColdSigner, createInstitutionalHarness, provisionInstitutionalActor } from './institutional/harness.ts';

const h = createInstitutionalHarness({ offlineCold: true });
const opsA = provisionInstitutionalActor(h, 'actor_cold_a', 'id_cold_a', 'cust_cold');
const opsB = provisionInstitutionalActor(h, 'actor_cold_b', 'id_cold_b', 'cust_cold');
const cold = createColdSigner(h);

const vault = h.custody.createVault({
  actorKind: 'HUMAN_OPERATOR',
  custodyType: 'TREASURY',
  securityTier: 'COLD',
  approvalMode: 'DUAL_CONTROL',
  authorizedApproverIds: [opsA.actor.actorId, opsB.actor.actorId],
  classifications: ['SEGREGATED', 'COLD', 'TREASURY'],
  providerKind: 'OFFLINE_COLD',
});
if (vault.outcome !== 'OK') {
  throw new Error('vault failed');
}
const wallet = h.custody.createAddress({
  actorKind: 'HUMAN_OPERATOR',
  vaultId: vault.value.vaultId,
  classifications: ['SEGREGATED', 'COLD', 'TREASURY'],
});
if (wallet.outcome !== 'OK') {
  throw new Error('wallet failed');
}
h.custody.fundDevelopment(wallet.value.address, 900_000n);
h.custody.recognizeFinalizedDeposits();
const destination = h.custody.registerDestination({
  actorKind: 'HUMAN_OPERATOR',
  actorId: opsA.actor.actorId,
  vaultId: vault.value.vaultId,
  address: 'sr1_cold_counterparty',
  label: 'cold beneficiary',
});
if (destination.outcome !== 'OK') {
  throw new Error('destination failed');
}
h.custody.verifyDestination({
  actorKind: 'HUMAN_OPERATOR',
  actorId: opsA.actor.actorId,
  destinationId: destination.value.destinationId,
  status: 'APPROVED',
});
const requested = h.custody.requestWithdrawal({
  actorId: opsA.actor.actorId,
  actorKind: 'HUMAN_OPERATOR',
  customerId: opsA.customer.id,
  vaultId: vault.value.vaultId,
  walletId: wallet.value.walletId,
  destinationId: destination.value.destinationId,
  quantity: 25_000n,
});
if (requested.outcome !== 'OK') {
  throw new Error('request failed');
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
  throw new Error('cold export failed');
}
const online = h.custody.signAndSubmitWithdrawal({
  actorKind: 'HUMAN_OPERATOR',
  withdrawalId: requested.value.withdrawalId,
});
if (online.outcome === 'OK') {
  throw new Error('online sign must not be used for the cold path in this demo setup');
}
const imported = h.custody.importColdSignature({
  actorKind: 'HUMAN_OPERATOR',
  withdrawalId: requested.value.withdrawalId,
  pack: exported.value,
  imported: {
    signedCanonicalHex: exported.value.unsignedCanonicalHex,
    signerPublicKeyHex: 'isolated-cold',
    suiteId: SUITE_SUNREY_ED25519_V1,
    signatureHex: '',
  },
  isolatedSigner: { sign: (request) => cold.signIsolated(request) },
});
if (imported.outcome !== 'OK' || imported.value.state !== 'SUBMITTED') {
  throw new Error(imported.outcome === 'REJECTED' ? imported.message : 'cold import failed');
}
h.custody.finalizeBlock();
const finalized = h.custody.recognizeFinality(requested.value.withdrawalId);
if (finalized.outcome !== 'OK' || finalized.value.state !== 'FINALIZED') {
  throw new Error('cold withdrawal did not finalize');
}
const recon = h.custody.reconcile();
if (recon.outcome !== 'MATCHED') {
  throw new Error(`cold reconcile ${recon.outcome}`);
}

console.log('cold-signing demo: ok');
console.log(`  exported unsigned package hash ${exported.value.transactionHash}`);
console.log(`  isolated development cold signer bound approved bytes`);
console.log(`  imported signature → ${imported.value.state} → ${finalized.value.state}`);
console.log(`  reconciliation ${recon.outcome}`);
