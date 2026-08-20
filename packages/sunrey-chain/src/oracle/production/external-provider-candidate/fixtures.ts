import type { AuthenticationMethod } from '../types.ts';
import type { FeedSchemaDefinition } from '../types.ts';
import type { ConnectorHttpMethod } from '../runtime-types.ts';
import { bindCredentialDescriptor } from './credentials.ts';
import type {
  ExternalEconomicOracleProviderCandidateProfile,
  ExternalProviderCredentialBinding,
  ExternalProviderEndpointProfile,
  ExternalProviderFeedProfile,
  ExternalProviderRequestBlueprint,
  ProviderFamilyRoute,
} from './types.ts';

export const CANDIDATE_NOW_UNIX = 1_700_000_000n;

function feed(input: {
  readonly providerId: string;
  readonly familyRoute: ProviderFamilyRoute;
  readonly familyId: ExternalProviderFeedProfile['familyId'];
  readonly category: ExternalProviderFeedProfile['dataSourceCategory'];
  readonly factType: ExternalProviderFeedProfile['factType'];
  readonly productiveCategory: ExternalProviderFeedProfile['productiveCategory'];
  readonly unit: string;
  readonly schemaId: string;
  readonly isReferencePrice?: boolean;
}): ExternalProviderFeedProfile {
  const sourceId = `src_${input.providerId}`;
  return Object.freeze({
    feedId: `feed_${input.providerId}`,
    sourceId,
    subjectNamespace: `ns.${input.providerId}`,
    familyRoute: input.familyRoute,
    familyId: input.familyId,
    dataSourceCategory: input.category,
    factType: input.factType,
    productiveCategory: input.productiveCategory,
    timestampSemantics: 'SOURCE_EVENT_TIME',
    sourceUnit: input.unit,
    canonicalUnitPath: `${input.unit}->${input.unit}`,
    normalizationVersion: 'sunrey.economic-unit.normalization.v1',
    sourceObservationIdMapping: 'provider.source.feed.subject.timestamp.value',
    providerSchemaId: 'fixture.vendor.v1',
    providerSchemaVersion: 1,
    canonicalSchemaId: input.schemaId,
    mappingVersion: 1,
    paginationMode: 'NONE',
    maxPages: 3,
    maxRecordsPerPage: 8,
    isReferencePrice: input.isReferencePrice ?? false,
  });
}

function endpoint(input: {
  readonly providerId: string;
  readonly path: string;
  readonly method?: ConnectorHttpMethod;
}): ExternalProviderEndpointProfile {
  return Object.freeze({
    endpointProfileId: `endpoint_${input.providerId}`,
    providerId: input.providerId,
    baseOrigin: `https://${input.providerId}.oracle.test`,
    allowedPathPrefixes: Object.freeze([input.path]),
    allowedMethods: Object.freeze([input.method ?? 'GET']),
    allowedQueryParameters: Object.freeze(['cursor', 'page', 'windowStart', 'windowEnd']),
    expectedContentTypes: Object.freeze(['application/json']),
    timeoutMs: 250,
    maxResponseBytes: 4_096,
    maxRedirects: 0,
    tlsRequired: true,
    privateNetworkRequired: false,
    authProfileRef: `auth.${input.providerId}`,
    rateLimitProfileRef: `rate.${input.providerId}`,
    networkZone: 'PUBLIC_INTERNET',
    active: true,
  });
}

function profile(input: {
  readonly providerId: string;
  readonly auth: AuthenticationMethod;
  readonly feed: ExternalProviderFeedProfile;
  readonly state?: ExternalEconomicOracleProviderCandidateProfile['state'];
}): ExternalEconomicOracleProviderCandidateProfile {
  return Object.freeze({
    profileId: `profile_${input.providerId}`,
    version: 1,
    providerId: input.providerId,
    legalEntityReference: `legal.${input.providerId}`,
    controllerId: `controller_${input.providerId}`,
    upstreamOrganizationId: `upstream_${input.providerId}`,
    sharedControlGroup: null,
    dataSourceCategories: Object.freeze([input.feed.dataSourceCategory]),
    factTypes: Object.freeze([input.feed.factType]),
    productiveCategories: Object.freeze(input.feed.productiveCategory ? [input.feed.productiveCategory] : []),
    feedProfiles: Object.freeze([input.feed]),
    authenticationProfileRef: `auth.${input.providerId}`,
    credentialDescriptorRef: `cred.desc.${input.providerId}`,
    endpointProfileIds: Object.freeze([`endpoint_${input.providerId}`]),
    infrastructureRegion: 'sim-east',
    dataResidencyReference: 'residency.sim',
    commercialAgreementEvidenceRef: `contract-placeholder-${input.providerId}`,
    dataLicenseEvidenceRef: `license-placeholder-${input.providerId}`,
    usageRightsEvidenceRef: `rights-placeholder-${input.providerId}`,
    securityReviewEvidenceRef: `security-placeholder-${input.providerId}`,
    jurisdictionReviewEvidenceRef: `jurisdiction-placeholder-${input.providerId}`,
    providerAcceptanceRef: `acceptance.${input.providerId}`,
    certificationProfileRef: `cert.${input.providerId}`,
    state: input.state ?? 'ENGINEERING_SANDBOX',
    productionAuthorized: false,
  });
}

