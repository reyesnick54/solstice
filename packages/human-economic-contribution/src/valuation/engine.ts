/**
 * Engineering-implemented reference valuation.
 *
 * Output is a contribution reference settlement value, never a
 * SunRey Coin quantity. Production valuation remains NOT_ACTIVATED.
 */

import { computeValuationDigest } from './digest.ts';
import { actorValuationRejection, validateValuationInput, valuationFirewallRejection } from './invariants.ts';
import { validateValuationPolicy } from './policy.ts';
import type {
  HumanContributionValuationPolicy,
  ValuationComputeResult,
  VerifiedContributionValuationInput,
} from './types.ts';

function scaleReference(quantity: bigint, numerator: bigint, denominator: bigint): bigint {
  return (quantity * numerator) / denominator;
}

export function valueVerifiedContribution(input: {
  readonly contribution: VerifiedContributionValuationInput;
  readonly policy: HumanContributionValuationPolicy;
  readonly actor: string;
  readonly valuationId?: string;
  readonly extra?: Readonly<Record<string, unknown>>;
}): ValuationComputeResult {
  if (input.extra) {
    const extraPoison = valuationFirewallRejection(input.extra);
    if (extraPoison) {
      return { ok: false, code: extraPoison };
    }
  }
  const actorRejection = actorValuationRejection(input.actor);
  if (actorRejection) {
    return { ok: false, code: actorRejection };
  }
  const contributionRejection = validateValuationInput(input.contribution);
  if (contributionRejection) {
    return { ok: false, code: contributionRejection };
  }
  const policyRejection = validateValuationPolicy(input.policy);
  if (policyRejection) {
    return { ok: false, code: policyRejection };
  }
  if (input.policy.jurisdictionPolicyRef !== input.contribution.jurisdictionPolicyRef) {
    return { ok: false, code: 'JURISDICTION_POLICY_MISMATCH' };
  }
  const raw = scaleReference(
    input.contribution.measurementQuantity,
    input.policy.unitScaleNumerator,
    input.policy.unitScaleDenominator,
  );
  if (raw <= 0n) {
    return { ok: false, code: 'INVALID_MEASUREMENT' };
  }
  if (raw > input.policy.perContributionReferenceCeiling) {
    return { ok: false, code: 'VALUATION_CAP_EXCEEDED' };
  }
  const valuationId =
    input.valuationId ?? `hcv.${input.contribution.contributionId}.${input.policy.version}`;
  const digest = computeValuationDigest({
    valuationId,
    contributionId: input.contribution.contributionId,
    fingerprint: input.contribution.fingerprint,
    valuationPolicyId: input.policy.policyId,
    valuationPolicyVersion: input.policy.version,
    valuationMethod: input.policy.method,
    finalReferenceValue: raw,
    referenceDenomination: input.policy.referenceDenomination,
  });
  return {
    ok: true,
    result: Object.freeze({
      schemaVersion: 1,
      valuationId,
      contributionId: input.contribution.contributionId,
      fingerprint: input.contribution.fingerprint,
      valuationPolicyId: input.policy.policyId,
      valuationPolicyVersion: input.policy.version,
      valuationMethod: input.policy.method,
      valuationDigest: digest,
      finalReferenceValue: raw,
      referenceDenomination: input.policy.referenceDenomination,
      jurisdictionPolicyRef: input.contribution.jurisdictionPolicyRef,
      status: 'ACTIVE',
      environment: input.policy.environment,
      simulationOnly: true,
      productionActivated: false,
      parameterClass: 'ENGINEERING_SIMULATION_PARAMETERS',
      peveUsedAsTokenFormula: false,
      humanWorthUsedAsValue: false,
      aiAuthorized: false,
      referenceValueEqualsSunReyByDefinition: false,
      sunReyQuantity: null,
    }),
  };
}

export function refuseProductionValuation(): ValuationComputeResult {
  return { ok: false, code: 'PRODUCTION_VALUATION_UNAVAILABLE' };
}
