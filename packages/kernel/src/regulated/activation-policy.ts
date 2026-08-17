import { modeAllowsLiveFinancialExecution, type RegulatedServiceMode } from './modes.ts';
import type { RegulatedServiceProvider } from './providers.ts';
import type { RegulatedServiceProviderRegistry } from './registry.ts';

export const PRODUCTION_ACTIVATION_POLICY_ID = 'sunrey-regulated-activation/1' as const;

export const REGULATED_ACTIVATION_CAPABILITIES = [
  'SUNREY_EXCHANGE',
  'INSTITUTIONAL_CUSTODY',
  'HUMAN_INFORMATION_MARKET',
  'PRODUCTIVE_CAPACITY_MARKET',
] as const;
export type RegulatedActivationCapability = (typeof REGULATED_ACTIVATION_CAPABILITIES)[number];

export type CapabilityReadinessFlags = {
  readonly software_ready: boolean;
  readonly security_ready: boolean;
  readonly operational_ready: boolean;
  readonly legal_ready: boolean;
  readonly regulatory_ready: boolean;
  readonly license_or_partner_ready: boolean;
  readonly human_authorized: boolean;
  readonly genesis_enabled: boolean;
  readonly runtime_enabled: boolean;
};

export type ProductionActivationDecision = {
  readonly policyId: typeof PRODUCTION_ACTIVATION_POLICY_ID;
  readonly mode: RegulatedServiceMode;
  readonly capability: RegulatedActivationCapability;
  readonly allowed: false;
  readonly liveFinancialExecution: false;
  readonly missingEvidence: readonly string[];
  readonly reasonCodes: readonly string[];
};

export function evaluateProductionActivation(input: {
  readonly mode: RegulatedServiceMode;
  readonly capability: RegulatedActivationCapability;
  readonly matrixRow: CapabilityReadinessFlags;
  readonly providers: readonly RegulatedServiceProvider[];
}): ProductionActivationDecision {
  const missing: string[] = [];
  const reasons: string[] = ['PRODUCTION_CANDIDATE_DISABLED'];
  if (modeAllowsLiveFinancialExecution(input.mode)) {
    reasons.push('LIVE_MODE_FORBIDDEN');
  }
  if (!input.matrixRow.legal_ready) {
    missing.push('legal_ready');
  }
  if (!input.matrixRow.regulatory_ready) {
    missing.push('regulatory_ready');
  }
  if (!input.matrixRow.license_or_partner_ready) {
    missing.push('license_or_partner_ready');
  }
  if (!input.matrixRow.human_authorized) {
    missing.push('human_authorized');
  }
  if (!input.matrixRow.security_ready) {
    missing.push('security_ready');
  }
  if (!input.matrixRow.operational_ready) {
    missing.push('operational_ready');
  }
  if (input.matrixRow.runtime_enabled || input.matrixRow.genesis_enabled) {
    reasons.push('RUNTIME_ENABLEMENT_FORBIDDEN');
  }
  for (const provider of input.providers) {
    if (provider.licenseRegistrationEvidence.completeness === 'MISSING') {
      missing.push(`${provider.providerId}:license`);
    }
    if (provider.activationEligibility !== 'PRODUCTION_CANDIDATE_DISABLED') {
      reasons.push('PROVIDER_NOT_PRODUCTION_ELIGIBLE');
    }
  }
  return Object.freeze({
    policyId: PRODUCTION_ACTIVATION_POLICY_ID,
    mode: input.mode,
    capability: input.capability,
    allowed: false,
    liveFinancialExecution: false,
    missingEvidence: Object.freeze(missing),
    reasonCodes: Object.freeze(reasons),
  });
}

export function requiredProvidersForCapability(
  capability: RegulatedActivationCapability,
  registry: RegulatedServiceProviderRegistry,
): readonly RegulatedServiceProvider[] {
  if (capability === 'SUNREY_EXCHANGE') {
    return Object.freeze([
      ...registry.requiredFor('IDENTITY_KYC'),
      ...registry.requiredFor('SANCTIONS_PEP'),
      ...registry.requiredFor('TRAVEL_RULE'),
      ...registry.requiredFor('MARKET_SURVEILLANCE'),
      ...registry.requiredFor('CASE_MANAGEMENT'),
    ]);
  }
  if (capability === 'INSTITUTIONAL_CUSTODY') {
    return Object.freeze([
      ...registry.requiredFor('CUSTODY_HSM'),
      ...registry.requiredFor('QUALIFIED_CUSTODY_REFERENCE'),
      ...registry.requiredFor('TRAVEL_RULE'),
    ]);
  }
  if (capability === 'HUMAN_INFORMATION_MARKET') {
    return Object.freeze([...registry.requiredFor('IDENTITY_KYC'), ...registry.requiredFor('CASE_MANAGEMENT')]);
  }
  return Object.freeze([...registry.requiredFor('MARKET_SURVEILLANCE'), ...registry.requiredFor('CASE_MANAGEMENT')]);
}
