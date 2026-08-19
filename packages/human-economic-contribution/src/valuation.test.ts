import assert from 'node:assert/strict';
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
