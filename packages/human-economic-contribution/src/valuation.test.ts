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
    }
  });
});
