import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  asActionIntentId,
  asActorId,
  asBeneficiaryId,
  asCurrencyCode,
  asCustomerId,
  asIdempotencyKey,
  asJurisdiction,
  asLegalEntityId,
  asResidency,
  asUtcInstant,
  createProspect,
  Money,
  notStartedVerification,
} from '@solstice/domain';

import { freezeIntent } from './action-intent.ts';
import { ENVIRONMENT, LIVE_FLAGS } from './flags.ts';
import { ComplianceKernel } from './kernel.ts';
import { assertNoCounselConfirmed, loadPacks } from './policy/evaluate.ts';
import { assertNoPyrCounselConfirmed, isPyrCapabilityEnabled, PYR_CAPABILITIES } from './policy/pyr-registry.ts';
import { actorMaySubmit } from './capabilities.ts';

const NOW = asUtcInstant('2026-08-13T15:00:00.000Z');

describe('LIVE flags', () => {
  it('every LIVE_* flag is false and ENVIRONMENT is simulation', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    for (const [name, value] of Object.entries(LIVE_FLAGS)) {
      assert.equal(value, false, `${name} must stay false`);
    }
  });
});

describe('jurisdiction packs', () => {
  it('no rule is CONFIRMED_BY_COUNSEL', () => {
    assert.doesNotThrow(() => assertNoCounselConfirmed());
    for (const pack of loadPacks()) {
      for (const rule of pack.rules) {
        assert.notEqual(rule.legalReviewState, 'CONFIRMED_BY_COUNSEL');
      }
    }
  });

  it('RESEARCH_REQUIRED rules are disabled', () => {
    const research = loadPacks()
      .flatMap((pack) => pack.rules)
      .filter((rule) => rule.legalReviewState === 'RESEARCH_REQUIRED');
    assert.ok(research.length > 0);
    for (const rule of research) {
      assert.equal(rule.enabled, false);
    }
  });
});

describe('PYR registry', () => {
  it('confirms no counsel-confirmed entry and every capability disabled', () => {
    assert.doesNotThrow(() => assertNoPyrCounselConfirmed());
    for (const country of ['US', 'EU', 'GB', 'SA', 'AE']) {
      for (const capability of PYR_CAPABILITIES) {
        assert.equal(isPyrCapabilityEnabled(country, capability), false);
      }
    }
  });
});

describe('agent capabilities', () => {
  it('agents cannot add or modify a beneficiary', () => {
    assert.equal(actorMaySubmit('AGENT', 'ADD_BENEFICIARY'), false);
    assert.equal(actorMaySubmit('AGENT', 'UPDATE_BENEFICIARY'), false);
    assert.equal(actorMaySubmit('AGENT', 'SEND_PAYMENT'), false);
  });
});

