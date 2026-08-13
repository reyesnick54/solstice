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
import { SolsticeSystem } from './system.ts';

const NOW = asUtcInstant('2026-08-13T15:00:00.000Z');
const SYSTEM = { type: 'SYSTEM' as const, id: asActorId('system') };
const CUSTOMER_ACTOR = {
  type: 'CUSTOMER' as const,
  id: asActorId('jane'),
  customerId: asCustomerId('cust_jane'),
};

describe('Phase 3 exit: cross-border transfer with scored route and evidence', () => {
  it('completes USD→EUR to Ahmed with reconstructable routing evidence', () => {
    const system = new SolsticeSystem();
    system.bootstrap();
    const created = system.createCustomer(
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
    assert.equal(created.ok, true);
    assert.equal(
      system.openAccount({
        accountId: asAccountId('jane_usd'),
        ownerCustomerId: asCustomerId('cust_jane'),
        currency: 'USD',
        accountClass: 'deposits',
        actor: SYSTEM,
      }).ok,
      true,
    );
    assert.equal(
      system.openAccount({
        accountId: asAccountId('jane_eur'),
        ownerCustomerId: asCustomerId('cust_jane'),
        currency: 'EUR',
        accountClass: 'deposits',
        actor: SYSTEM,
      }).ok,
      true,
    );
    assert.equal(
      system.seedCredit(
        asAccountId('jane_usd'),
        Money.fromDecimalString('20000.00', 'USD'),
        SYSTEM,
      ).ok,
      true,
    );
    assert.equal(
      system.seedCredit(
        asAccountId('jane_eur'),
        Money.fromDecimalString('100.00', 'EUR'),
        SYSTEM,
      ).ok,
      true,
    );
    assert.equal(
      system.addBeneficiary(
        {
          id: asBeneficiaryId('ben_ahmed'),
          ownerCustomerId: asCustomerId('cust_jane'),
          name: 'Ahmed',
          country: asJurisdiction('DE'),
          institution: { iban: 'DE89370400440532013000', bic: 'COBADEFFXXX' },
          currency: 'EUR' as never,
        },
        CUSTOMER_ACTOR,
      ).ok,
      true,
    );

    const result = system.sendPayment({
      customerId: asCustomerId('cust_jane'),
      beneficiaryId: asBeneficiaryId('ben_ahmed'),
      instructedAmount: Money.fromDecimalString('5000.00', 'EUR'),
      instructedSide: 'DESTINATION',
      purpose: 'family support',
      idempotencyKey: asIdempotencyKey('phase3_ahmed'),
      actor: CUSTOMER_ACTOR,
    });
    assert.equal(result.ok, true, result.ok ? '' : JSON.stringify(result.error));
    if (!result.ok) return;

    assert.equal(result.value.payment?.state, 'SETTLED');
    assert.ok(result.value.routing?.chosen);
    assert.ok((result.value.routing?.ranked.length ?? 0) >= 1);
    const evidenceKinds = system.kernel.vault.list().map((row) => row.payload.kind);
    assert.ok(evidenceKinds.includes('kernel.screened'));
    assert.ok(evidenceKinds.includes('kernel.execution_authority'));
    assert.ok(evidenceKinds.includes('payment.routed'));
    assert.ok(evidenceKinds.includes('payment.settled'));
    assert.equal(system.kernel.vault.verifyChain().ok, true);
    assert.equal(system.reconcile(result.value.payment?.id ?? '').matched, true);

    const blended = system.books.blendedTotal(asCustomerId('cust_jane'), undefined);
    assert.equal(blended.ok, false);
  });
});
