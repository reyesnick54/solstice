import { err, ok, type Result } from '../../../../../domain/src/result.ts';
import type { AuthenticationMethod } from '../types.ts';
import type { TimestampSemantics } from './types.ts';
import {
  candidateRejection,
  type ExternalEconomicOracleProviderCandidateProfile,
  type ExternalProviderEndpointProfile,
  type ExternalProviderFeedProfile,
  type ProviderCandidateRejection,
} from './types.ts';

export const CANDIDATE_REVALIDATION_TRIGGERS = [
  'ENDPOINT_ORIGIN_CHANGE',
  'ENDPOINT_PATH_POLICY_CHANGE',
  'AUTHENTICATION_MECHANISM_CHANGE',
  'CREDENTIAL_GENERATION_CHANGE',
  'SCHEMA_VERSION_CHANGE',
  'UNIT_CHANGE',
  'TIMESTAMP_SEMANTICS_CHANGE',
  'CONTROLLER_CHANGE',
  'UPSTREAM_ORGANIZATION_CHANGE',
  'LICENSE_REFERENCE_CHANGE',
  'RIGHTS_REFERENCE_CHANGE',
  'SECURITY_EVIDENCE_CHANGE',
  'JURISDICTION_CONFIGURATION_CHANGE',
] as const;
export type CandidateRevalidationTrigger = (typeof CANDIDATE_REVALIDATION_TRIGGERS)[number];

export type CandidateRevalidationDecision = {
  readonly required: boolean;
  readonly triggers: readonly CandidateRevalidationTrigger[];
  readonly nextState: 'REVALIDATION_REQUIRED' | 'UNCHANGED';
};

export type CandidateRevalidationSnapshot = {
  readonly endpointOrigin: string;
  readonly pathPrefixes: readonly string[];
  readonly authenticationMethod: AuthenticationMethod;
  readonly credentialGeneration: number;
  readonly schemaVersion: number;
  readonly unit: string;
  readonly timestampSemantics: TimestampSemantics;
  readonly controllerId: string;
  readonly upstreamOrganizationId: string;
  readonly licenseRef: string | null;
  readonly rightsRef: string | null;
  readonly securityEvidenceRef: string | null;
  readonly jurisdictionRef: string | null;
};

export function snapshotForRevalidation(input: {
  readonly profile: ExternalEconomicOracleProviderCandidateProfile;
  readonly feed: ExternalProviderFeedProfile;
  readonly endpoint: ExternalProviderEndpointProfile;
  readonly authenticationMethod: AuthenticationMethod;
  readonly credentialGeneration: number;
}): CandidateRevalidationSnapshot {
  return Object.freeze({
    endpointOrigin: input.endpoint.baseOrigin,
    pathPrefixes: input.endpoint.allowedPathPrefixes,
    authenticationMethod: input.authenticationMethod,
    credentialGeneration: input.credentialGeneration,
    schemaVersion: input.feed.providerSchemaVersion,
    unit: input.feed.sourceUnit,
    timestampSemantics: input.feed.timestampSemantics,
    controllerId: input.profile.controllerId,
    upstreamOrganizationId: input.profile.upstreamOrganizationId,
    licenseRef: input.profile.dataLicenseEvidenceRef,
    rightsRef: input.profile.usageRightsEvidenceRef,
    securityEvidenceRef: input.profile.securityReviewEvidenceRef,
    jurisdictionRef: input.profile.jurisdictionReviewEvidenceRef,
  });
}

export function evaluateCandidateRevalidation(
  previous: CandidateRevalidationSnapshot,
  next: CandidateRevalidationSnapshot,
): CandidateRevalidationDecision {
  const triggers: CandidateRevalidationTrigger[] = [];
  if (previous.endpointOrigin !== next.endpointOrigin) triggers.push('ENDPOINT_ORIGIN_CHANGE');
  if (previous.pathPrefixes.join('\0') !== next.pathPrefixes.join('\0')) triggers.push('ENDPOINT_PATH_POLICY_CHANGE');
  if (previous.authenticationMethod !== next.authenticationMethod) triggers.push('AUTHENTICATION_MECHANISM_CHANGE');
  if (previous.credentialGeneration !== next.credentialGeneration) triggers.push('CREDENTIAL_GENERATION_CHANGE');
  if (previous.schemaVersion !== next.schemaVersion) triggers.push('SCHEMA_VERSION_CHANGE');
  if (previous.unit !== next.unit) triggers.push('UNIT_CHANGE');
  if (previous.timestampSemantics !== next.timestampSemantics) triggers.push('TIMESTAMP_SEMANTICS_CHANGE');
  if (previous.controllerId !== next.controllerId) triggers.push('CONTROLLER_CHANGE');
  if (previous.upstreamOrganizationId !== next.upstreamOrganizationId) triggers.push('UPSTREAM_ORGANIZATION_CHANGE');
  if (previous.licenseRef !== next.licenseRef) triggers.push('LICENSE_REFERENCE_CHANGE');
  if (previous.rightsRef !== next.rightsRef) triggers.push('RIGHTS_REFERENCE_CHANGE');
  if (previous.securityEvidenceRef !== next.securityEvidenceRef) triggers.push('SECURITY_EVIDENCE_CHANGE');
  if (previous.jurisdictionRef !== next.jurisdictionRef) triggers.push('JURISDICTION_CONFIGURATION_CHANGE');
  return Object.freeze({
    required: triggers.length > 0,
    triggers: Object.freeze(triggers),
    nextState: triggers.length > 0 ? 'REVALIDATION_REQUIRED' : 'UNCHANGED',
  });
}

export function requireRevalidation(
  previous: CandidateRevalidationSnapshot,
  next: CandidateRevalidationSnapshot,
): Result<true, ProviderCandidateRejection> {
  const decision = evaluateCandidateRevalidation(previous, next);
  if (decision.required) {
    return err(candidateRejection('REVALIDATION_REQUIRED', decision.triggers.join(',')));
  }
  return ok(true);
}
