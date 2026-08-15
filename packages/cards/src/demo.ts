import { ACTION_TYPES } from '../../permissions/src/action-types.ts';
import { asIntentId } from '../../permissions/src/action-intent.ts';
import { SIMULATION_US_VIRTUAL_PROGRAM } from './program.ts';
import { createCardWorld, requestCardIntent, signedCallback } from '../../../tests/card-world.ts';

async function main(): Promise<void> {
  const world = createCardWorld('demo', 100_000n);
  const { cards, runtime, actorId } = world;

  console.log('1. Customer authenticates.');
  const session = runtime.identity.service.resolveActorContext(actorId);
  if (!session.ok) {
    throw new Error('authenticate failed');
  }
  console.log(`   actor=${session.value.actorId}`);

  console.log('2. Customer eligible for simulated card program.');
  const program = cards.store.getProgram(SIMULATION_US_VIRTUAL_PROGRAM.programId);
  if (!program || program.liveCapability) {
    throw new Error('missing simulation program');
  }
  console.log(`   program=${program.programId} liveCapability=${program.liveCapability}`);

  console.log('3. Card requested through ActionIntent.');
  const requested = cards.requestCard(requestCardIntent(world, 'card_demo'));
  if (requested.outcome !== 'OK') {
    throw new Error(`request failed: ${requested.outcome}`);
  }
  const pending = requested.value;
  console.log(`   card=${pending.cardId} processor=${pending.processorCardRef}`);

  console.log('4. Kernel allows.');
  console.log(`   kernel=${requested.decision.status} evidence=${requested.decision.evidenceRecordId}`);

  console.log('5. Virtual simulated card reference created.');
  console.log(`   formFactor=${pending.formFactor} status=${pending.status} display=${pending.displayHint}`);

  console.log('6. Card activated.');
  const activated = cards.activateCard({
    id: asIntentId('act_demo'),
    actionType: ACTION_TYPES.ACTIVATE_CARD,
    idempotencyKey: 'act_demo',
    actorId,
    requestedAt: world.clock.now(),
    purpose: 'CUSTOMER_CARD',
    payload: { cardId: pending.cardId, accountId: world.account.id },
  });
  if (activated.outcome !== 'OK') {
    throw new Error('activate failed');
  }
  const card = activated.value;
  console.log(`   status=${card.status}`);

  console.log('7. Customer has $1,000 available.');
  const starting = cards.available(world.account.id);
  console.log(`   available=${starting.available.minorUnits.toString()} ${starting.available.currency}`);
  if (starting.available.minorUnits !== 100_000n) {
    throw new Error(`expected $1000 starting available, got ${starting.available.minorUnits.toString()}`);
  }

  console.log('8. Simulated $100 merchant authorization arrives.');
  const envelope = signedCallback(world, 'AUTHORIZATION', 'auth_demo_1', 'nonce_demo_1', {
    authorizationId: 'auth_demo_1',
    cardId: card.cardId,
    processorCardRef: card.processorCardRef,
    merchantRef: 'sim_cafe',
    merchantCategory: '5411',
    amountMinorUnits: '10000',
    currency: 'USD',
    country: 'US',
    ecommerce: true,
    processorReference: 'auth_demo_1',
  });

  console.log('9. Processor callback authenticated.');
  const auth = await cards.ingestAuthorizationCallback(envelope);
  if (auth.outcome !== 'OK') {
    throw new Error(`auth failed: ${auth.outcome}`);
  }

  console.log('10. Fraud/policy/card controls pass.');
  console.log(`    kernel=${auth.decision.status}`);

  console.log('11. Authorization approved.');
  console.log(`    decision=${auth.value.decision} auth=${auth.value.authorizationId}`);

  console.log('12. $100 hold created.');
  console.log(`    hold=${auth.value.holdId}`);
  if (!auth.value.holdId) {
    throw new Error('missing hold');
  }

  console.log('13. Available = $900.');
  const afterAuth = cards.available(world.account.id);
  console.log(`    available=${afterAuth.available.minorUnits.toString()}`);
  if (afterAuth.available.minorUnits !== 90_000n) {
    throw new Error(`expected $900 after auth, got ${afterAuth.available.minorUnits.toString()}`);
  }

  console.log('14. Clearing for $100 arrives.');
  const clearing = await cards.ingestClearingCallback(
    signedCallback(world, 'CLEARING', 'clr_demo_1', 'nonce_clr_demo', {
      clearingId: 'clr_demo_1',
      authorizationId: 'auth_demo_1',
      cardId: card.cardId,
      amountMinorUnits: '10000',
      currency: 'USD',
      processorReference: 'clr_demo_1',
    }),
  );
  if (clearing.outcome !== 'OK') {
    throw new Error('clearing failed');
  }
  console.log(`    clearing=${clearing.value.clearingId} journal=${clearing.value.journalId}`);

  console.log('15. Hold captured/released according to canonical flow.');
  console.log(`    scenario=${clearing.value.scenario} state=${clearing.value.state}`);

  console.log('16. Balanced settlement journal posted.');
  if (!clearing.value.journalId) {
    throw new Error('missing journal');
  }
  const journal = runtime.ledger.getJournal(clearing.value.journalId);
  if (!journal) {
    throw new Error('journal not found');
  }
  const debit = journal.postings
    .filter((posting) => posting.direction === 'DEBIT')
    .reduce((sum, posting) => sum + posting.amount.minorUnits, 0n);
  const credit = journal.postings
    .filter((posting) => posting.direction === 'CREDIT')
    .reduce((sum, posting) => sum + posting.amount.minorUnits, 0n);
  console.log(`    debit=${debit.toString()} credit=${credit.toString()}`);
  if (debit !== credit) {
    throw new Error('settlement journal is unbalanced');
  }

  console.log('17. Customer transaction history shows purchase.');
  const history = cards.history(card.cardId);
  if (!history.some((row) => row.kind === 'PURCHASE' && row.amountMinorUnits === '10000')) {
    throw new Error('history missing purchase');
  }
  console.log(`    entries=${history.length}`);

  console.log('18. Refund $25 arrives.');
  const refund = cards.ingestRefundCallback(
    signedCallback(world, 'REFUND', 'rf_demo_1', 'nonce_rf_demo', {
      refundId: 'rf_demo_1',
      originalClearingId: 'clr_demo_1',
      cardId: card.cardId,
      amountMinorUnits: '2500',
      currency: 'USD',
      processorReference: 'rf_demo_1',
    }),
  );
  if (refund.outcome !== 'OK') {
    throw new Error('refund failed');
  }
  console.log(`    refund=${refund.value.refundId}`);

  console.log('19. Compensating refund journal posts.');
  console.log(`    journal=${refund.value.journalId}`);

  console.log('20. Reconciliation matches.');
  const recon = cards.store.getReconciliation('clr_demo_1');
  console.log(`    status=${recon?.status ?? 'missing'}`);
  if (recon?.status !== 'MATCHED') {
    throw new Error('reconciliation did not match');
  }

  console.log('21. Evidence chain verifies.');
  const verified = runtime.evidence.verifyChain();
  console.log(`    evidence=${verified.ok}`);
  if (!verified.ok) {
    throw new Error('evidence chain failed');
  }

  console.log('22. Duplicate authorization callback has no duplicate effect.');
  const duplicate = await cards.ingestAuthorizationCallback(
    signedCallback(world, 'AUTHORIZATION', 'auth_demo_1', 'nonce_demo_dup', {
      authorizationId: 'auth_demo_1',
      cardId: card.cardId,
      processorCardRef: card.processorCardRef,
      merchantRef: 'sim_cafe',
      merchantCategory: '5411',
      amountMinorUnits: '10000',
      currency: 'USD',
      country: 'US',
      processorReference: 'auth_demo_1',
    }),
  );
  if (duplicate.outcome !== 'OK' || duplicate.replay !== true) {
    throw new Error('duplicate callback was not an idempotent replay');
  }
  if (duplicate.value.authorizationId !== auth.value.authorizationId) {
    throw new Error('duplicate created a second authorization');
  }
  console.log(`    duplicateAuth=${duplicate.value.authorizationId}`);

  console.log('CARD DEMO COMPLETE');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
