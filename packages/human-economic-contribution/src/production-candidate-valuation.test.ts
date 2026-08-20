import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  HUMAN_CONTRIBUTION_VALUATION_CONSTITUTION,
  PRODUCTION_VALUATION_POLICY_CONFIGURED,
} from './valuation/constitution.ts';
import {
  AI_VALUATION_BOUNDARY,
  PEVE_USED_AS_TOKEN_FORMULA,
  PRODUCTION_CANDIDATE_VALUATION_SCHEMA_VERSION,
  PRODUCTION_VALUATION_ENGINE_ACTIVATED,
  REFERENCE_VALUE_EQUALS_SUNREY_BY_DEFINITION,
  VALUATION_IS_HUMAN_WORTH,
  bindExact,
  constitutionRemainsUnweakened,
  createValuationPolicyCandidate,
  fixtureInformationRightContribution,
  fixtureVerifiedContribution,
  rehearsalValuationPolicyCandidate,
  reportUnconfiguredValues,
  unconfiguredValuationPolicyCandidate,
  validateValuationPolicyCandidate,
  valueContributionUnderCandidatePolicy,
} from './valuation/production-candidate/index.ts';

describe('Chunk 145 production-candidate valuation policy', () => {
  it('1. production-candidate valuation schema is typed and inactive', () => {
    const policy = unconfiguredValuationPolicyCandidate();
    assert.equal(policy.schemaVersion, PRODUCTION_CANDIDATE_VALUATION_SCHEMA_VERSION);
    assert.equal(policy.productionActivated, false);
    assert.equal(PRODUCTION_VALUATION_ENGINE_ACTIVATED, false);
    assert.equal(policy.rehearsalOnly, true);
    const validated = validateValuationPolicyCandidate(policy);
    assert.equal(validated.ok, true);
  });

  it('2. missing numeric policy values are reported unconfigured', () => {
    const policy = unconfiguredValuationPolicyCandidate();
    assert.equal(policy.completeness, 'VALUES_UNCONFIGURED');
    const missing = reportUnconfiguredValues(policy);
    assert.ok(missing.includes('baseValueSchedule[0]'));
    assert.ok(missing.includes('floorPolicy'));
    const valued = valueContributionUnderCandidatePolicy({
      contribution: fixtureVerifiedContribution(),
      policy,
      actor: 'PROTOCOL',
    });
    assert.equal(valued.ok, false);
    if (!valued.ok) {
      assert.equal(valued.code, 'VALUES_UNCONFIGURED');
    }
  });

  it('3. PEVE is forbidden as valuation input', () => {
    const valued = valueContributionUnderCandidatePolicy({
      contribution: fixtureVerifiedContribution(),
      policy: rehearsalValuationPolicyCandidate(),
      actor: 'PROTOCOL',
      extra: { peveScore: 99n },
    });
    assert.equal(valued.ok, false);
    if (!valued.ok) {
      assert.equal(valued.code, 'PEVE_FORBIDDEN');
    }
    assert.equal(PEVE_USED_AS_TOKEN_FORMULA, false);
  });

  it('4. human worth is forbidden', () => {
    const valued = valueContributionUnderCandidatePolicy({
      contribution: fixtureVerifiedContribution(),
      policy: rehearsalValuationPolicyCandidate(),
      actor: 'PROTOCOL',
      extra: { humanWorthScore: 1n },
    });
    assert.equal(valued.ok, false);
    if (!valued.ok) {
      assert.equal(valued.code, 'HUMAN_WORTH_FORBIDDEN');
    }
    assert.equal(VALUATION_IS_HUMAN_WORTH, false);
  });

  it('5. protected traits are forbidden', () => {
    const policy = createValuationPolicyCandidate({
      ...rehearsalValuationPolicyCandidate(),
      rightsPolicyReference: bindExact('rights', 'v1'),
    });
    const poisoned = {
      ...policy,
      race: 'forbidden',
    };
    const validated = validateValuationPolicyCandidate(poisoned);
    assert.equal(validated.ok, false);
    if (!validated.ok) {
      assert.equal(validated.code, 'PROTECTED_TRAIT_FORBIDDEN');
    }
  });

  it('6. person-level desirability multipliers are forbidden', () => {
    const policy = rehearsalValuationPolicyCandidate();
    const rejected = validateValuationPolicyCandidate({
      ...policy,
      factorPolicy: [
        {
          factor: 'CELEBRITY_MULTIPLIER',
          multiplier: { kind: 'RATIONAL', numerator: { status: 'CONFIGURED', value: 2n }, denominator: { status: 'CONFIGURED', value: 1n } },
          roundingRule: 'FLOOR',
        },
      ],
    });
    assert.equal(rejected.ok, false);
    if (!rejected.ok) {
      assert.equal(rejected.code, 'PERSON_LEVEL_MULTIPLIER_FORBIDDEN');
    }
  });

  it('7. valid event-specific fixture valuation produces a reference value', () => {
    const valued = valueContributionUnderCandidatePolicy({
      contribution: fixtureVerifiedContribution({ measurementQuantity: 5n }),
      policy: rehearsalValuationPolicyCandidate(),
      actor: 'PROTOCOL',
    });
    if (!valued.ok) {
      throw new Error(valued.code);
    }
    assert.equal(valued.ok, true);
    // 17 * 5 * 4/5 = 68
    assert.equal(valued.receipt.referenceValue, 68n);
    assert.equal(valued.receipt.sunReyQuantity, null);
    assert.equal(valued.receipt.rehearsalFixtureLabel, 'REHEARSAL_FIXTURE');
    assert.equal(valued.receipt.economicMeaning, 'NO_PRODUCTION_ECONOMIC_MEANING');
    assert.equal(valued.receipt.productionActivated, false);
  });

  it('8. reference value is not SunRey', () => {
    const policy = rehearsalValuationPolicyCandidate();
    assert.equal(policy.referenceValueEqualsSunReyByDefinition, false);
    assert.equal(REFERENCE_VALUE_EQUALS_SUNREY_BY_DEFINITION, false);
    assert.notEqual(policy.referenceDenomination, 'SUNREY_COIN');
    const sunreyDenomination = validateValuationPolicyCandidate({
      ...policy,
      referenceDenomination: 'SUNREY_COIN',
    });
    assert.equal(sunreyDenomination.ok, false);
  });

  it('26-28. AI, S3M, and Grok cannot authorize valuation', () => {
    for (const actor of ['AI', 'S3M', 'GROK'] as const) {
      const valued = valueContributionUnderCandidatePolicy({
        contribution: fixtureVerifiedContribution(),
        policy: rehearsalValuationPolicyCandidate(),
        actor,
      });
      assert.equal(valued.ok, false);
      if (!valued.ok) {
        assert.ok(valued.code.includes(actor) || valued.code.includes('AI'));
      }
    }
    assert.equal(AI_VALUATION_BOUNDARY.mayChooseFinalProductionValues, false);
    assert.equal(AI_VALUATION_BOUNDARY.mayActivateValuationPolicy, false);
  });

  it('preserves the existing valuation constitution', () => {
    assert.equal(constitutionRemainsUnweakened(), true);
    assert.equal(HUMAN_CONTRIBUTION_VALUATION_CONSTITUTION.VALUATION_IS_EVENT_SPECIFIC, true);
    assert.equal(HUMAN_CONTRIBUTION_VALUATION_CONSTITUTION.VALUATION_IS_NOT_PEVE, true);
    assert.equal(HUMAN_CONTRIBUTION_VALUATION_CONSTITUTION.PROTECTED_TRAIT_VALUATION_FORBIDDEN, true);
    assert.equal(HUMAN_CONTRIBUTION_VALUATION_CONSTITUTION.PERSON_LEVEL_DESIRABILITY_MULTIPLIER_FORBIDDEN, true);
    assert.equal(PRODUCTION_VALUATION_POLICY_CONFIGURED, false);
  });

  it('Information Right contributions require rights evidence', () => {
    const valued = valueContributionUnderCandidatePolicy({
      contribution: fixtureInformationRightContribution({ rightsEvidencePresent: false }),
      policy: rehearsalValuationPolicyCandidate(),
      actor: 'PROTOCOL',
    });
    assert.equal(valued.ok, false);
  });

  it('chain anchored is not economically verified', () => {
    const valued = valueContributionUnderCandidatePolicy({
      contribution: fixtureVerifiedContribution({ economicAssetVerificationState: 'CHAIN_ANCHORED_ONLY' }),
      policy: rehearsalValuationPolicyCandidate(),
      actor: 'PROTOCOL',
    });
    assert.equal(valued.ok, false);
    if (!valued.ok) {
      assert.equal(valued.code, 'CHAIN_ANCHOR_IS_NOT_ECONOMIC_VERIFICATION');
    }
  });

  it('rejects latest bindings', () => {
    const policy = rehearsalValuationPolicyCandidate();
    const rejected = validateValuationPolicyCandidate({
      ...policy,
      verificationPolicyReference: { key: 'verificationPolicy', versionId: 'latest', contentHash: 'abc' },
    });
    assert.equal(rejected.ok, false);
    if (!rejected.ok) {
      assert.equal(rejected.code, 'BINDING_LATEST_REJECTED');
    }
  });

  it('rejects hardcoded fiat denominations', () => {
    const policy = rehearsalValuationPolicyCandidate();
    const rejected = validateValuationPolicyCandidate({
      ...policy,
      referenceDenomination: 'USD',
    });
    assert.equal(rejected.ok, false);
    if (!rejected.ok) {
      assert.equal(rejected.code, 'DENOMINATION_HARDCODED_FIAT');
    }
  });
});
