import { sha256Hex } from '../../../../../security/src/hash.ts';
import { profileExternalEvidence } from './evidence.ts';
import type {
  ExternalEconomicOracleProviderCandidateProfile,
  ExternalEconomicProviderOnboardingPacket,
  ExternalProviderEndpointProfile,
  ExternalProviderFeedProfile,
} from './types.ts';

function stableHash(label: string, value: unknown): string {
  return sha256Hex(`chunk150.${label}:${JSON.stringify(value)}`);
}

export function hashProfile(profile: ExternalEconomicOracleProviderCandidateProfile): string {
  return stableHash('profile', profile);
}

export function hashFeed(feed: ExternalProviderFeedProfile): string {
  return stableHash('feed', {
    feedId: feed.feedId,
    sourceId: feed.sourceId,
    schema: `${feed.providerSchemaId}:${feed.providerSchemaVersion}:${feed.canonicalSchemaId}:${feed.mappingVersion}`,
    unit: `${feed.sourceUnit}:${feed.canonicalUnitPath}:${feed.normalizationVersion}`,
    timestampSemantics: feed.timestampSemantics,
  });
}

export function hashEndpoint(endpoint: ExternalProviderEndpointProfile): string {
  return stableHash('endpoint', {
    endpointProfileId: endpoint.endpointProfileId,
    baseOrigin: endpoint.baseOrigin,
    allowedPathPrefixes: endpoint.allowedPathPrefixes,
    allowedMethods: endpoint.allowedMethods,
    allowedQueryParameters: endpoint.allowedQueryParameters,
  });
}

export function hashSchemaMapping(feed: ExternalProviderFeedProfile): string {
  return stableHash('mapping', {
    providerSchemaId: feed.providerSchemaId,
    providerSchemaVersion: feed.providerSchemaVersion,
    canonicalSchemaId: feed.canonicalSchemaId,
    mappingVersion: feed.mappingVersion,
  });
}

export function buildOnboardingPacket(input: {
  readonly profile: ExternalEconomicOracleProviderCandidateProfile;
  readonly endpoints: readonly ExternalProviderEndpointProfile[];
  readonly technicalTestEvidenceRef?: string | null;
  readonly certificationEvidenceRef?: string | null;
  readonly humanReviewReferences?: readonly string[];
}): ExternalEconomicProviderOnboardingPacket {
  return Object.freeze({
    packetId: `onboard:${input.profile.profileId}:${input.profile.version}`,
    profileId: input.profile.profileId,
    profileHash: hashProfile(input.profile),
    feedHashes: Object.freeze(input.profile.feedProfiles.map(hashFeed)),
    endpointProfileHashes: Object.freeze(input.endpoints.map(hashEndpoint)),
    schemaMappingHashes: Object.freeze(input.profile.feedProfiles.map(hashSchemaMapping)),
    credentialBindingReferences: Object.freeze([input.profile.credentialDescriptorRef]),
    sourceRelationships: Object.freeze(
      input.profile.feedProfiles.map((feed) =>
        Object.freeze({
          sourceId: feed.sourceId,
          controllerId: input.profile.controllerId,
          upstreamOrganizationId: input.profile.upstreamOrganizationId,
          sharedControlGroup: input.profile.sharedControlGroup,
        }),
      ),
    ),
    technicalTestEvidenceRef: input.technicalTestEvidenceRef ?? null,
    certificationEvidenceRef: input.certificationEvidenceRef ?? input.profile.certificationProfileRef,
    externalEvidence: profileExternalEvidence(input.profile),
    humanReviewReferences: Object.freeze([...(input.humanReviewReferences ?? [])]),
    productionAuthorized: false,
  });
}

export function sameUpstreamNotIndependent(
  left: { readonly controllerId: string; readonly upstreamOrganizationId: string; readonly sharedControlGroup: string | null },
  right: { readonly controllerId: string; readonly upstreamOrganizationId: string; readonly sharedControlGroup: string | null },
): boolean {
  if (left.controllerId === right.controllerId) {
    return true;
  }
  if (left.upstreamOrganizationId === right.upstreamOrganizationId) {
    return true;
  }
  if (left.sharedControlGroup !== null && left.sharedControlGroup === right.sharedControlGroup) {
    return true;
  }
  return false;
}
