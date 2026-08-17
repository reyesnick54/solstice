import { createInstitutionalHarness, provisionInstitutionalActor } from './institutional/harness.ts';

const h = createInstitutionalHarness({ unknownNext: true });
const opsA = provisionInstitutionalActor(h, 'actor_unk_a', 'id_unk_a', 'cust_unknown');
const opsB = provisionInstitutionalActor(h, 'actor_unk_b', 'id_unk_b', 'cust_unknown');

const vault = h.custody.createVault({
  actorKind: 'HUMAN_OPERATOR',
  custodyType: 'INSTITUTIONAL',
  securityTier: 'WARM',
  approvalMode: 'DUAL_CONTROL',
  authorizedApproverIds: [opsA.actor.actorId, opsB.actor.actorId],
  classifications: ['SEGREGATED', 'WARM'],
});
if (vault.outcome !== 'OK') {
  throw new Error('vault failed');
}
const wallet = h.custody.createAddress({
  actorKind: 'HUMAN_OPERATOR',
  vaultId: vault.value.vaultId,
  classifications: ['SEGREGATED', 'WARM'],
});
if (wallet.outcome !== 'OK') {
  throw new Error('wallet failed');
}
h.custody.fundDevelopment(wallet.value.address, 80_000n);
h.custody.recognizeFinalizedDeposits();
const destination = h.custody.registerDestination({
  actorKind: 'HUMAN_OPERATOR',
  actorId: opsA.actor.actorId,
  vaultId: vault.value.vaultId,
  address: 'sr1_unknown_counterparty',
  label: 'unknown-path beneficiary',
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
  quantity: 10_000n,
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
const unknown = h.custody.signAndSubmitWithdrawal({
  actorKind: 'HUMAN_OPERATOR',
  withdrawalId: requested.value.withdrawalId,
});
if (unknown.outcome !== 'OK' || unknown.value.state !== 'SUBMISSION_UNKNOWN') {
  throw new Error('expected SUBMISSION_UNKNOWN after RPC ambiguity');
}
const duplicate = h.custody.signAndSubmitWithdrawal({
  actorKind: 'HUMAN_OPERATOR',
  withdrawalId: requested.value.withdrawalId,
});
if (duplicate.outcome !== 'REJECTED' || duplicate.code !== 'NO_BLIND_RESUBMIT') {
  throw new Error('must not construct a second economic withdrawal');
}
h.custody.queryUnknownWithdrawal(requested.value.withdrawalId);
h.custody.finalizeBlock();
const recovered = h.custody.recognizeFinality(requested.value.withdrawalId);
if (recovered.outcome !== 'OK' || recovered.value.state !== 'FINALIZED') {
  throw new Error('query-by-tx must discover and finalize the single withdrawal');
}
const recon = h.custody.reconcile();
if (recon.outcome !== 'MATCHED' || recon.autoAdjustedOnChain !== false) {
  throw new Error('unknown path must reconcile without a duplicate');
}

console.log('submission-unknown demo: ok');
console.log(`  withdrawal ${unknown.value.withdrawalId} recorded SUBMISSION_UNKNOWN once`);
console.log(`  duplicate sign rejected (${duplicate.code})`);
console.log(`  queried chain by tx ${unknown.value.chainTxId} → ${recovered.value.state}`);
console.log(`  reconciliation ${recon.outcome} autoAdjustedOnChain=${recon.autoAdjustedOnChain}`);