function blueprint(providerId: string, path: string, method: ConnectorHttpMethod = 'GET'): ExternalProviderRequestBlueprint {
  return Object.freeze({
    providerId,
    feedId: `feed_${providerId}`,
    endpointProfileId: `endpoint_${providerId}`,
    method,
    pathTemplate: path,
    approvedHeaderNames: Object.freeze(['accept', 'x-request-id']),
    queryTemplate: Object.freeze({}),
    paginationMode: 'NONE',
    schemaVersion: 1,
    expectedResponseSchemaId: 'fixture.vendor.v1',
    credentialDescriptorRef: `cred.desc.${providerId}`,
    idempotencyKey: `idem.${providerId}.1`,
  });
}

export const FIXTURE_ENERGY_MTLS_ID = 'fixture-energy-mtls';
export const FIXTURE_COMPUTE_OAUTH_ID = 'fixture-compute-oauth';
export const FIXTURE_MANUFACTURING_API_KEY_ID = 'fixture-manufacturing-api-key';
export const FIXTURE_LOGISTICS_SIGNED_ID = 'fixture-logistics-signed-request';

export const fixtureEnergyFeed = feed({
  providerId: FIXTURE_ENERGY_MTLS_ID,
  familyRoute: 'energy',
  familyId: 'ENERGY',
  category: 'energy',
  factType: 'ENERGY_PRODUCTION',
  productiveCategory: 'ENERGY',
  unit: 'MWh',
  schemaId: 'energy.resource.v1',
});

export const fixtureComputeFeed = feed({
  providerId: FIXTURE_COMPUTE_OAUTH_ID,
  familyRoute: 'compute',
  familyId: 'COMPUTE',
  category: 'compute',
  factType: 'COMPUTE_USAGE',
  productiveCategory: 'COMPUTE',
  unit: 'compute_s',
  schemaId: 'compute.usage.v1',
});

export const fixtureManufacturingFeed = feed({
  providerId: FIXTURE_MANUFACTURING_API_KEY_ID,
  familyRoute: 'manufacturing',
  familyId: 'MANUFACTURING',
  category: 'manufacturing',
  factType: 'MANUFACTURING_OUTPUT',
  productiveCategory: 'MANUFACTURING',
  unit: 'units_produced',
  schemaId: 'manufacturing.output.v1',
});

export const fixtureLogisticsFeed = feed({
  providerId: FIXTURE_LOGISTICS_SIGNED_ID,
  familyRoute: 'logistics',
  familyId: 'LOGISTICS',
  category: 'logistics',
  factType: 'LOGISTICS_CAPACITY',
  productiveCategory: 'LOGISTICS_TRANSPORTATION',
  unit: 'tonne_km',
  schemaId: 'logistics.capacity.v1',
});

export const fixtureReferencePriceFeed = feed({
  providerId: 'fixture-reference-price',
  familyRoute: 'reference-data',
  familyId: 'REFERENCE_DATA',
  category: 'reference_price',
  factType: 'REFERENCE_PRICE',
  productiveCategory: null,
  unit: 'MWh',
  schemaId: 'ENERGY_REFERENCE_PRICE_V1',
  isReferencePrice: true,
});

export const fixtureEnergyProfile = profile({
  providerId: FIXTURE_ENERGY_MTLS_ID,
  auth: 'MTLS',
  feed: fixtureEnergyFeed,
});

