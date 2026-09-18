import type { UtcInstant } from '../../../../domain/src/time.ts';

/** Platform-local mirror of kernel capability query outcomes — no kernel import. */
export const HELIOS_CAPABILITY_QUERY_OUTCOMES = [
  'ALLOWED',
  'DENIED',
  'RESTRICTED',
  'REVIEW_REQUIRED',
  'UNKNOWN',
] as const;

export type HeliosCapabilityQueryOutcome = (typeof HELIOS_CAPABILITY_QUERY_OUTCOMES)[number];

export type HeliosJurisdictionCapabilityResult = {
  readonly outcome: HeliosCapabilityQueryOutcome;
  readonly jurisdictionId: string | null;
  readonly resolvedOverlayId: string | null;
  readonly legalEntityId: string;
  readonly policyVersion: string;
  readonly capabilityId: string | null;
  readonly capabilityStatus: string | null;
  readonly reasonCodes: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly requiredControls: readonly string[];
  readonly requiredApprovalClass: string | null;
  readonly reportingObligationRefs: readonly string[];
  readonly providerDependency: string | null;
  readonly restrictions: readonly string[];
  readonly evaluatedAt: UtcInstant;
};

export type HeliosJurisdictionCapabilityQueryInput = {
  readonly legalEntityId: string;
  readonly customerId: string;
  readonly customerClass: string;
  readonly jurisdiction: string;
  readonly productId: string;
  readonly action: string;
  readonly accountId: string;
  readonly accountClass: string;
  readonly providerId?: string;
  readonly instrumentClass?: string;
  readonly environment: 'simulation' | 'live';
  readonly stateOverlay?: string;
  readonly memberState?: string;
  readonly at: UtcInstant;
};

export type HeliosJurisdictionCapabilityPort = {
  query(input: HeliosJurisdictionCapabilityQueryInput): HeliosJurisdictionCapabilityResult;
};
