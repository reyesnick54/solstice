/**
 * Chunk 150 — external economic oracle provider production-candidate types.
 *
 * Provider-neutral onboarding layer for later real economic-data providers.
 * Extends Chunks 127/128/138/149. Not a second oracle, mint, or runtime.
 *
 * This plane stops before a real network request. Transports are injected.
 */

import type { FactType } from '../../types.ts';
import type { ProductiveCategory } from '../../../productive/types.ts';
import type { DataSourceCategory } from '../../../productive/source-taxonomy/types.ts';
import type { AuthenticationMethod, EvidenceConfirmationState } from '../types.ts';
import type { ConnectorHttpMethod, ConnectorNetworkClass } from '../runtime-types.ts';
import type { ProviderFamilyId } from '../economic-data-fabric/types.ts';

export const EXTERNAL_PROVIDER_CANDIDATE_ID = 'sunrey.oracle.external-provider-candidate.v1' as const;
export const EXTERNAL_PROVIDER_CANDIDATE_VERSION = 1 as const;

export const REAL_EXTERNAL_PROVIDER_CONFIGURED = false as const;
export const REAL_NETWORK_CALLED = false as const;
export const CONSENSUS_CALLS_HTTP = false as const;
export const RAW_CREDENTIALS_PRESENT = false as const;
export const REFERENCE_PRICE_MINTS = false as const;
export const PROVIDER_SUCCESS_MINTS = false as const;
export const PRODUCTION_ACTIVE = false as const;
export const VENDOR_DTO_ESCAPES_ADAPTER = false as const;
export const CONNECTOR_FINALIZES_FACTS = false as const;

export const PROVIDER_CANDIDATE_STATES = [
  'DRAFT',
  'ENGINEERING_SANDBOX',
  'CONFORMANCE_PASSED',
  'EXTERNAL_EVIDENCE_REQUIRED',
  'PRODUCTION_CANDIDATE_DISABLED',
  'SUSPENDED',
  'REVOKED',
] as const;
export type ProviderCandidateState = (typeof PROVIDER_CANDIDATE_STATES)[number];

export const TIMESTAMP_SEMANTICS = [
  'SOURCE_EVENT_TIME',
  'INTERVAL_START_END',
  'SNAPSHOT_TIME',
  'CUMULATIVE_REGISTER_TIME',
] as const;
export type TimestampSemantics = (typeof TIMESTAMP_SEMANTICS)[number];

export const PAGINATION_MODES = ['NONE', 'CURSOR', 'PAGE_NUMBER', 'TIME_WINDOW'] as const;
export type PaginationMode = (typeof PAGINATION_MODES)[number];

export const PROVIDER_FAMILY_ROUTES = [
  'energy',
  'compute',
  'ai',
  'manufacturing',
  'logistics',
  'storage',
  'resources',
  'agriculture',
  'food',
  'water',
  'real-estate',
  'infrastructure',
  'bandwidth',
  'goods',
  'services',
  'reference-data',
] as const;
export type ProviderFamilyRoute = (typeof PROVIDER_FAMILY_ROUTES)[number];

export const PROVIDER_CANDIDATE_REJECTION_CODES = [
  'PROFILE_INVALID',
  'ENDPOINT_NOT_APPROVED',
  'UNAPPROVED_HOSTNAME',
  'REDIRECT_ESCAPE',
  'CREDENTIAL_IN_URL',
  'AUTHORIZATION_IN_BLUEPRINT',
  'OAUTH_TOKEN_LEAK',
  'ARBITRARY_URL_FORBIDDEN',
  'SSRF_DESTINATION_FORBIDDEN',
  'TLS_POLICY_VIOLATION',
  'RESPONSE_TOO_LARGE',
  'CONTENT_TYPE_INVALID',
  'SCHEMA_DRIFT',
  'UNIT_DRIFT',
  'UNIT_EXTENSION_REQUIRED',
  'TIMESTAMP_MISSING',
  'TIMESTAMP_SEMANTICS_DRIFT',
  'REVALIDATION_REQUIRED',
  'PAGINATION_BOUND_EXCEEDED',
  'CURSOR_LOOP_DETECTED',
  'PARTIAL_PAGE_FAILURE',
  'DUPLICATE_OBSERVATION',
  'SAME_UPSTREAM_NOT_INDEPENDENT',
  'PROVIDER_SUSPENDED',
  'PROVIDER_REVOKED',
  'EXPIRED_CREDENTIAL',
  'CONTRACT_PLACEHOLDER_IS_NOT_PROOF',
  'REFERENCE_PRICE_IS_NOT_PRODUCTIVE',
  'VENDOR_DTO_ESCAPE_FORBIDDEN',
  'RATE_LIMITED',
  'CIRCUIT_OPEN',
  'AUTH_FAILED',
  'FAMILY_ROUTING_INVALID',
  'SOURCE_IDENTITY_INVALID',
  'SECRET_RESOLUTION_FORBIDDEN',
] as const;
export type ProviderCandidateRejectionCode = (typeof PROVIDER_CANDIDATE_REJECTION_CODES)[number];

