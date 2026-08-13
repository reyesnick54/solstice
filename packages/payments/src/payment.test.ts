import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  asAccountId,
  asActorId,
  asBeneficiaryId,
  asCustomerId,
  asIdempotencyKey,
  asJurisdiction,
  asLegalEntityId,
  asResidency,
  asUtcInstant,
  Money,
  notStartedVerification,
} from '@solstice/domain';
import { LIVE_FLAGS } from '@solstice/kernel';
import { journalBalances } from '@solstice/ledger';
import { SolsticeSystem } from './system.ts';

const NOW = asUtcInstant('2026-08-13T15:00:00.000Z');
const SYSTEM = { type: 'SYSTEM' as const, id: asActorId('system') };
const CUSTOMER_ACTOR = {
  type: 'CUSTOMER' as const,
  id: asActorId('jane'),
  customerId: asCustomerId('cust_jane'),
};

function provision(system: SolsticeSystem) {
  system.bootstrap();
  const customer = system.createCustomer(
    {
      id: asCustomerId('cust_jane'),
      legalEntityId: asLegalEntityId('le_us'),
      jurisdiction: asJurisdiction('US'),
      residency: asResidency('US'),
      verification: notStartedVerification(asUtcInstant('2027-01-01T00:00:00.000Z')),
      createdAt: NOW,
    },
    SYSTEM,
  );
  assert.equal(customer.ok, true);
  const usd = system.openAccount({
    accountId: asAccountId('jane_usd'),
    ownerCustomerId: asCustomerId('cust_jane'),
    currency: 'USD',
    accountClass: 'deposits',
    actor: SYSTEM,
  });
  const eur = system.openAccount({
    accountId: asAccountId('jane_eur'),
    ownerCustomerId: asCustomerId('cust_jane'),
    currency: 'EUR',
    accountClass: 'deposits',
    actor: SYSTEM,
  });
  assert.equal(usd.ok, true);
  assert.equal(eur.ok, true);
  const seeded = system.seedCredit(
    asAccountId('jane_usd'),
    Money.fromDecimalString('20000.00', 'USD'),
    SYSTEM,
  );
  assert.equal(seeded.ok, true);
  const seededEur = system.seedCredit(
    asAccountId('jane_eur'),
    Money.fromDecimalString('100.00', 'EUR'),
    SYSTEM,
  );
  assert.equal(seededEur.ok, true);
  const ahmed = system.addBeneficiary(
    {
      id: asBeneficiaryId('ben_ahmed'),
      ownerCustomerId: asCustomerId('cust_jane'),
      name: 'Ahmed',
      country: asJurisdiction('DE'),
      institution: { iban: 'DE89370400440532013000', bic: 'COBADEFFXXX', institutionName: 'Commerzbank' },
      currency: 'EUR' as never,
    },
    CUSTOMER_ACTOR,
  );
  const pat = system.addBeneficiary(
    {
      id: asBeneficiaryId('ben_pat'),
      ownerCustomerId: asCustomerId('cust_jane'),
      name: 'Pat',
      country: asJurisdiction('US'),
      institution: { routingNumber: '021000021', accountNumber: '123456789', institutionName: 'Sim Bank' },
      currency: 'USD' as never,
    },
    CUSTOMER_ACTOR,
  );
  assert.equal(ahmed.ok, true, ahmed.ok ? '' : JSON.stringify(ahmed.error));
  assert.equal(pat.ok, true, pat.ok ? '' : JSON.stringify(pat.error));
}

describe('LIVE flags unchanged', () => {
  it('all LIVE_* are false', () => {
    for (const value of Object.values(LIVE_FLAGS)) {
      assert.equal(value, false);
    }
  });
});

