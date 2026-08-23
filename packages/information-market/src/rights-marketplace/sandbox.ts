import type { Clock } from '../../../config/src/clock.ts';
import { InformationRightsMarketplace, type ConsentPort } from './service.ts';

export function alwaysActiveConsent(): ConsentPort {
  return {
    isActive() {
      return true;
    },
  };
}

export function createSandboxRightsMarketplace(clock: Clock, rightsHolder: string): InformationRightsMarketplace {
  const market = new InformationRightsMarketplace({
    clock,
    consent: alwaysActiveConsent(),
  });
  const policies = market.defaultSimulationPolicies();
  const right = unwrap(
    market.registerRight({
      rightsHolder,
      underlyingCategory: 'FINANCIAL_ACTIVITY_METADATA',
      scope: 'derived activity metadata for authorized research',
      eligiblePurposes: ['RESEARCH', 'AGGREGATED_ANALYTICS', 'STATISTICAL_INSIGHT'],
      prohibitedPurposes: ['MARKETING', 'CREDIT_DECISIONING'],
      jurisdiction: 'GB',
      privacyRequirements: ['NO_RAW_EXPORT', 'MIN_COHORT'],
      consentDependency: 'canonical-consent',
      termsVersion: 'irm-terms-v1',
    }),
  );
  const product = unwrap(
    market.createDataProduct(rightsHolder, {
      form: 'HIN_AGGREGATE',
      displayName: 'Simulation HIN aggregate',
      rightIds: [right.rightId],
      classification: 'DERIVED_AGGREGATE',
      eligiblePurposes: ['RESEARCH', 'AGGREGATED_ANALYTICS'],
      purpose: 'RESEARCH',
      minimumAggregationThreshold: 10,
      jurisdiction: 'GB',
      retentionDays: 30,
      privacyPolicyVersion: 'irm-privacy-v1',
      consentRef: 'consent_sandbox_hin',
      cohortSize: 25,
    }),
  );
  const request = unwrap(
    market.requestLicense({
      licenseeId: 'licensee_sandbox_research',
      productId: product.productId,
      purpose: 'RESEARCH',
      scope: 'aggregate research queries',
      durationDays: 30,
      queryLimit: 8,
      downloadLimit: 0,
      jurisdiction: 'GB',
      consentRef: 'consent_sandbox_hin',
    }),
  );
  unwrap(
    market.approveAndActivate({
      requestId: request.requestId,
      actorId: 'actor_sandbox_hin',
      pricingPolicyId: policies.pricing.policyId,
      compensationPolicyId: policies.compensation.policyId,
      termsVersion: 'irm-terms-v1',
      paid: true,
    }),
  );
  return market;
}

function unwrap<T>(result: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } }): T {
  if (!result.ok) {
    throw new Error(`${result.error.code}: ${result.error.message}`);
  }
  return result.value;
}
