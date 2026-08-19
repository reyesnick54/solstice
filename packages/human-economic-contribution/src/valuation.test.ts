import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  PRODUCTION_VALUATION_ACTIVATION,
  PRODUCTION_VALUATION_POLICY_STATUS,
  REFERENCE_VALUE_EQUALS_SUNREY_BY_DEFINITION,
  computeValuationDigest,
  productionValuationPolicyUnavailable,
  refuseProductionValuation,
  simulationValuationPolicy,
  valueVerifiedContribution,
  type VerifiedContributionValuationInput,
} from './valuation/index.ts';

function verified(input?: Partial<VerifiedContributionValuationInput>): VerifiedContributionValuationInput {
  return {
    contributionId: input?.contributionId ?? 'hec.val.1',
    fingerprint: input?.fingerprint ?? 'a'.repeat(64),
    status: 'VERIFIED',
    verificationPolicyVersion: 'sunrey.human-contribution.verification.v1',
    measurementQuantity: input?.measurementQuantity ?? 5n,
    measurementUnit: input?.measurementUnit ?? 'VERIFIED_COMMUNITY_CONTRIBUTION_UNIT',
    jurisdictionPolicyRef: input?.jurisdictionPolicyRef ?? 'policy.sim.jurisdiction.unconfigured',
    containsRawPersonalData: false,
    peveScoreUsedAsValue: false,
    humanWorthScore: false,
  };
}

