import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { asCustomerId } from '@solstice/domain';
import { asUnverifiedSponsor, asVerifiedSponsor } from './sponsor.ts';
import { EligibilityVault } from './vault.ts';
import { matchWithoutIdentities } from './matching.ts';
import { buildMarketSignal, type PyramidDataIndexHasNoForwardPrice } from './pdi.ts';
import type { DataRequest } from './request.ts';

describe('data exchange matching', () => {
  it('returns a count to the buyer and no individual identities', () => {
    const vault = new EligibilityVault();
    const jane = asCustomerId('cust_jane');
    const maya = asCustomerId('cust_maya');
    vault.put({
      customerId: jane,
      jurisdiction: 'US',
      eligibleCategories: ['WELLNESS'],
      cohortTokens: ['adult'],
    });
    vault.put({
      customerId: maya,
      jurisdiction: 'US',
      eligibleCategories: ['WELLNESS'],
      cohortTokens: ['adult'],
    });
    const sponsor = asVerifiedSponsor({
      id: 'sponsor_x',
      legalName: 'Demo Lab',
      verificationRef: 'kyc_x',
    });
    assert.equal(sponsor.ok, true);
    if (!sponsor.ok) return;
    const request = {
      id: 'req_1',
      sponsor: sponsor.value,
      dataCategories: ['WELLNESS'],
      cohortCriteria: ['adult'],
      purpose: 'research',
      jurisdiction: 'US',
      duration: 'P30D',
      identityExposureLevel: 'NONE',
      compensationMinorUnits: 100n,
      legalTermsRef: 't1',
      publishedAt: '2026-08-14T16:00:00.000Z',
    } as DataRequest;
    const { buyerView, opportunities } = matchWithoutIdentities(request, vault);
    assert.equal(buyerView.eligibleCount, 2n);
    assert.equal('customerId' in buyerView, false);
    const buyerJson = JSON.stringify(buyerView, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    );
    assert.equal(buyerJson.includes('cust_jane'), false);
    assert.equal(buyerJson.includes('cust_maya'), false);
    assert.equal(opportunities.length, 2);
  });

  it('cannot treat an unverified sponsor as verified', () => {
    const unverified = asUnverifiedSponsor({ id: 's_bad', legalName: 'Nope' });
    assert.equal(unverified.verified, false);
    const missing = asVerifiedSponsor({ id: 's_bad', legalName: 'Nope', verificationRef: '' });
    assert.equal(missing.ok, false);
  });
});

describe('Pyramid Data Index', () => {
  it('is labeled MARKET_SIGNAL and has no forward-price field', () => {
    const lock: PyramidDataIndexHasNoForwardPrice = true;
    assert.equal(lock, true);
    const index = buildMarketSignal({
      requestCount: 1n,
      availableContributorCount: 2n,
      geographicDemand: [{ jurisdiction: 'US', requestCount: 1n }],
      categoryDemand: [{ category: 'WELLNESS', requestCount: 1n }],
      historicalClearingPrices: [
        {
          requestId: 'req_1',
          compensationMinorUnits: 5000n,
          asset: 'PYR',
          settledAt: '2026-08-14T16:00:00.000Z',
        },
      ],
    });
    assert.equal(index.kind, 'MARKET_SIGNAL');
    assert.equal('forwardPrice' in index, false);
    assert.equal('expectedValue' in index, false);
    assert.equal('forecast' in index, false);
    assert.equal('projectedPrice' in index, false);
    assert.equal(index.averageCompensationMinorUnits, 5000n);
  });
});
