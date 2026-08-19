import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../../domain/src/time.ts';
import { fixtureContribution } from './fixtures.ts';
import { evidenceRefFor, policyDecisionRefFor } from './ids.ts';
import { HumanContributionRegistry } from './registry.ts';
import {
  createSimulationValuationPolicy,
  engineWith,
  factorRequest,
  HumanContributionValuationEngine,
  InMemoryValuationReferenceDataPort,
  multiplyBasisPoints,
  multiplyRational,
  outcomePolicy,
  referenceFor,
  VALUATION_INVARIANTS,
  VALUATION_NOW,
  verifyFixture,
} from './valuation/index.ts';
import { policyRuleRefFor, valuationPolicyVersionFor } from './valuation/ids.ts';
import type { FactorRequest } from './valuation/types.ts';

function assertSimulationInvariants(result: { readonly invariants: typeof VALUATION_INVARIANTS; readonly finalReferenceValue: bigint | null }): void {
  assert.equal(result.invariants.isHumanWorthScore, false);
  assert.equal(result.invariants.isPeveScore, false);
  assert.equal(result.invariants.isCreditScore, false);
  assert.equal(result.invariants.isSunReyQuantity, false);
  assert.equal(result.invariants.createsMintAuthority, false);
  assert.equal(result.invariants.createsExecutionAuthority, false);
  assert.equal(result.invariants.productionEligible, false);
  assert.equal(result.invariants.isSettlementAuthorization, false);
  assert.equal('sunReyQuantity' in result, false);
}

