import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  asActionIntentId,
  asActorId,
  asCustomerId,
  asIdempotencyKey,
  asUtcInstant,
} from '@solstice/domain';
import { ComplianceKernel, freezeIntent } from '@solstice/kernel';
import { ConsentLedger } from './ledger.ts';

const NOW = asUtcInstant('2026-08-14T16:00:00.000Z');

describe('Consent Ledger', () => {
  it('revocation before completion makes consent inactive', () => {
    const kernel = new ComplianceKernel();
    const ledger = new ConsentLedger();
    const customerId = asCustomerId('cust_rev');
    const offered = ledger.offer({
      id: 'consent_rev',
      customerId,
      requestId: 'req_1',
      categories: ['WELLNESS'],
      purpose: 'research',
      jurisdiction: 'US',
      offeredAt: NOW,
    });
    const grant = kernel.evaluate(
      freezeIntent({
        id: asActionIntentId('int_g'),
        kind: 'GRANT_CONSENT',
        actor: { type: 'CUSTOMER', id: asActorId('cust_rev'), customerId },
        payload: { consentId: offered.id },
        idempotencyKey: asIdempotencyKey('idem_g'),
        occurredAt: NOW,
        sourceJurisdiction: 'US',
      }),
    );
    assert.equal(grant.ok && grant.value.outcome === 'AUTHORIZED', true);
    if (!grant.ok || grant.value.outcome !== 'AUTHORIZED') return;
    const granted = ledger.grantConsent(grant.value.authorization, offered.id, NOW);
    assert.equal(granted.ok, true);
    assert.equal(ledger.isActive(offered.id), true);
    const rev = kernel.evaluate(
      freezeIntent({
        id: asActionIntentId('int_r'),
        kind: 'REVOKE_CONSENT',
        actor: { type: 'CUSTOMER', id: asActorId('cust_rev'), customerId },
        payload: { consentId: offered.id },
        idempotencyKey: asIdempotencyKey('idem_r'),
        occurredAt: NOW,
        sourceJurisdiction: 'US',
      }),
    );
    assert.equal(rev.ok && rev.value.outcome === 'AUTHORIZED', true);
    if (!rev.ok || rev.value.outcome !== 'AUTHORIZED') return;
    const revoked = ledger.revokeConsent(rev.value.authorization, offered.id, NOW);
    assert.equal(revoked.ok, true);
    assert.equal(ledger.isActive(offered.id), false);
  });
});