describe('Chunk 111 human contribution valuation engine', () => {
  it('values a verified contribution as a reference settlement value, not SunRey', () => {
    const valued = valueVerifiedContribution({
      contribution: verified(),
      policy: simulationValuationPolicy(),
      actor: 'PROTOCOL',
    });
    assert.equal(valued.ok, true);
    if (!valued.ok) {
      throw new Error(valued.code);
    }
    assert.equal(valued.result.finalReferenceValue, 500n);
    assert.equal(valued.result.sunReyQuantity, null);
    assert.equal(valued.result.referenceValueEqualsSunReyByDefinition, false);
    assert.equal(valued.result.peveUsedAsTokenFormula, false);
    assert.equal(valued.result.humanWorthUsedAsValue, false);
    assert.equal(valued.result.aiAuthorized, false);
    assert.equal(valued.result.productionActivated, false);
    assert.equal(valued.result.parameterClass, 'ENGINEERING_SIMULATION_PARAMETERS');
    assert.equal(
      valued.result.valuationDigest,
      computeValuationDigest({
        valuationId: valued.result.valuationId,
        contributionId: valued.result.contributionId,
        fingerprint: valued.result.fingerprint,
        valuationPolicyId: valued.result.valuationPolicyId,
        valuationPolicyVersion: valued.result.valuationPolicyVersion,
        valuationMethod: valued.result.valuationMethod,
        finalReferenceValue: valued.result.finalReferenceValue,
        referenceDenomination: valued.result.referenceDenomination,
      }),
    );
    assert.equal(REFERENCE_VALUE_EQUALS_SUNREY_BY_DEFINITION, false);
  });

  it('refuses unverified contributions and production activation', () => {
    const unverified = valueVerifiedContribution({
      contribution: { ...verified(), status: 'VERIFIED' },
      policy: simulationValuationPolicy(),
      actor: 'HUMAN',
    });
    assert.equal(unverified.ok, true);
    const notVerified = valueVerifiedContribution({
      contribution: { ...verified(), status: 'SUBMITTED' as unknown as 'VERIFIED' },
      policy: simulationValuationPolicy(),
      actor: 'HUMAN',
    });
    assert.equal(notVerified.ok, false);
    if (!notVerified.ok) {
      assert.equal(notVerified.code, 'CONTRIBUTION_NOT_VERIFIED');
    }
    assert.equal(refuseProductionValuation().code, 'PRODUCTION_VALUATION_UNAVAILABLE');
    assert.equal(productionValuationPolicyUnavailable().status, PRODUCTION_VALUATION_POLICY_STATUS);
    assert.equal(productionValuationPolicyUnavailable().activation, PRODUCTION_VALUATION_ACTIVATION);
  });

  it('refuses AI, Financial Agent, S3M, Grok, and model output', () => {
    const policy = simulationValuationPolicy();
    const contribution = verified();
    assert.equal(valueVerifiedContribution({ contribution, policy, actor: 'AI' }).ok, false);
    assert.equal(valueVerifiedContribution({ contribution, policy, actor: 'FINANCIAL_AGENT' }).ok, false);
    assert.equal(valueVerifiedContribution({ contribution, policy, actor: 'S3M' }).ok, false);
    assert.equal(valueVerifiedContribution({ contribution, policy, actor: 'GROK' }).ok, false);
    assert.equal(valueVerifiedContribution({ contribution, policy, actor: 'MODEL_OUTPUT' }).ok, false);
  });

  it('refuses PEVE, human-worth, and raw personal data', () => {
    const policy = simulationValuationPolicy();
    const contribution = verified();
    assert.equal(
      valueVerifiedContribution({
        contribution,
        policy,
        actor: 'HUMAN',
        extra: { peveComposite: 99n },
      }).ok,
      false,
    );
    assert.equal(
      valueVerifiedContribution({
        contribution,
        policy,
        actor: 'HUMAN',
        extra: { humanWorthScore: 1 },
      }).ok,
      false,
    );
    assert.equal(
      valueVerifiedContribution({
        contribution,
        policy,
        actor: 'HUMAN',
        extra: { name: 'Ada Lovelace' },
      }).ok,
      false,
    );
  });

  it('enforces the valuation-policy reference cap', () => {
    const valued = valueVerifiedContribution({
      contribution: verified({ measurementQuantity: 200n }),
      policy: simulationValuationPolicy({ perContributionReferenceCeiling: 1_000n }),
      actor: 'PROTOCOL',
    });
    assert.equal(valued.ok, false);
    if (!valued.ok) {
      assert.equal(valued.code, 'VALUATION_CAP_EXCEEDED');
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
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../../domain/src/time.ts';
import { CONTRIBUTION_CLASSES } from './taxonomy.ts';
import {
  AI_VALUATION_BOUNDARY,
  COMMUNITY_CONTRIBUTION_POLICY,
  CREATIVE_ROYALTY_POLICY,
  HUMAN_CONTRIBUTION_VALUATION_CONSTITUTION,
  HumanContributionValuationPolicyRegistry,
  INFORMATION_USAGE_POLICY,
  PERMITTED_VALUATION_METHODS,
  PRODUCTION_VALUATION_POLICY_CONFIGURED,
  PROFESSIONAL_SERVICE_POLICY,
  RESEARCH_PARTICIPATION_POLICY,
  VALUATION_ELIGIBILITY_MATRIX,
  VALUATION_METHOD_TAXONOMY,
  applyMultiplier,
  asValuationPolicyVersion,
  assertTraceableInput,
  compareReferenceValues,
  createContributionReferenceValue,
  everyContributionClassHasDeliberateMethodRules,
  hashValuationPolicy,
  isMethodEligibleForClass,
  policyCannotMint,
  scanForbiddenValuationInputs,
  selectMethodByPolicyPriority,
  simulationPolicyFixture,
  valuationInputRefFor,
  valuationPolicyIdFor,
  type RegisterableValuationPolicy,
  type TraceableValuationInput,
} from './valuation/index.ts';

function unwrap<T>(result: { ok: true; value: T } | { ok: false; error: { code: string; message: string } }): T {
  assert.equal(result.ok, true, result.ok ? '' : `${result.error.code}: ${result.error.message}`);
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.value;
}

function contractInput(seed: string): TraceableValuationInput {
  return {
    inputType: 'CONTRACTUAL_COMPENSATION_REFERENCE',
    inputRef: valuationInputRefFor(seed),
    sourceRef: `contract:${seed}`,
    evidenceRef: `evidence:${seed}`,
    observedAt: '2026-08-19T12:00:00.000Z',
    integerQuantity: 1500n,
    unit: 'USD_MINOR',
    appliesToContributionEvent: true,
    personLevelMultiplier: false,
  };
}

describe('CHUNK-110 human contribution valuation constitution', () => {
  it('encodes the valuation constitution invariants', () => {
    assert.equal(HUMAN_CONTRIBUTION_VALUATION_CONSTITUTION.VALUATION_IS_EVENT_SPECIFIC, true);
    assert.equal(HUMAN_CONTRIBUTION_VALUATION_CONSTITUTION.VALUATION_IS_NOT_HUMAN_WORTH, true);
    assert.equal(HUMAN_CONTRIBUTION_VALUATION_CONSTITUTION.VALUATION_IS_NOT_PEVE, true);
    assert.equal(HUMAN_CONTRIBUTION_VALUATION_CONSTITUTION.VALUATION_IS_NOT_CREDIT_SCORE, true);
    assert.equal(HUMAN_CONTRIBUTION_VALUATION_CONSTITUTION.VALUATION_IS_NOT_SOCIAL_CREDIT, true);
    assert.equal(HUMAN_CONTRIBUTION_VALUATION_CONSTITUTION.VALUATION_DOES_NOT_MINT, true);
    assert.equal(HUMAN_CONTRIBUTION_VALUATION_CONSTITUTION.VALUATION_DOES_NOT_AUTHORIZE_EXECUTION, true);
    assert.equal(HUMAN_CONTRIBUTION_VALUATION_CONSTITUTION.PROTECTED_TRAIT_VALUATION_FORBIDDEN, true);
    assert.equal(HUMAN_CONTRIBUTION_VALUATION_CONSTITUTION.PERSON_LEVEL_DESIRABILITY_MULTIPLIER_FORBIDDEN, true);
    assert.equal(HUMAN_CONTRIBUTION_VALUATION_CONSTITUTION.AI_FINAL_VALUATION_AUTHORITY_FORBIDDEN, true);
    assert.equal(PRODUCTION_VALUATION_POLICY_CONFIGURED, false);
    assert.equal(HUMAN_CONTRIBUTION_VALUATION_CONSTITUTION.productionValuationActive, false);
    assert.equal(HUMAN_CONTRIBUTION_VALUATION_CONSTITUTION.valuationEngineComputesSettlement, false);
  });

  it('gives every contribution class deliberate method rules', () => {
    assert.equal(everyContributionClassHasDeliberateMethodRules(), true);
    for (const contributionClass of CONTRIBUTION_CLASSES) {
      assert.equal(Object.hasOwn(VALUATION_ELIGIBILITY_MATRIX, contributionClass), true);
      assert.equal(Array.isArray(VALUATION_ELIGIBILITY_MATRIX[contributionClass]), true);
    }
    assert.deepEqual(VALUATION_ELIGIBILITY_MATRIX.OTHER_GOVERNED_HUMAN_CONTRIBUTION, []);
    assert.equal(VALUATION_METHOD_TAXONOMY.addingAMethodDoesNotGrantEligibility, true);
    assert.equal(VALUATION_METHOD_TAXONOMY.liveMarketConnectivity, false);
  });

  it('rejects unsupported class/method combinations', () => {
    assert.equal(isMethodEligibleForClass('COMMUNITY_CONTRIBUTION', 'CREATOR_ROYALTY_SCHEDULE'), false);
    assert.equal(isMethodEligibleForClass('RESEARCH_PARTICIPATION', 'MARKET_REFERENCE'), false);
    assert.equal(isMethodEligibleForClass('OTHER_GOVERNED_HUMAN_CONTRIBUTION', 'CONTRACTUAL_COMPENSATION'), false);
    assert.equal(isMethodEligibleForClass('CREATIVE_PRODUCTION', 'PEVE_MULTIPLIER'), false);
    const registry = new HumanContributionValuationPolicyRegistry();
    const rejected = registry.register({
      ...COMMUNITY_CONTRIBUTION_POLICY,
      policyId: valuationPolicyIdFor('bad-combo'),
      method: 'CREATOR_ROYALTY_SCHEDULE',
    });
    assert.equal(rejected.ok, false);
    if (!rejected.ok) {
      assert.equal(rejected.error.code, 'CLASS_METHOD_NOT_ELIGIBLE');
    }
  });

  it('does not grant automatic valuation eligibility from the taxonomy', () => {
    for (const method of PERMITTED_VALUATION_METHODS) {
      assert.equal(VALUATION_METHOD_TAXONOMY.records[method].grantsAutomaticEligibility, false);
    }
    assert.equal(isMethodEligibleForClass('OTHER_GOVERNED_HUMAN_CONTRIBUTION', 'GOVERNED_FIXED_SCHEDULE'), false);
  });

  it('versions policies, preserves superseded history, and refuses mutation', () => {
    const registry = new HumanContributionValuationPolicyRegistry();
    const first = unwrap(registry.register(INFORMATION_USAGE_POLICY));
    const successorInput: RegisterableValuationPolicy = {
      ...INFORMATION_USAGE_POLICY,
      version: asValuationPolicyVersion('2'),
      methodologyReference: 'method:information-usage-v2',
    };
    const superseded = unwrap(registry.supersede(first.policy.policyId, first.policy.version, successorInput));
    assert.equal(superseded.previous.lifecycleStatus, 'SUPERSEDED');
    assert.equal(superseded.previous.hash, first.hash);
    assert.equal(superseded.current.policy.version, '2');
    const historical = unwrap(registry.get(first.policy.policyId, first.policy.version));
    assert.equal(historical.policy.methodologyReference, INFORMATION_USAGE_POLICY.methodologyReference);
    assert.equal(historical.lifecycleStatus, 'SUPERSEDED');
    const duplicate = registry.register(INFORMATION_USAGE_POLICY);
    assert.equal(duplicate.ok, false);
    if (!duplicate.ok) {
      assert.equal(duplicate.error.code, 'DUPLICATE_POLICY_VERSION');
    }
    const mutated = registry.mutateHistorical(first.policy.policyId, first.policy.version);
    assert.equal(mutated.ok, false);
    if (!mutated.ok) {
      assert.equal(mutated.error.code, 'HISTORICAL_POLICY_IMMUTABLE');
    }
  });

  it('hashes a policy deterministically', () => {
    const registry = new HumanContributionValuationPolicyRegistry();
    const stored = unwrap(registry.register(PROFESSIONAL_SERVICE_POLICY));
    assert.equal(hashValuationPolicy(stored.policy), stored.hash);
    assert.equal(hashValuationPolicy(stored.policy), hashValuationPolicy(stored.policy));
    const clone = unwrap(
      new HumanContributionValuationPolicyRegistry().register({
        ...PROFESSIONAL_SERVICE_POLICY,
        policyId: stored.policy.policyId,
      }),
    );
    assert.equal(clone.hash, stored.hash);
  });

  it('rejects floating-point monetary math', () => {
    const floatAmount = createContributionReferenceValue({
      amount: 12.5 as unknown as bigint,
      denomination: 'USD',
      minorUnitPrecision: 2n,
      valueClass: 'FIAT_REFERENCE',
    });
    assert.equal(floatAmount.ok, false);
    if (!floatAmount.ok) {
      assert.equal(floatAmount.error.code, 'FLOAT_MONETARY_MATH_FORBIDDEN');
    }
    const applied = applyMultiplier(10_000n, { kind: 'BASIS_POINTS', points: 5_000n }, 'FLOOR');
    assert.equal(applied.ok, true);
    if (applied.ok) {
      assert.equal(applied.value, 5_000n);
    }
  });

  it('rejects PEVE, human-worth, protected-trait, wealth, and AI subjective inputs', () => {
    const peve = scanForbiddenValuationInputs({ peveScore: 88 });
    assert.equal(peve.ok, false);
    if (!peve.ok) {
      assert.equal(peve.error.code, 'PEVE_INPUT_FORBIDDEN');
    }
    const worth = scanForbiddenValuationInputs({ humanWorthScore: 12 });
    assert.equal(worth.ok, false);
    if (!worth.ok) {
      assert.equal(worth.error.code, 'HUMAN_WORTH_INPUT_FORBIDDEN');
    }
    const race = scanForbiddenValuationInputs({ race: 'forbidden' });
    assert.equal(race.ok, false);
    if (!race.ok) {
      assert.equal(race.error.code, 'PROTECTED_TRAIT_INPUT_FORBIDDEN');
    }
    const wealth = scanForbiddenValuationInputs({ netWorth: 99n });
    assert.equal(wealth.ok, false);
    if (!wealth.ok) {
      assert.equal(wealth.error.code, 'WEALTH_MULTIPLIER_FORBIDDEN');
    }
    const wallet = scanForbiddenValuationInputs({ walletBalance: 1n });
    assert.equal(wallet.ok, false);
    if (!wallet.ok) {
      assert.equal(wallet.error.code, 'WEALTH_MULTIPLIER_FORBIDDEN');
    }
    const ai = scanForbiddenValuationInputs({ aiSubjectiveScore: 7 });
    assert.equal(ai.ok, false);
    if (!ai.ok) {
      assert.equal(ai.error.code, 'AI_SUBJECTIVE_SCORE_FORBIDDEN');
    }
  });

  it('allows an explicit contract reference and the named schedules', () => {
    assert.equal(unwrap(assertTraceableInput(contractInput('contract-ok'))), true);
    assert.equal(isMethodEligibleForClass('INFORMATION_RIGHT_CONTRIBUTION', 'INFORMATION_USAGE_RIGHT_SCHEDULE'), true);
    assert.equal(isMethodEligibleForClass('CREATOR_ROYALTY_EVENT', 'CREATOR_ROYALTY_SCHEDULE'), true);
    assert.equal(isMethodEligibleForClass('PROFESSIONAL_EXPERTISE', 'PROFESSIONAL_SERVICE_SCHEDULE'), true);
    assert.equal(isMethodEligibleForClass('INFORMATION_RIGHT_CONTRIBUTION', 'CONTRACTUAL_COMPENSATION'), true);
    const registry = new HumanContributionValuationPolicyRegistry();
    assert.equal(registry.register(INFORMATION_USAGE_POLICY).ok, true);
    assert.equal(registry.register(CREATIVE_ROYALTY_POLICY).ok, true);
    assert.equal(registry.register(PROFESSIONAL_SERVICE_POLICY).ok, true);
    assert.equal(registry.register(RESEARCH_PARTICIPATION_POLICY).ok, true);
    assert.equal(registry.register(COMMUNITY_CONTRIBUTION_POLICY).ok, true);
  });

  it('allows simulation policy and keeps production unavailable', () => {
    const registry = new HumanContributionValuationPolicyRegistry();
    unwrap(registry.register(RESEARCH_PARTICIPATION_POLICY));
    const active = unwrap(
      registry.resolveActiveSimulation('RESEARCH_PARTICIPATION', asUtcInstant('2026-08-19T12:00:00.000Z')),
    );
    assert.equal(active.lifecycleStatus, 'SIMULATION');
    assert.equal(active.policy.productionActivated, false);
    const production = registry.resolveActiveProduction();
    assert.equal(production.ok, false);
    if (!production.ok) {
      assert.equal(production.error.code, 'PRODUCTION_POLICY_UNAVAILABLE');
    }
    const activated = registry.activateProduction();
    assert.equal(activated.ok, false);
    if (!activated.ok) {
      assert.equal(activated.error.code, 'PRODUCTION_ACTIVATION_FORBIDDEN');
    }
  });

  it('keeps a valuation reference from becoming a SunRey quantity or mint', () => {
    const value = unwrap(
      createContributionReferenceValue({
        amount: 2500n,
        denomination: 'USD',
        minorUnitPrecision: 2n,
        valueClass: 'CONTRACT_REFERENCE',
      }),
    );
    assert.equal(value.isSunReyQuantity, false);
    assert.equal(value.isPEVEScore, false);
    assert.equal(value.isHumanWorth, false);
    assert.equal(value.createsMintAuthority, false);
    const sunrey = createContributionReferenceValue({
      amount: 1n,
      denomination: 'SUNREY',
      minorUnitPrecision: 0n,
      valueClass: 'GOVERNED_SETTLEMENT_REFERENCE',
    });
    assert.equal(sunrey.ok, false);
    if (!sunrey.ok) {
      assert.equal(sunrey.error.code, 'SUNREY_QUANTITY_FORBIDDEN');
    }
    const policy = unwrap(new HumanContributionValuationPolicyRegistry().register(CREATIVE_ROYALTY_POLICY)).policy;
    assert.equal(policyCannotMint(policy), true);
  });

  it('uses explicit policy priority and requires review on conflicting references', () => {
    const policy = unwrap(new HumanContributionValuationPolicyRegistry().register(INFORMATION_USAGE_POLICY)).policy;
    const selected = unwrap(
      selectMethodByPolicyPriority(policy, ['INFORMATION_USAGE_RIGHT_SCHEDULE', 'CONTRACTUAL_COMPENSATION']),
    );
    assert.equal(selected, 'CONTRACTUAL_COMPENSATION');
    const left = unwrap(
      createContributionReferenceValue({
        amount: 1000n,
        denomination: 'USD',
        minorUnitPrecision: 2n,
        valueClass: 'CONTRACT_REFERENCE',
      }),
    );
    const right = unwrap(
      createContributionReferenceValue({
        amount: 5000n,
        denomination: 'USD',
        minorUnitPrecision: 2n,
        valueClass: 'CONTRACT_REFERENCE',
      }),
    );
    const conflict = compareReferenceValues(policy, left, right);
    assert.equal(conflict.ok, false);
    if (!conflict.ok) {
      assert.equal(conflict.error.code, 'VALUATION_REVIEW_REQUIRED');
    }
  });

  it('keeps AI outside final valuation authority', () => {
    assert.equal(AI_VALUATION_BOUNDARY.mayActivatePolicy, false);
    assert.equal(AI_VALUATION_BOUNDARY.mayApproveProductionPolicy, false);
    assert.equal(AI_VALUATION_BOUNDARY.mayOverrideProtectedTraitRules, false);
    assert.equal(AI_VALUATION_BOUNDARY.mayAuthorizeSettlement, false);
    assert.equal(AI_VALUATION_BOUNDARY.mayAuthorizeMinting, false);
    assert.equal(AI_VALUATION_BOUNDARY.finalValuationAuthority, false);
  });

  it('contains no floating-point monetary operators in valuation source', () => {
    const files = [
      'constitution.ts',
      'methods.ts',
      'eligibility.ts',
      'inputs.ts',
      'value.ts',
      'factors.ts',
      'policy.ts',
      'registry.ts',
      'conflict.ts',
    ];
    for (const file of files) {
      const source = readFileSync(join(import.meta.dirname, 'valuation', file), 'utf8');
      assert.equal(/parseFloat\s*\(/.test(source), false, file);
      assert.equal(/\bAPY\b|\bAPR\b/.test(source), false, file);
    }
  });
});
