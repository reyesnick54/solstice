import { secretRef, InMemorySecretProvider } from '../../../../security/src/secrets.ts';
import { createCollectorIdentity } from './credentials.ts';
import { developmentProductionFeed } from './plane.ts';
import type { EconomicDataSource, OracleWorkloadIdentity, ProductionFeedConfiguration } from './types.ts';
import type { ConnectorAuthConfig, ProviderEndpointProfile } from './runtime-types.ts';

export const SANDBOX_NOW_UNIX = 1_700_000_000n;
export const SANDBOX_API_KEY = 'sandbox-api-key-not-for-production';
export const SANDBOX_OAUTH_CLIENT_ID = 'sandbox-client-id';
export const SANDBOX_OAUTH_CLIENT_SECRET = 'sandbox-client-secret';
export const SANDBOX_OAUTH_ACCESS_TOKEN = 'sandbox-access-token';
export const SANDBOX_SIGNING_KEY = 'sandbox-hmac-key-material';
export const SANDBOX_MTLS_CERT = 'sandbox-mtls-client-certificate-material';
export const SANDBOX_MTLS_KEY = 'sandbox-mtls-client-key-material';

export function sandboxEnergyRecord(sourceTimestampUnix = SANDBOX_NOW_UNIX.toString()): string {
  return JSON.stringify({
    identifier: 'plant_sim_1',
    numericValue: '100',
    unit: 'MWh',
    sourceTimestampUnix,
    schemaId: 'energy.resource.v1',
    schemaVersion: 1,
  });
}

export function sandboxEndpointProfile(
  overrides: Partial<ProviderEndpointProfile> = {},
): ProviderEndpointProfile {
  return Object.freeze({
    profileId: overrides.profileId ?? 'profile_sandbox_energy',
    providerId: overrides.providerId ?? 'oracle_sandbox',
    sourceId: overrides.sourceId ?? 'src_sandbox',
    scheme: overrides.scheme ?? 'https',
    hostname: overrides.hostname ?? 'sandbox.oracle.test',
    port: overrides.port ?? 443,
    pathPrefix: overrides.pathPrefix ?? '/v1/energy',
    allowedMethods: (overrides.allowedMethods ?? ['GET']) as ProviderEndpointProfile['allowedMethods'],
    authenticationClass: overrides.authenticationClass ?? 'API_KEY_REFERENCE',
    tlsPolicy: overrides.tlsPolicy ?? 'REQUIRE_VALID_CERTIFICATE',
    maximumResponseBytes: overrides.maximumResponseBytes ?? 2_048,
    timeoutMs: overrides.timeoutMs ?? 250,
    redirectPolicy: overrides.redirectPolicy ?? 'NONE',
    maxRedirects: overrides.maxRedirects ?? 0,
    networkClass: overrides.networkClass ?? 'PUBLIC_INTERNET',
    allowedContentTypes: overrides.allowedContentTypes ?? ['application/json'],
  });
}

export function sandboxTokenEndpointProfile(): ProviderEndpointProfile {
  return sandboxEndpointProfile({
    profileId: 'profile_sandbox_oauth_token',
    sourceId: 'src_sandbox_oauth',
    pathPrefix: '/oauth/token',
    allowedMethods: ['POST'],
    authenticationClass: 'OAUTH_CLIENT',
  });
}

export function sandboxSource(
  overrides: Partial<EconomicDataSource> = {},
): EconomicDataSource {
  return Object.freeze({
    schemaVersion: 1,
    sourceId: overrides.sourceId ?? 'src_sandbox',
    version: 1,
    providerId: overrides.providerId ?? 'oracle_sandbox',
    category: overrides.category ?? 'energy',
    factType: overrides.factType ?? 'ENERGY_PRODUCTION',
    feedId: overrides.feedId ?? 'feed_energy_production_sim',
    unit: overrides.unit ?? 'MWh',
    schemaId: overrides.schemaId ?? 'energy.resource.v1',
    sourceSchemaVersion: 1,
    normalizationVersion: 'sunrey.economic-unit.normalization.v1',
    authenticationMethod: overrides.authenticationMethod ?? 'API_KEY_REFERENCE',
    credentialRef: overrides.credentialRef ?? secretRef('simulation', 'oracle/src_sandbox'),
    controllerId: overrides.controllerId ?? 'controller_sandbox',
    upstreamOrganizationId: overrides.upstreamOrganizationId ?? 'org_sandbox',
    infrastructureRegion: overrides.infrastructureRegion ?? 'sim-east',
    retired: false,
  });
}

export function sandboxSecrets(): InMemorySecretProvider {
  return new InMemorySecretProvider('simulation', {
    'oracle/src_sandbox': SANDBOX_API_KEY,
    'oracle/oauth-client-id': SANDBOX_OAUTH_CLIENT_ID,
    'oracle/oauth-client-secret': SANDBOX_OAUTH_CLIENT_SECRET,
    'oracle/signed-key': SANDBOX_SIGNING_KEY,
    'oracle/mtls-cert': SANDBOX_MTLS_CERT,
    'oracle/mtls-key': SANDBOX_MTLS_KEY,
  });
}

export function sandboxIdentity(): OracleWorkloadIdentity {
  const identity = createCollectorIdentity({
    collectorId: 'collector_sandbox',
    assignedSourceIds: ['src_sandbox'],
    credentialRefs: { src_sandbox: secretRef('simulation', 'oracle/src_sandbox') },
    expiresAtUnix: 2_000_000_000n,
  });
  if (!identity.ok) {
    throw new Error(identity.error.detail);
  }
  return identity.value;
}

export function sandboxFeed(): ProductionFeedConfiguration {
  return developmentProductionFeed();
}

export function sandboxApiKeyAuth(): ConnectorAuthConfig {
  return { apiKey: { headerName: 'x-api-key', valuePrefix: '' } };
}

export function sandboxOauthAuth(): ConnectorAuthConfig {
  return {
    oauth: {
      tokenEndpointProfile: sandboxTokenEndpointProfile(),
      clientIdRef: secretRef('simulation', 'oracle/oauth-client-id'),
      clientSecretRef: secretRef('simulation', 'oracle/oauth-client-secret'),
      scope: 'oracle.read',
      audience: 'sandbox.oracle.test',
    },
  };
}

export function sandboxSignedAuth(): ConnectorAuthConfig {
  return {
    signedRequest: {
      algorithm: 'HMAC-SHA256',
      headerName: 'x-sunrey-signature',
      timestampHeader: 'x-sunrey-timestamp',
      nonceHeader: 'x-sunrey-nonce',
      keyRef: secretRef('simulation', 'oracle/signed-key'),
    },
  };
}

export function sandboxMtlsAuth(): ConnectorAuthConfig {
  return {
    mtls: {
      certificateRef: secretRef('simulation', 'oracle/mtls-cert'),
      privateKeyRef: secretRef('simulation', 'oracle/mtls-key'),
    },
  };
}
