import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  asActionIntentId,
  asActorId,
  asCustomerId,
  asIdempotencyKey,
  asUtcInstant,
} from '@solstice/domain';
import { ComplianceKernel, freezeIntent, isPyrCapabilityEnabled, pyrCapabilitiesFor } from '@solstice/kernel';
import { journalBalances } from '@solstice/ledger';
import { PyrAmount, PyrBooks, corporateAccountId, customerAccountId } from './index.ts';

const NOW = asUtcInstant('2026-08-14T16:00:00.000Z');

function authorize(kernel: ComplianceKernel, kind: 'OPEN_PYR_WALLET' | 'SEED_PYR' | 'SETTLE_PYR_COMPENSATION' | 'TRANSFER_PYR') {
  const result = kernel.evaluate(
    freezeIntent({
      id: asActionIntentId(`int_${kind}_${Math.random().toString(16).slice(2)}`),
      kind,
      actor: { type: 'SYSTEM', id: asActorId('system') },
      payload:
        kind === 'OPEN_PYR_WALLET'
          ? { accountId: corporateAccountId('treasury'), ownerId: 'SOLSTICE_CORPORATE', holderClass: 'CORPORATE' }
          : kind === 'SEED_PYR'
            ? { accountId: corporateAccountId('treasury'), amountMinorUnits: 100n }
            : kind === 'TRANSFER_PYR'
              ? {
                  fromWalletId: customerAccountId(asCustomerId('cust_a'), 'wallet'),
                  toWalletId: customerAccountId(asCustomerId('cust_b'), 'wallet'),
                  amountMinorUnits: 10n,
                }
              : { customerId: asCustomerId('cust_a'), amountMinorUnits: 50n, settlementRef: 's1' },
      idempotencyKey: asIdempotencyKey(`idem_${kind}_${Date.now()}_${Math.random()}`),
      occurredAt: NOW,
      sourceJurisdiction: 'US',
    }),
  );
  if (!result.ok || result.value.outcome !== 'AUTHORIZED') {
    throw new Error(`expected AUTHORIZED for ${kind}, got ${JSON.stringify(result)}`);
  }
  return result.value.authorization;
}

describe('PYR books', () => {
  it('keeps customer and corporate PYR on separate journals that each balance', () => {
    const kernel = new ComplianceKernel();
    const books = new PyrBooks();
    const open = authorize(kernel, 'OPEN_PYR_WALLET');
    const jane = asCustomerId('cust_a');
    books.openWallet(open, {
      id: corporateAccountId('treasury'),
      holderClass: 'CORPORATE',
      ownerId: 'SOLSTICE_CORPORATE',
      assetClass: 'PYR_PARTICIPATION',
      asset: 'PYR',
      role: 'TREASURY',
      jurisdiction: 'US',
      openedAt: NOW,
    });
    books.openWallet(open, {
      id: corporateAccountId('issuance'),
      holderClass: 'CORPORATE',
      ownerId: 'SOLSTICE_CORPORATE',
      assetClass: 'PYR_PARTICIPATION',
      asset: 'PYR',
      role: 'ISSUANCE_CONTRA',
      jurisdiction: 'US',
      openedAt: NOW,
    });
    books.openWallet(open, {
      id: corporateAccountId('expense'),
      holderClass: 'CORPORATE',
      ownerId: 'SOLSTICE_CORPORATE',
      assetClass: 'PYR_PARTICIPATION',
      asset: 'PYR',
      role: 'COMPENSATION_EXPENSE',
      jurisdiction: 'US',
      openedAt: NOW,
    });
    books.openWallet(open, {
      id: customerAccountId(jane, 'wallet'),
      holderClass: 'CUSTOMER',
      ownerId: jane,
      assetClass: 'PYR_PARTICIPATION',
      asset: 'PYR',
      role: 'WALLET',
      jurisdiction: 'US',
      openedAt: NOW,
    });
    books.openWallet(open, {
      id: customerAccountId(jane, 'earnings'),
      holderClass: 'CUSTOMER',
      ownerId: jane,
      assetClass: 'PYR_PARTICIPATION',
      asset: 'PYR',
      role: 'EARNINGS_CONTRA',
      jurisdiction: 'US',
      openedAt: NOW,
    });
    const seed = books.seedCorporate(authorize(kernel, 'SEED_PYR'), {
      intentId: asActionIntentId('seed1'),
      treasuryId: corporateAccountId('treasury'),
      issuanceContraId: corporateAccountId('issuance'),
      amount: PyrAmount.fromMinorUnits(500n),
      at: NOW,
    });
    assert.equal(seed.ok, true);
    const settled = books.settleCompensation(authorize(kernel, 'SETTLE_PYR_COMPENSATION'), {
      intentId: asActionIntentId('set1'),
      customerWalletId: customerAccountId(jane, 'wallet'),
      customerEarningsContraId: customerAccountId(jane, 'earnings'),
      corporateTreasuryId: corporateAccountId('treasury'),
      corporateExpenseId: corporateAccountId('expense'),
      amount: PyrAmount.fromMinorUnits(50n),
      at: NOW,
      settlementRef: 's1',
    });
    assert.equal(settled.ok, true);
    if (!settled.ok) return;
    for (const journal of books.journals.list()) {
      assert.equal(journalBalances(journal.lines).ok, true);
      const classes = new Set(
        journal.lines.map((line) => books.getAccount(line.accountId)?.holderClass),
      );
      assert.equal(classes.size, 1);
    }
    assert.equal(books.customerTotal(jane).minorUnits, 50n);
    assert.equal(books.corporateTreasuryTotal().minorUnits, 450n);
  });

  it('refuses a transfer when the registry has not confirmed TRANSFER', () => {
    assert.equal(isPyrCapabilityEnabled('US', 'TRANSFER'), false);
    assert.equal(isPyrCapabilityEnabled('SA', 'TRANSFER'), false);
    const caps = pyrCapabilitiesFor('US');
    for (const value of Object.values(caps)) {
      assert.equal(value, false);
    }
    const kernel = new ComplianceKernel();
    const decision = kernel.evaluate(
      freezeIntent({
        id: asActionIntentId('int_xfer'),
        kind: 'TRANSFER_PYR',
        actor: { type: 'SYSTEM', id: asActorId('system') },
        payload: {
          fromWalletId: customerAccountId(asCustomerId('cust_a'), 'wallet'),
          toWalletId: customerAccountId(asCustomerId('cust_b'), 'wallet'),
          amountMinorUnits: 10n,
        },
        idempotencyKey: asIdempotencyKey('idem_xfer'),
        occurredAt: NOW,
        sourceJurisdiction: 'SA',
      }),
    );
    assert.equal(decision.ok, true);
    if (!decision.ok) return;
    assert.equal(decision.value.outcome, 'REFUSED');
  });

  it('rejects float construction of PyrAmount', () => {
    assert.throws(() => PyrAmount.fromMinorUnits(1 as unknown as bigint));
  });
});