export type ProviderCandidateRejection = {
  readonly code: ProviderCandidateRejectionCode;
  readonly detail: string;
};

export type ExternalProviderFeedProfile = {
  readonly feedId: string;
  readonly sourceId: string;
  readonly subjectNamespace: string;
  readonly familyRoute: ProviderFamilyRoute;
  readonly familyId: ProviderFamilyId;
  readonly dataSourceCategory: DataSourceCategory;
  readonly factType: FactType;
  readonly productiveCategory: ProductiveCategory | null;
  readonly timestampSemantics: TimestampSemantics;
  readonly sourceUnit: string;
  readonly canonicalUnitPath: string;
  readonly normalizationVersion: string;
  readonly sourceObservationIdMapping: string;
  readonly providerSchemaId: string;
  readonly providerSchemaVersion: number;
  readonly canonicalSchemaId: string;
  readonly mappingVersion: number;
  readonly paginationMode: PaginationMode;
  readonly maxPages: number;
  readonly maxRecordsPerPage: number;
  readonly isReferencePrice: boolean;
};

export type ExternalEconomicOracleProviderCandidateProfile = {
  readonly profileId: string;
  readonly version: number;
  readonly providerId: string;
  readonly legalEntityReference: string | null;
  readonly controllerId: string;
  readonly upstreamOrganizationId: string;
  readonly sharedControlGroup: string | null;
  readonly dataSourceCategories: readonly DataSourceCategory[];
  readonly factTypes: readonly FactType[];
  readonly productiveCategories: readonly ProductiveCategory[];
  readonly feedProfiles: readonly ExternalProviderFeedProfile[];
  readonly authenticationProfileRef: string;
  readonly credentialDescriptorRef: string;
  readonly endpointProfileIds: readonly string[];
  readonly infrastructureRegion: string;
  readonly dataResidencyReference: string | null;
  readonly commercialAgreementEvidenceRef: string | null;
  readonly dataLicenseEvidenceRef: string | null;
  readonly usageRightsEvidenceRef: string | null;
  readonly securityReviewEvidenceRef: string | null;
  readonly jurisdictionReviewEvidenceRef: string | null;
  readonly providerAcceptanceRef: string | null;
  readonly certificationProfileRef: string | null;
  readonly state: ProviderCandidateState;
  readonly productionAuthorized: false;
};

export type ExternalProviderEndpointProfile = {
  readonly endpointProfileId: string;
  readonly providerId: string;
  readonly baseOrigin: string;
  readonly allowedPathPrefixes: readonly string[];
  readonly allowedMethods: readonly ConnectorHttpMethod[];
  readonly allowedQueryParameters: readonly string[];
  readonly expectedContentTypes: readonly string[];
  readonly timeoutMs: number;
  readonly maxResponseBytes: number;
  readonly maxRedirects: number;
  readonly tlsRequired: true;
  readonly privateNetworkRequired: boolean;
  readonly authProfileRef: string;
  readonly rateLimitProfileRef: string;
  readonly networkZone: ConnectorNetworkClass;
  readonly active: boolean;
};

