import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asActorId, asCustomerId } from '@solstice/domain';
import {
  actorMaySubmit,
  ENVIRONMENT,
  LIVE_FLAGS,
  PERSONAL_DATA_CATEGORIES,
  PROOF_KINDS,
} from '@solstice/kernel';
import { LIVE_DATA_MARKET_ENABLED } from '@solstice/flags';

import { ACCESS_REQUEST_FIELDS, parseAccessRequest } from './purpose/access-request.ts';
import { PersonalDataFabric } from './fabric.ts';
import { MIN_COHORT_SIZE } from './clean-room/engine.ts';
import { SimulatedLocalKeyProvider } from './keys/simulated-local.ts';
import { rejectRealProvenance } from './provenance.ts';
import { rejectUnclassified } from './vault/record.ts';

const NOW = '2026-08-14T12:00:00.000Z';
const EXPIRY = '2026-12-31T00:00:00.000Z';
const SYSTEM = { type: 'SYSTEM' as const, id: asActorId('system') };
const CUSTOMER = {
  type: 'CUSTOMER' as const,
  id: asActorId('cust_actor'),
  customerId: asCustomerId('cust_jane'),
};
const BUYER = { type: 'OPERATOR' as const, id: asActorId('buyer_lab') };
const AGENT = { type: 'AGENT' as const, id: asActorId('agent_1') };

function wellnessRequest(overrides: Record<string, unknown> = {}) {
  return {
    requester: { id: 'buyer_lab', kind: 'BUYER', sessionId: 'sess_ok' },
    dataCategories: ['HEALTH'],
    purpose: 'WELLNESS_RESEARCH',
    jurisdiction: 'US',
    duration: { start: NOW, end: EXPIRY },
    legalBasis: 'CONSENT',
    ...overrides,
  };
}

function grantAll(fabric: PersonalDataFabric, subjects: readonly string[]) {
  for (const [index, subjectRef] of subjects.entries()) {
    fabric.grantConsent({
      actor: CUSTOMER,
      occurredAt: NOW,
      grant: {
        consentId: `cns_${String(index + 1).padStart(2, '0')}`,
        subjectRef,
        requesterId: 'buyer_lab',
        purpose: 'WELLNESS_RESEARCH',
        dataCategories: ['HEALTH'],
        identityExposureLevel: 'anonymous',
        start: NOW,
        expiry: EXPIRY,
        resalePermission: false,
        aiTrainingPermission: false,
        compensation: {
          indicativeMinorUnits: 1200n,
          currency: 'USD',
          presentation: 'INDICATIVE_COMPENSATION_NOT_A_PRICE',
        },
        revocability: true,
        jurisdiction: 'US',
        policyVersion: 'privacy-sim-v1',
        legalBasis: 'CONSENT',
      },
    });
  }
}

describe('flags and purpose proof', () => {
  it('LIVE_DATA_MARKET_ENABLED stays false and ENVIRONMENT is simulation', () => {
    assert.equal(LIVE_DATA_MARKET_ENABLED, false);
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_FLAGS.LIVE_DATA_MARKET_ENABLED, false);
  });

  it('PURPOSE is a first-class kernel proof kind', () => {
    assert.ok((PROOF_KINDS as readonly string[]).includes('PURPOSE'));
  });

  it('agents cannot grant, modify, or revoke consent', () => {
    assert.equal(actorMaySubmit('AGENT', 'GRANT_CONSENT'), false);
    assert.equal(actorMaySubmit('AGENT', 'MODIFY_CONSENT'), false);
    assert.equal(actorMaySubmit('AGENT', 'REVOKE_CONSENT'), false);
    assert.equal(actorMaySubmit('AGENT', 'STORE_PERSONAL_DATA'), false);
    assert.equal(actorMaySubmit('AGENT', 'RUN_CLEAN_ROOM'), false);
  });
});

describe('segmented vault keys', () => {
  it('provisions an independent key per category', () => {
    const keys = new SimulatedLocalKeyProvider('test-seed');
    const refs = PERSONAL_DATA_CATEGORIES.map((category) => keys.keyRefFor(category).keyId);
    assert.equal(new Set(refs).size, PERSONAL_DATA_CATEGORIES.length);
    const health = keys.wrap('HEALTH', Buffer.from('alpha'));
    const wellness = keys.wrap('WELLNESS', Buffer.from('alpha'));
    assert.notEqual(health.keyId, wellness.keyId);
    assert.throws(() => keys.unwrap('WELLNESS', health));
  });

  it('rejects unclassified and real writes', () => {
    assert.throws(() => rejectUnclassified({}));
    assert.throws(() => rejectRealProvenance('REAL'));
  });
});