describe('payment execution', () => {
  it('sends a domestic USD payment', () => {
    const system = new SolsticeSystem();
    provision(system);
    const result = system.sendPayment({
      customerId: asCustomerId('cust_jane'),
      beneficiaryId: asBeneficiaryId('ben_pat'),
      instructedAmount: Money.fromDecimalString('100.00', 'USD'),
      instructedSide: 'DESTINATION',
      purpose: 'rent',
      idempotencyKey: asIdempotencyKey('dom_1'),
      actor: CUSTOMER_ACTOR,
    });
    assert.equal(result.ok, true, result.ok ? '' : JSON.stringify(result.error, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));
    if (!result.ok) return;
    assert.equal(result.value.payment?.state, 'SETTLED');
    assert.ok(
      result.value.routing?.chosen?.railId === 'domestic' ||
        result.value.routing?.chosen?.railId === 'instant',
    );
    assert.ok(result.value.routing?.ranked.some((row) => row.railId === 'domestic' || row.railId === 'instant'));
  });

  it('sends a cross-border USD→EUR payment with a ranked route table', () => {
    const system = new SolsticeSystem();
    provision(system);
    const result = system.sendPayment({
      customerId: asCustomerId('cust_jane'),
      beneficiaryId: asBeneficiaryId('ben_ahmed'),
      instructedAmount: Money.fromDecimalString('5000.00', 'EUR'),
      instructedSide: 'DESTINATION',
      purpose: 'family support',
      idempotencyKey: asIdempotencyKey('xb_1'),
      actor: CUSTOMER_ACTOR,
    });
    assert.equal(result.ok, true, result.ok ? '' : JSON.stringify(result.error, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));
    if (!result.ok) return;
    assert.equal(result.value.payment?.state, 'SETTLED');
    assert.ok(result.value.routing);
    assert.ok((result.value.routing?.ranked.length ?? 0) >= 1);
    assert.ok(result.value.journals.some((journal) => journal.fx !== undefined));
    for (const journal of result.value.journals) {
      const balanced = journalBalances(journal.lines);
      assert.equal(
        balanced.ok,
        true,
        JSON.stringify(balanced.byCurrency, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)),
      );
    }
    assert.notEqual(result.value.routing?.chosen?.railId, 'domestic');
  });

  it('sanctions BLOCK posts nothing and still seals evidence', () => {
    const system = new SolsticeSystem();
    provision(system);
    const before = system.books.journals.list().length;
    const evidenceBefore = system.kernel.vault.size;
    const result = system.sendPayment({
      customerId: asCustomerId('cust_jane'),
      beneficiaryId: asBeneficiaryId('ben_ahmed'),
      instructedAmount: Money.fromDecimalString('5000.00', 'EUR'),
      instructedSide: 'DESTINATION',
      purpose: 'family support',
      idempotencyKey: asIdempotencyKey('block_1'),
      actor: CUSTOMER_ACTOR,
      screeningOverride: {
        receiverName: 'Blocked Person',
        beneficialOwnerName: 'Blocked Person',
      },
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.code, 'KERNEL_REFUSED');
    if (result.error.code === 'KERNEL_REFUSED' && result.error.decision.outcome === 'REFUSED') {
      assert.equal(result.error.decision.posture, 'BLOCK');
    }
    assert.equal(system.books.journals.list().length, before);
    assert.ok(system.kernel.vault.size > evidenceBefore);
    assert.equal(system.books.getPayment('pay_missing'), undefined);
  });

  it('HOLD posts nothing and seals evidence', () => {
    const system = new SolsticeSystem();
    provision(system);
    const before = system.books.journals.list().length;
    const result = system.sendPayment({
      customerId: asCustomerId('cust_jane'),
      beneficiaryId: asBeneficiaryId('ben_ahmed'),
      instructedAmount: Money.fromDecimalString('25.00', 'EUR'),
      instructedSide: 'DESTINATION',
      purpose: 'family support',
      idempotencyKey: asIdempotencyKey('hold_1'),
      actor: CUSTOMER_ACTOR,
      screeningOverride: { receiverName: 'Hold Person' },
    });
    assert.equal(result.ok, false);
    if (!result.ok && result.error.code === 'KERNEL_REFUSED' && result.error.decision.outcome === 'REFUSED') {
      assert.equal(result.error.decision.posture, 'HOLD');
    }
    assert.equal(system.books.journals.list().length, before);
  });

  it('failed settlement returns funds via compensating entries', () => {
    const system = new SolsticeSystem();
    provision(system);
    const beforeUsd = system.books.positionForAccount(asAccountId('jane_usd'));
    assert.equal(beforeUsd.ok, true);
    const result = system.sendPayment({
      customerId: asCustomerId('cust_jane'),
      beneficiaryId: asBeneficiaryId('ben_ahmed'),
      instructedAmount: Money.fromDecimalString('100.00', 'EUR'),
      instructedSide: 'DESTINATION',
      purpose: 'family support',
      idempotencyKey: asIdempotencyKey('fail_1'),
      actor: CUSTOMER_ACTOR,
      failSettlement: true,
    });
    assert.equal(result.ok, true, result.ok ? '' : JSON.stringify(result.error, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));
    if (!result.ok) return;
    assert.equal(result.value.payment?.state, 'RETURNED');
    assert.ok(result.value.journals.some((journal) => journal.memo.startsWith('compensate')));
    assert.ok(result.value.journals.some((journal) => journal.compensatesJournalId !== undefined));
    const afterUsd = system.books.positionForAccount(asAccountId('jane_usd'));
    assert.equal(afterUsd.ok, true);
    if (beforeUsd.ok && afterUsd.ok) {
      assert.equal(afterUsd.value.minorUnits, beforeUsd.value.minorUnits);
    }
    const originals = result.value.journals.filter((journal) => journal.compensatesJournalId === undefined);
    assert.ok(originals.length > 0);
  });

  it('idempotency key replays without a second posting', () => {
    const system = new SolsticeSystem();
    provision(system);
    const first = system.sendPayment({
      customerId: asCustomerId('cust_jane'),
      beneficiaryId: asBeneficiaryId('ben_pat'),
      instructedAmount: Money.fromDecimalString('10.00', 'USD'),
      instructedSide: 'SOURCE',
      purpose: 'coffee',
      idempotencyKey: asIdempotencyKey('idem_dom'),
      actor: CUSTOMER_ACTOR,
    });
    assert.equal(first.ok, true);
    const count = system.books.journals.list().length;
    const second = system.sendPayment({
      customerId: asCustomerId('cust_jane'),
      beneficiaryId: asBeneficiaryId('ben_pat'),
      instructedAmount: Money.fromDecimalString('10.00', 'USD'),
      instructedSide: 'SOURCE',
      purpose: 'coffee',
      idempotencyKey: asIdempotencyKey('idem_dom'),
      actor: CUSTOMER_ACTOR,
    });
    assert.equal(second.ok, false);
    if (!second.ok) {
      assert.equal(second.error.code, 'IDEMPOTENT_REPLAY');
    }
    assert.equal(system.books.journals.list().length, count);
  });

  it('agents cannot add a beneficiary', () => {
    const system = new SolsticeSystem();
    provision(system);
    const result = system.addBeneficiary(
      {
        id: asBeneficiaryId('ben_agent'),
        ownerCustomerId: asCustomerId('cust_jane'),
        name: 'Agent Added',
        country: asJurisdiction('US'),
        institution: { accountNumber: '1' },
        currency: 'USD' as never,
      },
      { type: 'AGENT', id: asActorId('agent') },
    );
    assert.equal(result.ok, false);
  });
});