export type ExternalProviderRequestBlueprint = {
  readonly providerId: string;
  readonly feedId: string;
  readonly endpointProfileId: string;
  readonly method: ConnectorHttpMethod;
  readonly pathTemplate: string;
  readonly approvedHeaderNames: readonly string[];
  readonly queryTemplate: Readonly<Record<string, string>>;
  readonly paginationMode: PaginationMode;
  readonly schemaVersion: number;
  readonly expectedResponseSchemaId: string;
  readonly credentialDescriptorRef: string;
  readonly idempotencyKey: string | null;
};

export type ExternalProviderRateLimitProfile = {
  readonly profileId: string;
  readonly requestsPerWindow: number;
  readonly windowMs: number;
  readonly burst: number;
  readonly retryAfterMs: number;
  readonly cooldownMs: number;
};

export type OauthTokenHandle = {
  readonly handleId: string;
  readonly providerId: string;
  readonly expiresAtUnix: bigint;
  readonly tokenMaterial: null;
  readonly persisted: false;
};

export type ExternalProviderCredentialBinding = {
  readonly descriptorRef: string;
  readonly providerId: string;
  readonly authenticationMethod: AuthenticationMethod;
  readonly secretReferenceHref: string | null;
  readonly mtlsCertificateRef: string | null;
  readonly oauthClientRef: string | null;
  readonly generation: number;
  readonly expiresAtUnix: bigint | null;
  readonly resolvedMaterial: null;
  readonly plaintextPresent: false;
};

export type ExternalEvidencePlaceholder = {
  readonly kind:
    | 'contract'
    | 'data_license'
    | 'usage_rights'
    | 'security_review'
    | 'jurisdiction_review'
    | 'service_level_agreement';
  readonly reference: string | null;
  readonly confirmationState: EvidenceConfirmationState;
};

export type ExternalEconomicProviderOnboardingPacket = {
  readonly packetId: string;
  readonly profileId: string;
  readonly profileHash: string;
  readonly feedHashes: readonly string[];
  readonly endpointProfileHashes: readonly string[];
  readonly schemaMappingHashes: readonly string[];
  readonly credentialBindingReferences: readonly string[];
  readonly sourceRelationships: readonly {
    readonly sourceId: string;
    readonly controllerId: string;
    readonly upstreamOrganizationId: string;
    readonly sharedControlGroup: string | null;
  }[];
  readonly technicalTestEvidenceRef: string | null;
  readonly certificationEvidenceRef: string | null;
  readonly externalEvidence: readonly ExternalEvidencePlaceholder[];
  readonly humanReviewReferences: readonly string[];
  readonly productionAuthorized: false;
};

export type CandidateCoverageRow = {
  readonly productiveCategory: ProductiveCategory | 'REFERENCE_DATA';
  readonly candidateProfileArchitectureSupported: boolean;
  readonly sourceFamilyMappingSupported: boolean;
  readonly unitPathSupported: boolean;
  readonly certificationPathSupported: boolean;
  readonly endpointBlueprintSupported: boolean;
  readonly realExternalProviderConfigured: false;
  readonly externalEvidencePresent: boolean;
};

export type ProviderCandidateCoverageReport = {
  readonly reportId: typeof EXTERNAL_PROVIDER_CANDIDATE_ID;
  readonly version: typeof EXTERNAL_PROVIDER_CANDIDATE_VERSION;
  readonly rows: readonly CandidateCoverageRow[];
  readonly realExternalProviderConfigured: false;
  readonly realNetworkCalled: false;
  readonly productionActive: false;
};

export function candidateRejection(
  code: ProviderCandidateRejectionCode,
  detail: string,
): ProviderCandidateRejection {
  return Object.freeze({ code, detail });
}

export function realExternalProviderConfigured(): false {
  return REAL_EXTERNAL_PROVIDER_CONFIGURED;
}

export function realNetworkCalled(): false {
  return REAL_NETWORK_CALLED;
}

export function consensusCallsHttp(): false {
  return CONSENSUS_CALLS_HTTP;
}

export function providerSuccessMints(): false {
  return PROVIDER_SUCCESS_MINTS;
}

export function referencePriceMints(): false {
  return REFERENCE_PRICE_MINTS;
}

export function productionIsActive(): false {
  return PRODUCTION_ACTIVE;
}
