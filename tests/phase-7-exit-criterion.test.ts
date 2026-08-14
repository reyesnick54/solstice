import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asCustomerId } from '../packages/domain/src/customer.ts';
import { asActorId } from '../packages/domain/src/ids.ts';
import { LIVE_DATA_MARKET_ENABLED } from '../packages/flags/src/capabilities.ts';
import { PersonalDataFabric } from '../packages/data-fabric/src/fabric.ts';
import { MIN_COHORT_SIZE } from '../packages/data-fabric/src/clean-room/engine.ts';
import { FORBIDDEN_ACTIONS } from '../packages/contracts/src/proposal-types.ts';

const NOW = '2026-08-14T12:00:00.000Z';
const EXPIRY = '2026-12-31T00:00:00.000Z';
const SYSTEM = { type: 'SYSTEM' as const, id: asActorId('system') };
const CUSTOMER = {
  type: 'CUSTOMER' as const,
  id: asActorId('jane'),
  customerId: asCustomerId('cust_jane'),
};
const BUYER = { type: 'OPERATOR' as const, id: asActorId('buyer_lab') };

describe('Phase 7 exit: authorized aggregate, raw data never leaves', () => {
  it('meets the phase 7 criterion', () => {
    assert.equal(LIVE_DATA_MARKET_ENABLED, false);
    assert.ok(FORBIDDEN_ACTIONS.includes('GRANT_CONSENT'));
    assert.ok(FORBIDDEN_ACTIONS.includes('MODIFY_CONSENT'));
    assert.ok(FORBIDDEN_ACTIONS.includes('REVOKE_CONSENT'));

    const fabric = new PersonalDataFabric();
    const subjects = fabric.subjectRefs(8);
    fabric.populateSynthetic({
      subjectCount: 8,
      actor: SYSTEM,
      occurredAt: NOW,
      jurisdiction: 'US',
    });
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

    const request = {
      requester: { id: 'buyer_lab', kind: 'BUYER' as const, sessionId: 'sess_ok' },
      dataCategories: ['HEALTH'] as const,
      purpose: 'WELLNESS_RESEARCH' as const,
      jurisdiction: 'US',
      duration: { start: NOW, end: EXPIRY },
      legalBasis: 'CONSENT' as const,
    };

    const allowed = fabric.runCleanRoom({
      actor: BUYER,
      occurredAt: NOW,
      request,
      query: { queryId: 'phase7_count', metric: 'COUNT' },
      subjectRefs: subjects,
      sessionValid: true,
    });
    assert.equal(allowed.ok, true);
    if (!allowed.ok) return;
    assert.equal(allowed.value.rawRecordsReleased, false);
    assert.ok(allowed.value.cohortSize >= MIN_COHORT_SIZE);
    const serialized = JSON.stringify(allowed.value, (_key, inner) =>
      typeof inner === 'bigint' ? `${inner.toString()}n` : inner,
    );
    assert.equal(serialized.includes('SYNTH-SUBJECT-'), false);

    const ads = fabric.runCleanRoom({
      actor: BUYER,
      occurredAt: NOW,
      request: { ...request, purpose: 'ADVERTISING' },
      query: { queryId: 'phase7_ads', metric: 'COUNT' },
      subjectRefs: subjects,
      sessionValid: true,
    });
    assert.equal(ads.ok, false);

    const chain = fabric.kernel.vault.verifyChain();
    assert.equal(chain.ok, true);
    for (const record of fabric.kernel.vault.list()) {
      const text = JSON.stringify(record.payload);
      assert.equal(text.includes('restingHeartBand'), false);
    }
  });
});
