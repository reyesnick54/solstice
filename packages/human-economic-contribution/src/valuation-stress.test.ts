import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../../domain/src/time.ts';
import {
  applyCap,
  applyFloor,
  createSimulationValuationPolicy,
  engineWith,
  factorRequest,
  MAX_REFERENCE_MINOR_UNITS,
  multiplyBasisPoints,
  multiplyRational,
  referenceFor,
  VALUATION_NOW,
  verifyFixture,
} from './valuation/index.ts';
import { policyRuleRefFor } from './valuation/ids.ts';

describe('CHUNK-111 valuation simulation stress', () => {
  it('bounds large measurement quantities', () => {
    const contribution = verifyFixture('PROFESSIONAL_EXPERTISE', 'stress-large', 1_000_000n);
    const result = engineWith([referenceFor('PROFESSIONAL_SERVICE_SCHEDULE', 'stress-large', 1_000n)]).evaluate({
      contribution,
      policy: createSimulationValuationPolicy({
        methodCaps: { PROFESSIONAL_SERVICE_SCHEDULE: 50_000_000n },
        globalCap: 50_000_000n,
      }),
      valuationTimestamp: VALUATION_NOW,
    });
    assert.equal(result.state, 'VALUED_SIMULATION');
    assert.equal(result.baseReferenceValue, 1_000_000_000n);
    assert.equal(result.finalReferenceValue, 50_000_000n);
  });

  it('enforces the maximum cap and does not bypass it with later factors', () => {
    const contribution = verifyFixture('PROFESSIONAL_EXPERTISE', 'stress-cap', 8n);
    const result = engineWith([referenceFor('PROFESSIONAL_SERVICE_SCHEDULE', 'stress-cap', 10_000n)]).evaluate({
      contribution,
      policy: createSimulationValuationPolicy({
        methodCaps: { PROFESSIONAL_SERVICE_SCHEDULE: 25_000n },
        defaultFactors: [],
      }),
      valuationTimestamp: VALUATION_NOW,
      requestedFactors: [factorRequest('after-would-be-high', 20_000n, 'QUALITY')],
    });
    assert.equal(result.state, 'VALUATION_REJECTED');
    assert.deepEqual(result.reasonCodes, ['EXCESSIVE_FACTOR_PRODUCT']);
  });

  it('keeps small fractional basis-point effects exact', () => {
    assert.equal(multiplyBasisPoints(1_000_000n, 1n, 'ROUND_DOWN'), 100n);
    assert.equal(multiplyBasisPoints(3n, 1n, 'ROUND_DOWN'), 0n);
    assert.equal(multiplyBasisPoints(3n, 1n, 'ROUND_HALF_UP'), 0n);
    const contribution = verifyFixture('COMMUNITY_CONTRIBUTION', 'stress-bps', 3n);
    const result = engineWith([referenceFor('COMMUNITY_CONTRIBUTION_SCHEDULE', 'stress-bps', 1n)]).evaluate({
      contribution,
      policy: createSimulationValuationPolicy({ defaultFactors: [] }),
      valuationTimestamp: VALUATION_NOW,
      requestedFactors: [factorRequest('one-bp', 1n, 'FRESHNESS')],
    });
    assert.equal(result.baseReferenceValue, 3n);
    assert.equal(result.finalReferenceValue, 0n);
  });

  it('covers rounding boundaries for both governed rules', () => {
    assert.equal(multiplyRational(1n, 1n, 2n, 'ROUND_DOWN'), 0n);
    assert.equal(multiplyRational(1n, 1n, 2n, 'ROUND_HALF_UP'), 1n);
    assert.equal(multiplyRational(3n, 1n, 2n, 'ROUND_DOWN'), 1n);
    assert.equal(multiplyRational(3n, 1n, 2n, 'ROUND_HALF_UP'), 2n);
  });

  it('applies multiple explicit factors in order', () => {
    const contribution = verifyFixture('PROFESSIONAL_EXPERTISE', 'stress-factors', 10n);
    const result = engineWith([referenceFor('PROFESSIONAL_SERVICE_SCHEDULE', 'stress-factors', 1_000n)]).evaluate({
      contribution,
      policy: createSimulationValuationPolicy({ defaultFactors: [] }),
      valuationTimestamp: VALUATION_NOW,
      requestedFactors: [
        factorRequest('quality', 8_000n, 'QUALITY'),
        factorRequest('realization', 5_000n, 'REALIZATION'),
      ],
    });
    assert.equal(result.state, 'VALUED_SIMULATION');
    assert.equal(result.baseReferenceValue, 10_000n);
    assert.equal(result.finalReferenceValue, 4_000n);
    assert.equal(result.adjustments.length, 2);
    assert.equal(result.adjustments[0]?.after, 8_000n);
    assert.equal(result.adjustments[1]?.after, 4_000n);
  });

  it('allows a zero final value without inventing a substitute', () => {
    const contribution = verifyFixture('COMMUNITY_CONTRIBUTION', 'stress-zero', 1n);
    const result = engineWith([referenceFor('COMMUNITY_CONTRIBUTION_SCHEDULE', 'stress-zero', 0n)]).evaluate({
      contribution,
      policy: createSimulationValuationPolicy(),
      valuationTimestamp: VALUATION_NOW,
    });
    assert.equal(result.state, 'VALUED_SIMULATION');
    assert.equal(result.finalReferenceValue, 0n);
    assert.ok(result.reasonCodes.includes('ZERO_VALUE'));
  });

  it('rejects negative prohibited input', () => {
    const contribution = verifyFixture('PROFESSIONAL_EXPERTISE', 'stress-neg', 2n);
    const result = engineWith([referenceFor('PROFESSIONAL_SERVICE_SCHEDULE', 'stress-neg', -5_000n)]).evaluate({
      contribution,
      policy: createSimulationValuationPolicy(),
      valuationTimestamp: VALUATION_NOW,
    });
    assert.equal(result.state, 'VALUATION_REJECTED');
    assert.deepEqual(result.reasonCodes, ['NEGATIVE_VALUE_FORBIDDEN']);
    assert.equal(result.finalReferenceValue, null);
  });

  it('reviews very old reference data', () => {
    const contribution = verifyFixture('RESEARCH_PARTICIPATION', 'stress-old', 2n);
    const result = engineWith([
      referenceFor('RESEARCH_PARTICIPATION_SCHEDULE', 'stress-old', 800n, {
        observedAt: asUtcInstant('1999-01-01T00:00:00.000Z'),
        effectiveAt: asUtcInstant('1999-01-01T00:00:00.000Z'),
      }),
    ]).evaluate({
      contribution,
      policy: createSimulationValuationPolicy(),
      valuationTimestamp: VALUATION_NOW,
    });
    assert.equal(result.state, 'VALUATION_REVIEW_REQUIRED');
    assert.deepEqual(result.reasonCodes, ['REFERENCE_STALE']);
  });

  it('reviews conflicting reference data instead of averaging', () => {
    const contribution = verifyFixture('CREATIVE_PRODUCTION', 'stress-conflict', 2n);
    const result = engineWith([
      referenceFor('GOVERNED_FIXED_SCHEDULE', 'stress-conflict-a', 700n),
      referenceFor('GOVERNED_FIXED_SCHEDULE', 'stress-conflict-b', 900n),
    ]).evaluate({
      contribution,
      policy: createSimulationValuationPolicy(),
      valuationTimestamp: VALUATION_NOW,
    });
    assert.equal(result.state, 'VALUATION_REVIEW_REQUIRED');
    assert.deepEqual(result.reasonCodes, ['REFERENCE_CONFLICT']);
    assert.equal(result.finalReferenceValue, null);
  });

  it('rejects overflow-scale intermediates and keeps cap/floor helpers exact', () => {
    assert.equal(applyCap(MAX_REFERENCE_MINOR_UNITS, 10n).value, 10n);
    assert.equal(applyFloor(1n, 10n).value, 10n);
    const contribution = verifyFixture('PROFESSIONAL_EXPERTISE', 'stress-overflow', 2n);
    const result = engineWith([
      referenceFor('PROFESSIONAL_SERVICE_SCHEDULE', 'stress-overflow', MAX_REFERENCE_MINOR_UNITS),
    ]).evaluate({
      contribution,
      policy: createSimulationValuationPolicy(),
      valuationTimestamp: VALUATION_NOW,
    });
    assert.equal(result.state, 'VALUATION_REJECTED');
    assert.deepEqual(result.reasonCodes, ['INTEGER_OVERFLOW']);
  });

  it('rejects a self-referential market reference', () => {
    const contribution = verifyFixture('ECONOMIC_PARTICIPATION', 'stress-self', 2n);
    const result = engineWith([
      referenceFor('MARKET_REFERENCE', 'stress-self', 2_200n, {
        relatedContributionId: contribution.contributionId,
      }),
    ]).evaluate({
      contribution,
      policy: createSimulationValuationPolicy(),
      valuationTimestamp: VALUATION_NOW,
    });
    assert.equal(result.state, 'VALUATION_REJECTED');
    assert.deepEqual(result.reasonCodes, ['SELF_REFERENTIAL_MARKET_REFERENCE']);
  });

  it('rejects a hidden factor that is not on the policy allow-list', () => {
    const contribution = verifyFixture('PROFESSIONAL_EXPERTISE', 'stress-hidden', 2n);
    const result = engineWith([referenceFor('PROFESSIONAL_SERVICE_SCHEDULE', 'stress-hidden', 5_000n)]).evaluate({
      contribution,
      policy: createSimulationValuationPolicy({ allowedFactors: ['QUALITY'] }),
      valuationTimestamp: VALUATION_NOW,
      requestedFactors: [
        {
          factorType: 'USAGE',
          inputRef: 'factor:hidden',
          numerator: 1n,
          denominator: 1n,
          basisPoints: 10_000n,
          reasonCode: 'FORBIDDEN_FACTOR',
          policyRuleRef: policyRuleRefFor('hidden'),
        },
      ],
    });
    assert.equal(result.state, 'VALUATION_REJECTED');
    assert.deepEqual(result.reasonCodes, ['FORBIDDEN_FACTOR']);
  });
});