describe('access request completeness', () => {
  for (const field of ACCESS_REQUEST_FIELDS) {
    it(`rejects a request missing ${field}`, () => {
      const raw: Record<string, unknown> = { ...wellnessRequest() };
      delete raw[field];
      const parsed = parseAccessRequest(raw);
      assert.equal(parsed.ok, false);
      if (!parsed.ok) {
        assert.equal(parsed.error.code, 'INCOMPLETE_ACCESS_REQUEST');
        assert.ok(parsed.error.missingFields.includes(field));
      }
    });
  }

  it('rejects a cross-category request', () => {
    const parsed = parseAccessRequest(wellnessRequest({ dataCategories: ['HEALTH', 'WELLNESS'] }));
    assert.equal(parsed.ok, false);
    if (!parsed.ok) {
      assert.equal(parsed.error.code, 'CROSS_CATEGORY_REQUEST');
    }
  });
});

describe('purpose firewall and clean room', () => {
  it('returns an authorized aggregate without raw records', () => {
    const fabric = new PersonalDataFabric();
    const subjects = fabric.subjectRefs(8);
    fabric.populateSynthetic({ subjectCount: 8, actor: SYSTEM, occurredAt: NOW, jurisdiction: 'US' });
    grantAll(fabric, subjects);
    const result = fabric.runCleanRoom({
      actor: BUYER,
      occurredAt: NOW,
      request: wellnessRequest(),
      query: { queryId: 'q1', metric: 'COUNT' },
      subjectRefs: subjects,
      sessionValid: true,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.rawRecordsReleased, false);
    assert.ok(result.value.cohortSize >= MIN_COHORT_SIZE);
    assert.equal(typeof result.value.resultHash, 'string');
    const serialized = JSON.stringify(result.value, (_key, inner) =>
      typeof inner === 'bigint' ? `${inner.toString()}n` : inner,
    );
    assert.equal(serialized.includes('SYNTH-SUBJECT-'), false);
  });

  it('refuses health-for-advertising even with a valid session and wellness consent', () => {
    const fabric = new PersonalDataFabric();
    const subjects = fabric.subjectRefs(8);
    fabric.populateSynthetic({ subjectCount: 8, actor: SYSTEM, occurredAt: NOW, jurisdiction: 'US' });
    grantAll(fabric, subjects);
    const result = fabric.runCleanRoom({
      actor: BUYER,
      occurredAt: NOW,
      request: wellnessRequest({ purpose: 'ADVERTISING' }),
      query: { queryId: 'q_ads', metric: 'COUNT' },
      subjectRefs: subjects,
      sessionValid: true,
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal('code' in result.error && result.error.code, 'PURPOSE_INCOMPATIBLE');
  });

  it('refuses credit, investment eligibility, and employment purposes for health', () => {
    const fabric = new PersonalDataFabric();
    const subjects = fabric.subjectRefs(8);
    fabric.populateSynthetic({ subjectCount: 8, actor: SYSTEM, occurredAt: NOW, jurisdiction: 'US' });
    grantAll(fabric, subjects);
    for (const purpose of ['CREDIT', 'INVESTMENT_ELIGIBILITY', 'EMPLOYMENT'] as const) {
      const result = fabric.runCleanRoom({
        actor: BUYER,
        occurredAt: NOW,
        request: wellnessRequest({ purpose }),
        query: { queryId: `q_${purpose}`, metric: 'COUNT' },
        subjectRefs: subjects,
        sessionValid: true,
      });
      assert.equal(result.ok, false, purpose);
    }
  });

  it('refuses a query that could isolate an individual', () => {
    const fabric = new PersonalDataFabric();
    const subjects = fabric.subjectRefs(8);
    fabric.populateSynthetic({ subjectCount: 8, actor: SYSTEM, occurredAt: NOW, jurisdiction: 'US' });
    for (const [index, subjectRef] of subjects.entries()) {
      fabric.grantConsent({
        actor: CUSTOMER,
        occurredAt: NOW,
        grant: {
          consentId: `cns_id_${String(index + 1).padStart(2, '0')}`,
          subjectRef,
          requesterId: 'buyer_lab',
          purpose: 'WELLNESS_RESEARCH',
          dataCategories: ['IDENTITY'],
          identityExposureLevel: 'anonymous',
          start: NOW,
          expiry: EXPIRY,
          resalePermission: false,
          aiTrainingPermission: false,
          compensation: {
            indicativeMinorUnits: 1n,
            currency: 'USD',
            presentation: 'INDICATIVE_COMPENSATION_NOT_A_PRICE',
          },
          revocability: true,
          jurisdiction: 'US',
          policyVersion: 'privacy-sim-v1',
          legalBasis: 'CONSENT',
        },
      });
    }
    const result = fabric.runCleanRoom({
      actor: BUYER,
      occurredAt: NOW,
      request: wellnessRequest({ dataCategories: ['IDENTITY'] }),
      query: {
        queryId: 'q_isolate',
        metric: 'COUNT',
        filterEquals: { displayName: 'SYNTH-Avery-Calder' },
      },
      subjectRefs: subjects,
      sessionValid: true,
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal('code' in result.error && result.error.code, 'ISOLATION_RISK');
  });

  it('refuses below-cohort queries', () => {
    const fabric = new PersonalDataFabric();
    const subjects = fabric.subjectRefs(8);
    fabric.populateSynthetic({ subjectCount: 8, actor: SYSTEM, occurredAt: NOW, jurisdiction: 'US' });
    grantAll(fabric, subjects);
    const result = fabric.runCleanRoom({
      actor: BUYER,
      occurredAt: NOW,
      request: wellnessRequest(),
      query: { queryId: 'q_small', metric: 'COUNT' },
      subjectRefs: subjects.slice(0, 3),
      sessionValid: true,
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal('code' in result.error && result.error.code, 'BELOW_COHORT');
  });

  it('depletes privacy budget and then blocks', () => {
    const fabric = new PersonalDataFabric();
    const subjects = fabric.subjectRefs(8);
    fabric.populateSynthetic({ subjectCount: 8, actor: SYSTEM, occurredAt: NOW, jurisdiction: 'US' });
    grantAll(fabric, subjects);
    const first = fabric.runCleanRoom({
      actor: BUYER,
      occurredAt: NOW,
      request: wellnessRequest(),
      query: { queryId: 'q_a', metric: 'COUNT' },
      subjectRefs: subjects,
      sessionValid: true,
    });
    const second = fabric.runCleanRoom({
      actor: BUYER,
      occurredAt: NOW,
      request: wellnessRequest(),
      query: { queryId: 'q_b', metric: 'COUNT' },
      subjectRefs: subjects,
      sessionValid: true,
    });
    const third = fabric.runCleanRoom({
      actor: BUYER,
      occurredAt: NOW,
      request: wellnessRequest(),
      query: { queryId: 'q_c', metric: 'COUNT' },
      subjectRefs: subjects,
      sessionValid: true,
    });
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(third.ok, false);
    if (!third.ok) {
      assert.equal('code' in third.error && third.error.code, 'PRIVACY_BUDGET_EXHAUSTED');
    }
  });

  it('revoked consent blocks the next access immediately', () => {
    const fabric = new PersonalDataFabric();
    const subjects = fabric.subjectRefs(8);
    fabric.populateSynthetic({ subjectCount: 8, actor: SYSTEM, occurredAt: NOW, jurisdiction: 'US' });
    grantAll(fabric, subjects);
    fabric.revokeConsent({
      actor: CUSTOMER,
      occurredAt: NOW,
      jurisdiction: 'US',
      consentId: 'cns_01',
    });
    const result = fabric.runCleanRoom({
      actor: BUYER,
      occurredAt: NOW,
      request: wellnessRequest(),
      query: { queryId: 'q_rev', metric: 'COUNT' },
      subjectRefs: subjects,
      sessionValid: true,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(
        result.error.code === 'CONSENT_REVOKED' || result.error.code === 'CONSENT_MISSING',
      );
    }
  });

  it('expired consent is unusable at access time without a sweep', () => {
    const fabric = new PersonalDataFabric();
    const subjects = fabric.subjectRefs(8);
    fabric.populateSynthetic({ subjectCount: 8, actor: SYSTEM, occurredAt: NOW, jurisdiction: 'US' });
    fabric.grantConsent({
      actor: CUSTOMER,
      occurredAt: NOW,
      grant: {
        consentId: 'cns_expired',
        subjectRef: subjects[0]!,
        requesterId: 'buyer_lab',
        purpose: 'WELLNESS_RESEARCH',
        dataCategories: ['HEALTH'],
        identityExposureLevel: 'anonymous',
        start: '2026-01-01T00:00:00.000Z',
        expiry: '2026-01-02T00:00:00.000Z',
        resalePermission: false,
        aiTrainingPermission: false,
        compensation: {
          indicativeMinorUnits: 1n,
          currency: 'USD',
          presentation: 'INDICATIVE_COMPENSATION_NOT_A_PRICE',
        },
        revocability: true,
        jurisdiction: 'US',
        policyVersion: 'privacy-sim-v1',
        legalBasis: 'CONSENT',
      },
    });
    const result = fabric.runCleanRoom({
      actor: BUYER,
      occurredAt: NOW,
      request: wellnessRequest(),
      query: { queryId: 'q_exp', metric: 'COUNT' },
      subjectRefs: [subjects[0]!],
      sessionValid: true,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'CONSENT_EXPIRED');
    }
  });

  it('consent changes append a version and never edit the prior record', () => {
    const fabric = new PersonalDataFabric();
    const subjects = fabric.subjectRefs(1);
    const first = fabric.grantConsent({
      actor: CUSTOMER,
      occurredAt: NOW,
      grant: {
        consentId: 'cns_mod',
        subjectRef: subjects[0]!,
        requesterId: 'buyer_lab',
        purpose: 'WELLNESS_RESEARCH',
        dataCategories: ['HEALTH'],
        identityExposureLevel: 'anonymous',
        start: NOW,
        expiry: EXPIRY,
        resalePermission: false,
        aiTrainingPermission: false,
        compensation: {
          indicativeMinorUnits: 1n,
          currency: 'USD',
          presentation: 'INDICATIVE_COMPENSATION_NOT_A_PRICE',
        },
        revocability: true,
        jurisdiction: 'US',
        policyVersion: 'privacy-sim-v1',
        legalBasis: 'CONSENT',
      },
    });
    const snapshot = { ...first };
    fabric.modifyConsent({
      actor: CUSTOMER,
      occurredAt: NOW,
      jurisdiction: 'US',
      modify: { consentId: 'cns_mod', changes: { policyVersion: 'privacy-sim-v2' } },
    });
    const history = fabric.consent.list().filter((row) => row.consentId === 'cns_mod');
    assert.ok(history.length >= 3);
    assert.equal(history[0]?.policyVersion, snapshot.policyVersion);
    assert.equal(history[0]?.versionNumber, 1);
    assert.equal(fabric.consent.latest('cns_mod')?.versionNumber, 2);
    assert.equal(fabric.consent.latest('cns_mod')?.policyVersion, 'privacy-sim-v2');
  });

  it('seals evidence on grant and deny and never writes raw attributes', () => {
    const fabric = new PersonalDataFabric();
    const subjects = fabric.subjectRefs(8);
    fabric.populateSynthetic({ subjectCount: 8, actor: SYSTEM, occurredAt: NOW, jurisdiction: 'US' });
    grantAll(fabric, subjects);
    fabric.runCleanRoom({
      actor: BUYER,
      occurredAt: NOW,
      request: wellnessRequest(),
      query: { queryId: 'q_ev', metric: 'COUNT' },
      subjectRefs: subjects,
      sessionValid: true,
    });
    fabric.runCleanRoom({
      actor: BUYER,
      occurredAt: NOW,
      request: wellnessRequest({ purpose: 'ADVERTISING' }),
      query: { queryId: 'q_ev_ads', metric: 'COUNT' },
      subjectRefs: subjects,
      sessionValid: true,
    });
    const records = fabric.kernel.vault.list();
    assert.ok(records.length > 0);
    assert.equal(fabric.kernel.vault.verifyChain().ok, true);
    for (const record of records) {
      const text = JSON.stringify(record.payload);
      assert.equal(text.includes('restingHeartBand'), false);
      assert.equal(text.includes('SYNTH-Avery'), false);
    }
  });

  it('blocks an agent from granting consent at the kernel', () => {
    const fabric = new PersonalDataFabric();
    assert.throws(() =>
      fabric.grantConsent({
        actor: AGENT,
        occurredAt: NOW,
        grant: {
          consentId: 'cns_agent',
          subjectRef: 'SYNTH-SUBJECT-0001',
          requesterId: 'buyer_lab',
          purpose: 'WELLNESS_RESEARCH',
          dataCategories: ['HEALTH'],
          identityExposureLevel: 'anonymous',
          start: NOW,
          expiry: EXPIRY,
          resalePermission: false,
          aiTrainingPermission: false,
          compensation: {
            indicativeMinorUnits: 1n,
            currency: 'USD',
            presentation: 'INDICATIVE_COMPENSATION_NOT_A_PRICE',
          },
          revocability: true,
          jurisdiction: 'US',
          policyVersion: 'privacy-sim-v1',
          legalBasis: 'CONSENT',
        },
      }),
    );
  });

  it('valuation is indicative and not a guaranteed price', () => {
    const fabric = new PersonalDataFabric();
    const quote = fabric.valueIndicative({
      category: 'HEALTH',
      purpose: 'WELLNESS_RESEARCH',
      identityExposureLevel: 'anonymous',
      durationDays: 30n,
      resalePermission: false,
      aiTrainingPermission: false,
    });
    assert.equal(quote.notAGuaranteedPrice, true);
    assert.equal(quote.presentation, 'INDICATIVE_COMPENSATION_NOT_A_PRICE');
    assert.equal(typeof quote.indicativeMinorUnits, 'bigint');
  });
});
