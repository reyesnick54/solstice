/**
 * Chunk 127 — off-chain economic data connector runtime types.
 *
 * Consensus, validator state transition, block execution, and MoonRey
 * issuance verification never call HTTP. This plane collects provider
 * records off-chain and emits observation drafts only.
 */

import type { SecretReference } from '../../../../security/src/secrets.ts';
import type { SecretProvider } from '../../../../security/src/secrets.ts';
import type { ExternalSourceRecord } from './schema.ts';
import type {
  AuthenticationMethod,
  CanonicalCollectedObservation,
  EconomicDataSource,
  OracleWorkloadIdentity,
  ProductionFeedConfiguration,
  ProductionOracleRejection,
  SourceProvenance,
} from './types.ts';
import { CONNECTOR_VERSION } from './types.ts';

export const CONNECTOR_RUNTIME_MODES = [
  'FIXTURE',
  'SANDBOX',
  'TESTNET_EXTERNAL',
  'PRODUCTION_CANDIDATE_EXTERNAL',
] as const;
export type ConnectorRuntimeMode = (typeof CONNECTOR_RUNTIME_MODES)[number];

export const DEFAULT_CONNECTOR_RUNTIME_MODE = 'FIXTURE' as const;
export const MAINNET_CONNECTIVITY_STATES = ['DISABLED', 'UNCONFIGURED'] as const;
export type MainnetConnectivityState = (typeof MAINNET_CONNECTIVITY_STATES)[number];
export const LIVE_MAINNET_CONNECTIVITY: MainnetConnectivityState = 'DISABLED';

export const HTTP_METHODS = ['GET', 'POST'] as const;
export type ConnectorHttpMethod = (typeof HTTP_METHODS)[number];

export const NETWORK_CLASSES = ['PUBLIC_INTERNET', 'PRIVATE_NETWORK', 'LOOPBACK_FIXTURE'] as const;
export type ConnectorNetworkClass = (typeof NETWORK_CLASSES)[number];

export const TLS_POLICIES = ['REQUIRE_VALID_CERTIFICATE', 'FIXTURE_HTTP_ALLOWED'] as const;
export type ConnectorTlsPolicy = (typeof TLS_POLICIES)[number];

export const REDIRECT_POLICIES = ['NONE', 'FOLLOW_BOUNDED'] as const;
export type ConnectorRedirectPolicy = (typeof REDIRECT_POLICIES)[number];

export const ALLOWED_CONTENT_TYPES = ['application/json'] as const;

export const HTTP_FETCH_SUCCESS_IS_NOT_VERIFIED_ECONOMIC_FACT = true as const;
export const VERIFIED_ECONOMIC_FACT_IS_NOT_PRODUCTIVE_CONTRIBUTION = true as const;
export const PRODUCTIVE_CONTRIBUTION_IS_NOT_PRODUCTIVE_VALUE = true as const;
export const PRODUCTIVE_VALUE_IS_NOT_MOONREY_ISSUANCE = true as const;
export const CONSENSUS_CALLED_HTTP = false as const;
export const FETCH_AUTO_FINALIZED_ORACLE = false as const;
export const FETCH_AUTO_MINTED_MOONREY = false as const;
export const CREDENTIALS_EXPOSED = false as const;

export type ProviderEndpointProfile = {
  readonly profileId: string;
  readonly providerId: string;
  readonly sourceId: string;
  readonly scheme: 'https' | 'http';
  readonly hostname: string;
  readonly port: number;
  readonly pathPrefix: string;
  readonly allowedMethods: readonly ConnectorHttpMethod[];
  readonly authenticationClass: AuthenticationMethod;
  readonly tlsPolicy: ConnectorTlsPolicy;
  readonly maximumResponseBytes: number;
  readonly timeoutMs: number;
  readonly redirectPolicy: ConnectorRedirectPolicy;
  readonly maxRedirects: number;
  readonly networkClass: ConnectorNetworkClass;
  readonly allowedContentTypes: readonly string[];
};

export type ConnectorRuntimeConfig = {
  readonly mode: ConnectorRuntimeMode;
  readonly mainnetConnectivity: MainnetConnectivityState;
  readonly externalNetworkEnabled: false | true;
  readonly productionCandidateExternalConfigured: false | true;
  readonly maximumArrayLength: number;
};