describe('CHUNK-111 human contribution valuation engine', () => {
  it('1. values contractual compensation from a validated contractual reference', () => {
    const contribution = verifyFixture('ENTREPRENEURIAL_ACTIVITY', 'val-contract', 4n);
    const engine = engineWith([referenceFor('CONTRACTUAL_COMPENSATION', 'val-contract', 12_500n)]);
    const result = engine.evaluate({
      contribution,
      policy: createSimulationValuationPolicy(),
      valuationTimestamp: VALUATION_NOW,
    });
    assert.equal(result.state, 'VALUED_SIMULATION');
    assert.equal(result.valuationMethod, 'CONTRACTUAL_COMPENSATION');
    assert.equal(result.baseReferenceValue, 12_500n);
    assert.equal(result.finalReferenceValue, 12_500n);
    assert.equal(result.referenceDenomination, 'SIMULATION_REFERENCE_MINOR_UNIT');
  });

  it('2. values information usage from the active usage schedule', () => {
    const contribution = verifyFixture('INFORMATION_RIGHT_CONTRIBUTION', 'val-info', 3n);
    const engine = engineWith([referenceFor('INFORMATION_USAGE_RIGHT_SCHEDULE', 'val-info', 400n)]);
    const result = engine.evaluate({
      contribution,
      policy: createSimulationValuationPolicy(),
      valuationTimestamp: VALUATION_NOW,
    });
    assert.equal(result.state, 'VALUED_SIMULATION');
    assert.equal(result.valuationMethod, 'INFORMATION_USAGE_RIGHT_SCHEDULE');
    assert.equal(result.finalReferenceValue, 1_200n);
  });

  it('3. values professional service as measurement times governed rate', () => {
    const contribution = verifyFixture('PROFESSIONAL_EXPERTISE', 'val-pro', 6n);
    const engine = engineWith([referenceFor('PROFESSIONAL_SERVICE_SCHEDULE', 'val-pro', 5_000n)]);
    const result = engine.evaluate({
      contribution,
      policy: createSimulationValuationPolicy(),
      valuationTimestamp: VALUATION_NOW,
      requestedFactors: [factorRequest('quality-90', 9_000n, 'QUALITY')],
    });
    assert.equal(result.state, 'VALUED_SIMULATION');
    assert.equal(result.baseReferenceValue, 30_000n);
    assert.equal(result.finalReferenceValue, 27_000n);
    assert.equal(result.adjustments.some((item) => item.factor.factorType === 'QUALITY'), true);
  });

  it('4. values creative royalty from verified royalty basis and governed terms', () => {
    const contribution = verifyFixture('CREATOR_ROYALTY_EVENT', 'val-royalty', 1n);
    const engine = engineWith([
      referenceFor('CREATOR_ROYALTY_SCHEDULE', 'val-royalty', 80_000n, { royaltyBasisPoints: 1_250n }),
    ]);
    const result = engine.evaluate({
      contribution,
      policy: createSimulationValuationPolicy(),
      valuationTimestamp: VALUATION_NOW,
    });
    assert.equal(result.state, 'VALUED_SIMULATION');
    assert.equal(result.finalReferenceValue, 10_000n);
  });

  it('5. values research participation from the research schedule', () => {
    const contribution = verifyFixture('RESEARCH_PARTICIPATION', 'val-research', 5n);
    const engine = engineWith([referenceFor('RESEARCH_PARTICIPATION_SCHEDULE', 'val-research', 800n)]);
    const result = engine.evaluate({
      contribution,
      policy: createSimulationValuationPolicy(),
      valuationTimestamp: VALUATION_NOW,
    });
    assert.equal(result.state, 'VALUED_SIMULATION');
    assert.equal(result.finalReferenceValue, 4_000n);
  });

  it('6. values community contribution from the governed event schedule', () => {
    const contribution = verifyFixture('COMMUNITY_CONTRIBUTION', 'val-community', 2n);
    const engine = engineWith([referenceFor('COMMUNITY_CONTRIBUTION_SCHEDULE', 'val-community', 150n)]);
    const result = engine.evaluate({
      contribution,
      policy: createSimulationValuationPolicy(),
      valuationTimestamp: VALUATION_NOW,
    });
    assert.equal(result.state, 'VALUED_SIMULATION');
    assert.equal(result.finalReferenceValue, 300n);
  });

  it('7. values market reference from an approved snapshot, not live HTTP', () => {
    const contribution = verifyFixture('ECONOMIC_PARTICIPATION', 'val-market', 2n);
    const engine = engineWith([referenceFor('MARKET_REFERENCE', 'val-market', 2_200n)]);
    const result = engine.evaluate({
      contribution,
      policy: createSimulationValuationPolicy(),
      valuationTimestamp: VALUATION_NOW,
    });
    assert.equal(result.state, 'VALUED_SIMULATION');
    assert.equal(result.valuationMethod, 'MARKET_REFERENCE');
    assert.equal(result.finalReferenceValue, 4_400n);
  });

  it('8. applies verified outcome attribution only when explicit evidence exists', () => {
    const contribution = verifyFixture('RESEARCH_PARTICIPATION', 'val-outcome-yes', 2n);
    const engine = engineWith([referenceFor('VERIFIED_OUTCOME_ATTRIBUTION', 'val-outcome-yes', 3_000n)]);
    const result = engine.evaluate({
      contribution,
      policy: outcomePolicy(),
      valuationTimestamp: VALUATION_NOW,
      outcomeEvidenceRefs: [evidenceRefFor('outcome-yes')],
      attributionPolicyRef: policyDecisionRefFor('outcome-policy'),
    });
    assert.equal(result.state, 'VALUED_SIMULATION');
    assert.equal(result.valuationMethod, 'VERIFIED_OUTCOME_ATTRIBUTION');
    assert.equal(result.finalReferenceValue, 6_000n);
  });

  it('9. rejects outcome attribution without explicit evidence', () => {
    const contribution = verifyFixture('RESEARCH_PARTICIPATION', 'val-outcome-no', 2n);
    const engine = engineWith([referenceFor('VERIFIED_OUTCOME_ATTRIBUTION', 'val-outcome-no', 3_000n)]);
    const result = engine.evaluate({
      contribution,
      policy: outcomePolicy(),
      valuationTimestamp: VALUATION_NOW,
    });
    assert.equal(result.state, 'VALUATION_REJECTED');
    assert.deepEqual(result.reasonCodes, ['OUTCOME_EVIDENCE_MISSING']);
    assert.equal(result.finalReferenceValue, null);
  });

  it('10. uses deterministic exact arithmetic without floating point', () => {
    assert.equal(multiplyBasisPoints(30_000n, 9_000n, 'ROUND_DOWN'), 27_000n);
    assert.equal(multiplyRational(5n, 1n, 3n, 'ROUND_DOWN'), 1n);
    assert.equal(multiplyRational(5n, 1n, 3n, 'ROUND_HALF_UP'), 2n);
  });

  it('11. enforces caps after factors', () => {
    const contribution = verifyFixture('PROFESSIONAL_EXPERTISE', 'val-cap', 10n);
    const engine = engineWith([referenceFor('PROFESSIONAL_SERVICE_SCHEDULE', 'val-cap', 5_000n)]);
    const result = engine.evaluate({
      contribution,
      policy: createSimulationValuationPolicy({
        methodCaps: { PROFESSIONAL_SERVICE_SCHEDULE: 20_000n },
      }),
      valuationTimestamp: VALUATION_NOW,
    });
    assert.equal(result.state, 'VALUED_SIMULATION');
    assert.equal(result.baseReferenceValue, 50_000n);
    assert.equal(result.finalReferenceValue, 20_000n);
    assert.equal(result.capsApplied.some((item) => item.applied && item.kind === 'METHOD'), true);
  });

  it('12. applies the policy rounding rule', () => {
    const contribution = verifyFixture('COMMUNITY_CONTRIBUTION', 'val-round', 1n);
    const down = engineWith([referenceFor('COMMUNITY_CONTRIBUTION_SCHEDULE', 'val-round', 1n)]).evaluate({
      contribution,
      policy: createSimulationValuationPolicy({ roundingRule: 'ROUND_DOWN', defaultFactors: [] }),
      valuationTimestamp: VALUATION_NOW,
      requestedFactors: [
        {
          factorType: 'USAGE',
          inputRef: 'factor:half',
          numerator: 1n,
          denominator: 2n,
          basisPoints: null,
          reasonCode: 'ROUNDING_APPLIED',
          policyRuleRef: policyRuleRefFor('half'),
        },
      ],
    });
    const halfUp = engineWith([referenceFor('COMMUNITY_CONTRIBUTION_SCHEDULE', 'val-round', 1n)]).evaluate({
      contribution,
      policy: createSimulationValuationPolicy({ roundingRule: 'ROUND_HALF_UP', defaultFactors: [] }),
      valuationTimestamp: VALUATION_NOW,
      requestedFactors: [
        {
          factorType: 'USAGE',
          inputRef: 'factor:half',
          numerator: 1n,
          denominator: 2n,
          basisPoints: null,
          reasonCode: 'ROUNDING_APPLIED',
          policyRuleRef: policyRuleRefFor('half'),
        },
      ],
    });
    assert.equal(down.finalReferenceValue, 0n);
    assert.equal(halfUp.finalReferenceValue, 1n);
    assert.equal(down.roundingApplied, 'ROUND_DOWN');
    assert.equal(halfUp.roundingApplied, 'ROUND_HALF_UP');
  });

  it('13. returns review when reference sources materially conflict', () => {
    const contribution = verifyFixture('ECONOMIC_PARTICIPATION', 'val-conflict', 2n);
    const engine = engineWith([
      referenceFor('MARKET_REFERENCE', 'val-conflict-a', 2_200n),
      referenceFor('MARKET_REFERENCE', 'val-conflict-b', 2_800n),
    ]);
    const result = engine.evaluate({
      contribution,
      policy: createSimulationValuationPolicy(),
      valuationTimestamp: VALUATION_NOW,
    });
    assert.equal(result.state, 'VALUATION_REVIEW_REQUIRED');
    assert.deepEqual(result.reasonCodes, ['REFERENCE_CONFLICT']);
    assert.equal(result.finalReferenceValue, null);
  });

  it('14. returns review when the resolved reference is stale', () => {
    const contribution = verifyFixture('PROFESSIONAL_EXPERTISE', 'val-stale', 2n);
    const engine = engineWith([
      referenceFor('PROFESSIONAL_SERVICE_SCHEDULE', 'val-stale', 5_000n, {
        observedAt: asUtcInstant('2020-01-01T00:00:00.000Z'),
        effectiveAt: asUtcInstant('2020-01-01T00:00:00.000Z'),
      }),
    ]);
    const result = engine.evaluate({
      contribution,
      policy: createSimulationValuationPolicy({ maxReferenceAgeSeconds: 86_400n }),
      valuationTimestamp: VALUATION_NOW,
    });
    assert.equal(result.state, 'VALUATION_REVIEW_REQUIRED');
    assert.deepEqual(result.reasonCodes, ['REFERENCE_STALE']);
  });

  it('15. returns review when the required reference is missing', () => {
    const contribution = verifyFixture('PROFESSIONAL_EXPERTISE', 'val-missing', 2n);
    const result = engineWith([]).evaluate({
      contribution,
      policy: createSimulationValuationPolicy(),
      valuationTimestamp: VALUATION_NOW,
    });
    assert.equal(result.state, 'VALUATION_REVIEW_REQUIRED');
    assert.deepEqual(result.reasonCodes, ['REFERENCE_MISSING']);
    assert.equal(result.finalReferenceValue, null);
  });

  it('16. rejects an unsupported method', () => {
    const contribution = verifyFixture('EDUCATION_SKILL_ATTESTATION', 'val-unsupported', 1n);
    const result = engineWith([]).evaluate({
      contribution,
      policy: createSimulationValuationPolicy({
        eligibility: createSimulationValuationPolicy().eligibility.map((rule) =>
          rule.contributionClass === 'EDUCATION_SKILL_ATTESTATION' ? { ...rule, methods: [] } : rule,
        ),
      }),
      valuationTimestamp: VALUATION_NOW,
    });
    assert.equal(result.state, 'VALUATION_REJECTED');
    assert.deepEqual(result.reasonCodes, ['UNSUPPORTED_METHOD']);
  });

  it('17. rejects an unverified contribution', () => {
    const registry = new HumanContributionRegistry();
    const submitted = registry.submit(fixtureContribution('PROFESSIONAL_EXPERTISE', 'val-unverified'));
    if (!submitted.ok) {
      throw new Error(submitted.error.message);
    }
    const result = engineWith([referenceFor('PROFESSIONAL_SERVICE_SCHEDULE', 'val-unverified', 5_000n)]).evaluate({
      contribution: submitted.value,
      policy: createSimulationValuationPolicy(),
      valuationTimestamp: VALUATION_NOW,
    });
    assert.equal(result.state, 'VALUATION_REJECTED');
    assert.deepEqual(result.reasonCodes, ['UNVERIFIED_CONTRIBUTION']);
  });

  it('18. rejects a superseded contribution', () => {
    const registry = new HumanContributionRegistry();
    const first = registry.submit(fixtureContribution('PROFESSIONAL_EXPERTISE', 'val-super-1'));
    if (!first.ok) {
      throw new Error(first.error.message);
    }
    registry.verify({
      contributionId: first.value.contributionId,
      verificationTimestamp: asUtcInstant('2026-08-19T12:05:00.000Z'),
    });
    registry.supersede(first.value.contributionId, {
      ...fixtureContribution('PROFESSIONAL_EXPERTISE', 'val-super-2'),
      createdAt: asUtcInstant('2026-08-19T13:00:00.000Z'),
    });
    const prior = registry.getRecord(first.value.contributionId);
    assert.ok(prior);
    const result = engineWith([referenceFor('PROFESSIONAL_SERVICE_SCHEDULE', 'val-super-1', 5_000n)]).evaluate({
      contribution: prior,
      policy: createSimulationValuationPolicy(),
      valuationTimestamp: VALUATION_NOW,
    });
    assert.equal(result.state, 'VALUATION_REJECTED');
    assert.deepEqual(result.reasonCodes, ['SUPERSEDED_CONTRIBUTION']);
  });

  it('19. rejects PEVE input', () => {
    const contribution = verifyFixture('PROFESSIONAL_EXPERTISE', 'val-peve', 2n);
    const result = engineWith([referenceFor('PROFESSIONAL_SERVICE_SCHEDULE', 'val-peve', 5_000n)]).evaluate({
      contribution,
      policy: createSimulationValuationPolicy(),
      valuationTimestamp: VALUATION_NOW,
      peveScore: 42,
    } as never);
    assert.equal(result.state, 'VALUATION_REJECTED');
    assert.deepEqual(result.reasonCodes, ['PEVE_INPUT_FORBIDDEN']);
  });

  it('20. rejects a protected trait ranking input', () => {
    const contribution = verifyFixture('PROFESSIONAL_EXPERTISE', 'val-trait', 2n);
    const result = engineWith([referenceFor('PROFESSIONAL_SERVICE_SCHEDULE', 'val-trait', 5_000n)]).evaluate({
      contribution,
      policy: createSimulationValuationPolicy(),
      valuationTimestamp: VALUATION_NOW,
      race: 'forbidden',
    } as never);
    assert.equal(result.state, 'VALUATION_REJECTED');
    assert.deepEqual(result.reasonCodes, ['PROTECTED_TRAIT_FORBIDDEN']);
  });

  it('21. rejects a person-level multiplier', () => {
    const contribution = verifyFixture('PROFESSIONAL_EXPERTISE', 'val-person', 2n);
    const forbidden: FactorRequest = {
      ...factorRequest('person', 12_000n, 'PERSON_LEVEL'),
    };
    const result = engineWith([referenceFor('PROFESSIONAL_SERVICE_SCHEDULE', 'val-person', 5_000n)]).evaluate({
      contribution,
      policy: createSimulationValuationPolicy(),
      valuationTimestamp: VALUATION_NOW,
      requestedFactors: [forbidden],
    });
    assert.equal(result.state, 'VALUATION_REJECTED');
    assert.deepEqual(result.reasonCodes, ['PERSON_LEVEL_MULTIPLIER_FORBIDDEN']);
  });

  it('22. rejects an AI subjective score factor', () => {
    const contribution = verifyFixture('PROFESSIONAL_EXPERTISE', 'val-ai', 2n);
    const result = engineWith([referenceFor('PROFESSIONAL_SERVICE_SCHEDULE', 'val-ai', 5_000n)]).evaluate({
      contribution,
      policy: createSimulationValuationPolicy(),
      valuationTimestamp: VALUATION_NOW,
      requestedFactors: [factorRequest('ai', 8_000n, 'AI_SUBJECTIVE')],
    });
    assert.equal(result.state, 'VALUATION_REJECTED');
    assert.deepEqual(result.reasonCodes, ['AI_SUBJECTIVE_SCORE_FORBIDDEN']);
  });

  it('23. repeats a valuation deterministically', () => {
    const contribution = verifyFixture('PROFESSIONAL_EXPERTISE', 'val-repeat', 6n);
    const engine = engineWith([referenceFor('PROFESSIONAL_SERVICE_SCHEDULE', 'val-repeat', 5_000n)]);
    const first = engine.evaluate({
      contribution,
      policy: createSimulationValuationPolicy(),
      valuationTimestamp: VALUATION_NOW,
    });
    const second = engine.evaluate({
      contribution,
      policy: createSimulationValuationPolicy(),
      valuationTimestamp: VALUATION_NOW,
    });
    assert.equal(first.valuationDigest, second.valuationDigest);
    assert.equal(first.valuationId, second.valuationId);
    assert.equal(first.finalReferenceValue, second.finalReferenceValue);
  });

  it('24. preserves valuation history across revaluation', () => {
    const contribution = verifyFixture('PROFESSIONAL_EXPERTISE', 'val-history', 6n);
    const engine = engineWith([referenceFor('PROFESSIONAL_SERVICE_SCHEDULE', 'val-history', 5_000n)]);
    const first = engine.evaluate({
      contribution,
      policy: createSimulationValuationPolicy(),
      valuationTimestamp: VALUATION_NOW,
    });
    const laterPolicy = createSimulationValuationPolicy({
      valuationPolicyVersion: valuationPolicyVersionFor('sunrey-human-contribution-valuation-v2'),
    });
    const second = engine.evaluate({
      contribution,
      policy: laterPolicy,
      valuationTimestamp: asUtcInstant('2026-08-19T15:00:00.000Z'),
      supersedesValuationId: first.valuationId,
      revaluationReason: 'POLICY_VERSION_CHANGE',
    });
    const history = engine.history().listByContribution(contribution.contributionId);
    assert.equal(history.length, 2);
    assert.equal(history[0]?.valuationId, first.valuationId);
    assert.equal(history[1]?.valuationId, second.valuationId);
    assert.equal(second.supersedesValuationId, first.valuationId);
    assert.equal(second.priorPolicyVersion, first.valuationPolicyVersion);
    assert.notEqual(second.valuationId, first.valuationId);
    assert.equal(engine.history().get(first.valuationId)?.finalReferenceValue, first.finalReferenceValue);
  });

  it('25. valuation result has no SunRey quantity', () => {
    const contribution = verifyFixture('CREATIVE_PRODUCTION', 'val-nosunrey', 2n);
    const result = engineWith([referenceFor('GOVERNED_FIXED_SCHEDULE', 'val-nosunrey', 700n)]).evaluate({
      contribution,
      policy: createSimulationValuationPolicy(),
      valuationTimestamp: VALUATION_NOW,
    });
    assert.equal(result.state, 'VALUED_SIMULATION');
    assertSimulationInvariants(result);
  });

  it('26. valuation result cannot mint', () => {
    const contribution = verifyFixture('PROFESSIONAL_EXPERTISE', 'val-nomint', 2n);
    const result = engineWith([referenceFor('PROFESSIONAL_SERVICE_SCHEDULE', 'val-nomint', 5_000n)]).evaluate({
      contribution,
      policy: createSimulationValuationPolicy(),
      valuationTimestamp: VALUATION_NOW,
    });
    assert.equal(result.invariants.createsMintAuthority, false);
    assert.equal(createSimulationValuationPolicy().createsMintAuthority, false);
  });

  it('27. valuation result cannot issue Execution Authority', () => {
    const contribution = verifyFixture('PROFESSIONAL_EXPERTISE', 'val-noea', 2n);
    const result = engineWith([referenceFor('PROFESSIONAL_SERVICE_SCHEDULE', 'val-noea', 5_000n)]).evaluate({
      contribution,
      policy: createSimulationValuationPolicy(),
      valuationTimestamp: VALUATION_NOW,
    });
    assert.equal(result.invariants.createsExecutionAuthority, false);
    assert.equal(result.explanation.containsRawPersonalData, false);
    assert.ok(result.explanation.methodSelectedReason.includes('PROFESSIONAL_SERVICE_SCHEDULE'));
    assert.ok(result.explanation.policyVersion);
  });

  it('does not connect a live pricing port', () => {
    const port = new InMemoryValuationReferenceDataPort([]);
    const engine = new HumanContributionValuationEngine(port);
    assert.equal(typeof engine.evaluate, 'function');
    assert.equal(typeof fetch, 'function');
  });
});