describe('ComplianceKernel', () => {
  it('authorizes a customer create for SYSTEM and seals evidence', () => {
    const kernel = new ComplianceKernel();
    const prospect = createProspect({
      id: asCustomerId('cust_k'),
      legalEntityId: asLegalEntityId('le_us'),
      jurisdiction: asJurisdiction('US'),
      residency: asResidency('US'),
      verification: notStartedVerification(asUtcInstant('2027-01-01T00:00:00.000Z')),
      createdAt: NOW,
    });
    const result = kernel.evaluate(
      freezeIntent({
        id: asActionIntentId('int_1'),
        kind: 'CREATE_CUSTOMER',
        actor: { type: 'SYSTEM', id: asActorId('system') },
        payload: {
          id: prospect.id,
          legalEntityId: prospect.legalEntityId,
          jurisdiction: prospect.jurisdiction,
          residency: prospect.residency,
          verification: prospect.verification,
          createdAt: prospect.createdAt,
        },
        idempotencyKey: asIdempotencyKey('idem_cust_1'),
        occurredAt: NOW,
        sourceJurisdiction: 'US',
      }),
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.outcome, 'AUTHORIZED');
    if (result.value.outcome === 'AUTHORIZED') {
      assert.equal(result.value.authorization.kind, 'CREATE_CUSTOMER');
      assert.equal(result.value.evidence.seq, 1);
    }
  });

  it('blocks an agent from adding a beneficiary and still seals evidence', () => {
    const kernel = new ComplianceKernel();
    const result = kernel.evaluate(
      freezeIntent({
        id: asActionIntentId('int_agent'),
        kind: 'ADD_BENEFICIARY',
        actor: { type: 'AGENT', id: asActorId('agent_1') },
        payload: {
          id: asBeneficiaryId('ben_x'),
          ownerCustomerId: asCustomerId('cust_k'),
          name: 'Ahmed',
          country: asJurisdiction('DE'),
          institution: { iban: 'DE001', bic: 'COBADEFF' },
          currency: asCurrencyCode('EUR'),
        },
        idempotencyKey: asIdempotencyKey('idem_agent_ben'),
        occurredAt: NOW,
        sourceJurisdiction: 'US',
        destinationJurisdiction: 'DE',
      }),
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.outcome, 'REFUSED');
    if (result.value.outcome === 'REFUSED') {
      assert.equal(result.value.posture, 'BLOCK');
      assert.equal(result.value.evidence.seq, 1);
    }
  });

  it('HOLD/BLOCK sanctions refuse execution and seal evidence', () => {
    const kernel = new ComplianceKernel();
    const blocked = kernel.evaluate(
      freezeIntent({
        id: asActionIntentId('int_pay_block'),
        kind: 'SEND_PAYMENT',
        actor: { type: 'CUSTOMER', id: asActorId('cust_actor'), customerId: asCustomerId('cust_k') },
        payload: {
          sourceCustomerId: asCustomerId('cust_k'),
          beneficiaryId: asBeneficiaryId('ben_1'),
          instructedAmount: Money.fromDecimalString('5000.00', 'EUR'),
          instructedSide: 'DESTINATION',
          purpose: 'family',
          screening: {
            senderName: 'Jane Customer',
            receiverName: 'Blocked Person',
            beneficialOwnerName: 'Blocked Person',
            destinationCountry: 'DE',
          },
        },
        idempotencyKey: asIdempotencyKey('idem_block'),
        occurredAt: NOW,
        sourceJurisdiction: 'US',
        destinationJurisdiction: 'DE',
      }),
    );
    assert.equal(blocked.ok, true);
    if (!blocked.ok) return;
    assert.equal(blocked.value.outcome, 'REFUSED');
    if (blocked.value.outcome === 'REFUSED') {
      assert.equal(blocked.value.posture, 'BLOCK');
      assert.ok(blocked.value.evidence.recordSha256.length === 64);
    }

    const held = kernel.evaluate(
      freezeIntent({
        id: asActionIntentId('int_pay_hold'),
        kind: 'SEND_PAYMENT',
        actor: { type: 'CUSTOMER', id: asActorId('cust_actor'), customerId: asCustomerId('cust_k') },
        payload: {
          sourceCustomerId: asCustomerId('cust_k'),
          beneficiaryId: asBeneficiaryId('ben_2'),
          instructedAmount: Money.fromDecimalString('5000.00', 'EUR'),
          instructedSide: 'DESTINATION',
          purpose: 'family',
          screening: {
            senderName: 'Jane Customer',
            receiverName: 'Hold Person',
            beneficialOwnerName: 'Hold Person',
            destinationCountry: 'DE',
          },
        },
        idempotencyKey: asIdempotencyKey('idem_hold'),
        occurredAt: NOW,
        sourceJurisdiction: 'US',
        destinationJurisdiction: 'DE',
      }),
    );
    assert.equal(held.ok, true);
    if (!held.ok) return;
    assert.equal(held.value.outcome, 'REFUSED');
    if (held.value.outcome === 'REFUSED') {
      assert.equal(held.value.posture, 'HOLD');
    }
  });
});