export const fixtureComputeProfile = profile({
  providerId: FIXTURE_COMPUTE_OAUTH_ID,
  auth: 'OAUTH_CLIENT',
  feed: fixtureComputeFeed,
});

export const fixtureManufacturingProfile = profile({
  providerId: FIXTURE_MANUFACTURING_API_KEY_ID,
  auth: 'API_KEY_REFERENCE',
  feed: fixtureManufacturingFeed,
});

export const fixtureLogisticsProfile = profile({
  providerId: FIXTURE_LOGISTICS_SIGNED_ID,
  auth: 'SIGNED_REQUEST',
  feed: fixtureLogisticsFeed,
});

export const fixtureEnergyEndpoint = endpoint({ providerId: FIXTURE_ENERGY_MTLS_ID, path: '/v1/energy' });
export const fixtureComputeEndpoint = endpoint({ providerId: FIXTURE_COMPUTE_OAUTH_ID, path: '/v1/compute' });
export const fixtureManufacturingEndpoint = endpoint({
  providerId: FIXTURE_MANUFACTURING_API_KEY_ID,
  path: '/v1/manufacturing',
});
export const fixtureLogisticsEndpoint = endpoint({ providerId: FIXTURE_LOGISTICS_SIGNED_ID, path: '/v1/logistics' });

export const fixtureEnergyBlueprint = blueprint(FIXTURE_ENERGY_MTLS_ID, '/v1/energy');
export const fixtureComputeBlueprint = blueprint(FIXTURE_COMPUTE_OAUTH_ID, '/v1/compute');
export const fixtureManufacturingBlueprint = blueprint(FIXTURE_MANUFACTURING_API_KEY_ID, '/v1/manufacturing');
export const fixtureLogisticsBlueprint = blueprint(FIXTURE_LOGISTICS_SIGNED_ID, '/v1/logistics');

export function fixtureBinding(providerId: string, method: AuthenticationMethod): ExternalProviderCredentialBinding {
  const bound = bindCredentialDescriptor({
    descriptorRef: `cred.desc.${providerId}`,
    providerId,
    authenticationMethod: method,
    secretPath: `oracle/${providerId}`,
    mtlsCertificateRef: method === 'MTLS' ? `cert.ref.${providerId}` : undefined,
    oauthClientRef: method === 'OAUTH_CLIENT' ? `oauth.client.${providerId}` : undefined,
    generation: 1,
    expiresAtUnix: CANDIDATE_NOW_UNIX + 3_600n,
  });
  if (!bound.ok) {
    throw new Error(bound.error.detail);
  }
  return bound.value;
}

export function fixtureSchema(feed: ExternalProviderFeedProfile): FeedSchemaDefinition {
  return Object.freeze({
    schemaVersion: 1,
    schemaId: feed.canonicalSchemaId,
    version: 1,
    factType: feed.factType,
    requiredFields: Object.freeze(['identifier', 'numericValue', 'unit', 'sourceTimestampUnix']),
    unit: feed.sourceUnit as FeedSchemaDefinition['unit'],
    quantityScale: 0,
    identifierPattern: '^[A-Za-z0-9_.:-]+$',
    maxRecordBytes: 2_048,
    maxArrayLength: 8,
    allowFloat: false,
    breakingChangeCreatesNewVersion: true,
  });
}

export function vendorEnergyBody(overrides: { readonly identifier?: string; readonly value?: string; readonly unit?: string; readonly timestamp?: string } = {}): string {
  return JSON.stringify({
    schemaId: 'fixture.vendor.v1',
    schemaVersion: 1,
    identifier: overrides.identifier ?? 'plant_sim_1',
    value: overrides.value ?? '100',
    unit: overrides.unit ?? 'MWh',
    timestamp: overrides.timestamp ?? CANDIDATE_NOW_UNIX.toString(),
  });
}

export function vendorPagedBody(pages: readonly { readonly identifier: string; readonly value: string; readonly cursor?: string | null }[]): readonly string[] {
  return pages.map((page, index) =>
    JSON.stringify({
      records: [
        {
          schemaId: 'fixture.vendor.v1',
          schemaVersion: 1,
          identifier: page.identifier,
          value: page.value,
          unit: 'MWh',
          timestamp: (CANDIDATE_NOW_UNIX + BigInt(index)).toString(),
        },
      ],
      nextCursor: page.cursor ?? null,
    }),
  );
}
