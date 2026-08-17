import { createInstitutionalHarness, provisionInstitutionalActor } from './institutional/harness.ts';

const h = createInstitutionalHarness();
const opsA = provisionInstitutionalActor(h, 'actor_ops_a', 'id_ops_a', 'cust_institutional');
const opsB = provisionInstitutionalActor(h, 'actor_ops_b', 'id_ops_b', 'cust_institutional');

const vault = h.custody.createVault({
  actorKind: 'HUMAN_OPERATOR',
  custodyType: 'INSTITUTIONAL',
  securityTier: 'HOT',
  approvalMode: 'DUAL_CONTROL',
  authorizedApproverIds: [opsA.actor.actorId, opsB.actor.actorId],
  classifications: ['SEGREGATED', 'HOT'],
  providerKind: 'REMOTE_SIGNER',
});
if (vault.outcome !== 'OK') {
  throw new Error('vault create failed');
}
const wallet = h.custody.createAddress({
  actorKind: 'HUMAN_OPERATOR',
  vaultId: vault.value.vaultId,
  classifications: ['SEGREGATED', 'HOT'],
});
if (wallet.outcome !== 'OK') {
  throw new Error('address create failed');
}
const funded = h.custody.fundDevelopment(wallet.value.address, 250_000n);
if (!funded.finalized) {
  throw new Error('development deposit must finalize');
}
const deposits = h.custody.recognizeFinalizedDeposits();
if (deposits.length !== 1 || deposits[0]!.quantity !== 250_000n) {
  throw new Error('custody must recognize the finalized deposit only');
}
const destination = h.custody.registerDestination({
  actorKind: 'HUMAN_OPERATOR',
  actorId: opsA.actor.actorId,
  vaultId: vault.value.vaultId,
  address: 'sr1_institutional_counterparty',
  label: 'enterprise beneficiary',
});
if (destination.outcome !== 'OK') {
  throw new Error('destination register failed');
}
const approvedDest = h.custody.verifyDestination({
  actorKind: 'HUMAN_OPERATOR',
  actorId: opsA.actor.actorId,
  destinationId: destination.value.destinationId,
  status: 'APPROVED',
});
if (approvedDest.outcome !== 'OK') {
  throw new Error('destination approve failed');
}
const requested = h.custody.requestWithdrawal({
  actorId: opsA.actor.actorId,
  actorKind: 'HUMAN_OPERATOR',
  customerId: opsA.customer.id,
  vaultId: vault.value.vaultId,
  walletId: wallet.value.walletId,
  destinationId: destination.value.destinationId,
  quantity: 40_000n,
});
if (requested.outcome !== 'OK') {
  throw new Error(requested.outcome === 'REJECTED' ? requested.message : requested.decision.status);
}
const first = h.custody.approveWithdrawal({
  actorId: opsA.actor.actorId,
  actorKind: 'HUMAN_OPERATOR',
  withdrawalId: requested.value.withdrawalId,
  decision: 'APPROVE',
});
if (first.outcome !== 'OK' || first.value.state !== 'AWAITING_APPROVAL') {
  throw new Error('single approver must not satisfy dual control');
}
const second = h.custody.approveWithdrawal({
  actorId: opsB.actor.actorId,
  actorKind: 'HUMAN_OPERATOR',
  withdrawalId: requested.value.withdrawalId,
  decision: 'APPROVE',
});
if (second.outcome !== 'OK' || second.value.state !== 'APPROVED') {
  throw new Error('dual approval failed');
}
const simulated = h.custody.simulateWithdrawal(requested.value.withdrawalId);
if (simulated.outcome !== 'OK' || !simulated.value.preview) {
  throw new Error('transaction simulation failed');
}
const submitted = h.custody.signAndSubmitWithdrawal({
  actorKind: 'HUMAN_OPERATOR',
  withdrawalId: requested.value.withdrawalId,
});
if (submitted.outcome !== 'OK' || submitted.value.state !== 'SUBMITTED') {
  throw new Error(submitted.outcome === 'REJECTED' ? submitted.message : 'submit failed');
}
h.custody.finalizeBlock();
const finalized = h.custody.recognizeFinality(requested.value.withdrawalId);
if (finalized.outcome !== 'OK' || finalized.value.state !== 'FINALIZED') {
  throw new Error('finality recognition failed');
}
const recon = h.custody.reconcile();
if (recon.outcome !== 'MATCHED' || recon.autoAdjustedOnChain !== false) {
  throw new Error(`reconciliation ${recon.outcome} notes=${recon.notes.join(';')}`);
}
const position = h.custody.derivedPosition(wallet.value.walletId);
if (!position || position.onChain !== 210_000n || position.attributed !== 210_000n) {
  throw new Error('derived position must match on-chain holdings exactly');
}

console.log('institutional custody demo: ok');
console.log(`  four-validator simulation finalized height ${funded.height} then withdrawal`);
console.log(`  vault ${vault.value.vaultId} SEGREGATED+HOT remote signer`);
console.log(`  deposit ${deposits[0]!.txId} recognized after BFT finality`);
console.log(`  withdrawal ${finalized.value.withdrawalId} dual-approved, simulated, signed, finalized`);
console.log(`  reconciliation ${recon.outcome} on-chain=${position.onChain} attributed=${position.attributed}`);
console.log('  simulation only; not a licensed custodian; not a second asset ledger');
