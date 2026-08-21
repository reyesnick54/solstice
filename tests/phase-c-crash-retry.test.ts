import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asPaymentId } from '../packages/payments/src/ids.ts';
import { acceptIntent, beneficiaryIntent, payIntent, quoteIntent, readyQuoteAndBeneficiary } from './payment-world.ts';
import { createPhaseCWorld, ledgerBalance } from './phase-c-world.ts';

function preparePayment(world: ReturnType<typeof createPhaseCWorld>, id: string) {
  const beneficiary = world.payments.createBeneficiary(beneficiaryIntent(world, id));
  assert.equal(beneficiary.outcome, 'OK');
  const quote = world.payments.createQuote(quoteIntent(world, id));
  assert.equal(quote.outcome, 'OK');
  if (quote.outcome !== 'OK') {
    throw new Error('quote');
  }
  assert.equal(world.payments.acceptQuote(acceptIntent(world, id, quote.value.quoteId)).outcome, 'OK');
  return quote.value.quoteId;
}

describe('Phase C crash and retry recovery', () => {
  it('fails before provider submission and does not capture the Ledger', () => {
    const world = createPhaseCWorld('cr_before', 400_000n);
    const quoteId = preparePayment(world, 'cr_before');
    const before = ledgerBalance(world, world.account);
    world.payments.rail.setMode?.('pay_cr_before', 'FAIL_BEFORE_SUBMIT');
    const result = world.payments.initiatePayment(payIntent(world, 'cr_before', 'ben_cr_before', quoteId));
    assert.equal(result.outcome, 'REJECTED');
    assert.equal(world.payments.getStore().getPayment('pay_cr_before')?.status, 'FAILED');
    assert.equal(ledgerBalance(world, world.account), before);
  });

  it('keeps SUBMISSION_UNKNOWN without releasing funds blindly', () => {
    const world = createPhaseCWorld('cr_unk', 400_000n);
    const quoteId = preparePayment(world, 'cr_unk');
    world.payments.rail.setMode?.('pay_cr_unk', 'TIMEOUT_AFTER_UNKNOWN');
    const result = world.payments.initiatePayment(payIntent(world, 'cr_unk', 'ben_cr_unk', quoteId));
    assert.equal(result.outcome, 'OK');
    if (result.outcome === 'OK') {
      assert.equal(result.value.status, 'SUBMISSION_UNKNOWN');
    }
  });

  it('replays the same conversion idempotency key without a second debit', () => {
    const world = createPhaseCWorld('cr_fx', 400_000n);
    const created = world.payments.createQuote(quoteIntent(world, 'cr_fx'));
    assert.equal(created.outcome, 'OK');
    if (created.outcome !== 'OK') {
      throw new Error('quote');
    }
    assert.equal(world.payments.acceptQuote(acceptIntent(world, 'cr_fx', created.value.quoteId)).outcome, 'OK');
    const first = world.payments.executeInternalConversion(
      { ...acceptIntent(world, 'cr_fx_exec', created.value.quoteId), idempotencyKey: 'fx_cr', id: 'int_fx_cr' as never },
      world.sarAccount.id,
    );
    assert.equal(first.outcome, 'OK');
    const usd = ledgerBalance(world, world.account);
    const second = world.payments.executeInternalConversion(
      { ...acceptIntent(world, 'cr_fx_exec2', created.value.quoteId), idempotencyKey: 'fx_cr', id: 'int_fx_cr2' as never },
      world.sarAccount.id,
    );
    assert.equal(second.outcome, 'OK');
    if (second.outcome === 'OK') {
      assert.equal(second.replay, true);
    }
    assert.equal(ledgerBalance(world, world.account), usd);
  });

  it('replays the same reconciliation inputs without duplicating breaks', () => {
    const world = createPhaseCWorld('cr_rec', 200_000n);
    const input = {
      runId: 'run_cr_rec',
      window: {
        provider: 'SIMULATED_PROVIDER_GCC',
        periodStart: world.clock.now(),
        periodEnd: world.clock.now(),
        sourceVersion: 'sim-recon-adapter-v1',
      },
      expected: [
        {
          recordId: 'exp_cr',
          domain: 'PAYMENTS',
          provider: 'SIMULATED_PROVIDER_GCC',
          currency: 'USD',
          amountMinor: 10n,
          externalRef: 'ext_cr',
          occurredAt: world.clock.now(),
        },
      ],
      reported: [
        {
          recordId: 'rep_cr',
          provider: 'SIMULATED_PROVIDER_GCC',
          currency: 'USD',
          amountMinor: 11n,
          externalRef: 'ext_cr',
          statementRef: 'stmt_cr',
          occurredAt: world.clock.now(),
        },
      ],
    };
    const first = world.control.runReconciliation(input);
    const second = world.control.runReconciliation({ ...input, runId: 'run_cr_rec_2' });
    assert.equal(second.replay, true);
    assert.equal(second.run.runId, first.run.runId);
    assert.equal(world.control.store.listBreaks().filter((row) => row.runId === first.run.runId).length, first.breaks.length);
  });

  it('settles a delayed rail once and ignores a second completeSettlement as replay', () => {
    const world = createPhaseCWorld('cr_set', 400_000n);
    const prepared = readyQuoteAndBeneficiary(world, 'cr_set');
    world.payments.rail.setMode?.('pay_cr_set', 'PENDING');
    const pending = world.payments.initiatePayment(payIntent(world, 'cr_set', 'ben_cr_set', prepared.quote.quoteId));
    assert.equal(pending.outcome, 'OK');
    const first = world.payments.completeSettlement(asPaymentId('pay_cr_set'));
    assert.equal(first.outcome, 'OK');
    const journals = world.runtime.ledger.listJournals().length;
    const second = world.payments.completeSettlement(asPaymentId('pay_cr_set'));
    assert.equal(second.outcome, 'OK');
    assert.equal(world.runtime.ledger.listJournals().length, journals);
  });
});