export const DEFAULT_CONNECTOR_RUNTIME_CONFIG: ConnectorRuntimeConfig = Object.freeze({
  mode: DEFAULT_CONNECTOR_RUNTIME_MODE,
  mainnetConnectivity: LIVE_MAINNET_CONNECTIVITY,
  externalNetworkEnabled: false,
  productionCandidateExternalConfigured: false,
  maximumArrayLength: 8,
});

export type ConnectorClock = {
  nowUnix(): bigint;
  nowMs(): bigint;
};

export type ConnectorRandom = {
  nextUnitInterval(): number;
};

export type ExternalHttpRequest = {
  readonly method: ConnectorHttpMethod;
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: string;
  readonly timeoutMs: number;
  readonly maximumResponseBytes: number;
  readonly tls: {
    readonly rejectUnauthorized: true;
    readonly clientCertificatePresent: boolean;
  };
};

export type ExternalHttpResponse = {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
  readonly finalUrl: string;
  readonly redirected: boolean;
};

export type ExternalHttpTransport = {
  readonly transportId: string;
  readonly contactsPublicInternet: false | true;
  request(input: ExternalHttpRequest): Promise<import('../../../../domain/src/result.ts').Result<ExternalHttpResponse, ProductionOracleRejection>>;
};

export type ApiKeyAuthConfig = {
  readonly headerName: string;
  readonly valuePrefix: string;
};

export type OauthClientConfig = {
  readonly tokenEndpointProfile: ProviderEndpointProfile;
  readonly clientIdRef: SecretReference;
  readonly clientSecretRef: SecretReference;
  readonly scope: string;
  readonly audience: string | null;
};

export type SignedRequestConfig = {
  readonly algorithm: 'HMAC-SHA256';
  readonly headerName: string;
  readonly timestampHeader: string;
  readonly nonceHeader: string;
  readonly keyRef: SecretReference;
};

export type MtlsAuthConfig = {
  readonly certificateRef: SecretReference;
  readonly privateKeyRef: SecretReference;
};

export type ConnectorAuthConfig = {
  readonly apiKey?: ApiKeyAuthConfig;
  readonly oauth?: OauthClientConfig;
  readonly signedRequest?: SignedRequestConfig;
  readonly mtls?: MtlsAuthConfig;
};

export type SourceFetchRequestV2 = {
  readonly source: EconomicDataSource;
  readonly identity: OracleWorkloadIdentity;
  readonly feed: ProductionFeedConfiguration;
  readonly endpointProfile: ProviderEndpointProfile;
  readonly subject: string;
  readonly nowUnix: bigint;
};

export type ConnectorRuntimeContext = {
  readonly config: ConnectorRuntimeConfig;
  readonly transport: ExternalHttpTransport;
  readonly secrets: SecretProvider;
  readonly clock: ConnectorClock;
  readonly random: ConnectorRandom;
  readonly auth: ConnectorAuthConfig;
};

export type OracleSourceAdapterV2 = {
  readonly adapterId: string;
  readonly adapterContract: 'v2';
  readonly authenticationClass: AuthenticationMethod;
  retrieve(
    request: SourceFetchRequestV2,
    context: ConnectorRuntimeContext,
  ): Promise<import('../../../../domain/src/result.ts').Result<ExternalSourceRecord, ProductionOracleRejection>>;
};

export type ConnectorFetchSuccess = {
  readonly record: ExternalSourceRecord;
  readonly canonical: CanonicalCollectedObservation;
  readonly provenance: SourceProvenance;
  readonly verifiedEconomicFact: null;
  readonly productiveContribution: null;
  readonly productiveValue: null;
  readonly moonreyIssuance: null;
  readonly finalizedOracle: false;
  readonly mintedMoonRey: false;
  readonly collectorVersion: typeof CONNECTOR_VERSION;
};

export type ConnectorResponseClass =
  | 'SUCCESS'
  | 'TIMEOUT'
  | 'HTTP_429'
  | 'HTTP_5XX'
  | 'HTTP_4XX'
  | 'AUTH'
  | 'SCHEMA'
  | 'SECURITY'
  | 'POLICY'
  | 'TRANSPORT';

export function connectorRuntimeVersion(): typeof CONNECTOR_VERSION {
  return CONNECTOR_VERSION;
}

export function consensusMustNotCallHttp(): false {
  return CONSENSUS_CALLED_HTTP;
}

export function liveMainnetConnectivityEnabled(): false {
  return false;
}

export function fetchDoesNotFinalizeOracle(): false {
  return FETCH_AUTO_FINALIZED_ORACLE;
}

export function fetchDoesNotMintMoonRey(): false {
  return FETCH_AUTO_MINTED_MOONREY;
}
