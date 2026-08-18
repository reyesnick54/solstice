/**
 * Chunk 93 — SunRey public RPC edge, Explorer HA, and network data plane.
 *
 * RPC reads canonical chain state. Explorer projections are rebuildable
 * and never authoritative. This module is not a second consensus, not a
 * second financial ledger, and not a public validator admin surface.
 */

export const PUBLIC_DATA_PLANE_SCHEMA_VERSION = 1 as const;
export const PUBLIC_DATA_PLANE_TOOL_VERSION = 'sunrey-public-data-plane-0' as const;
export const PUBLIC_RPC_ZONE = 'PUBLIC_RPC' as const;
export const PUBLIC_API_VERSION = 'v1' as const;

export const RPC_REQUEST_CLASSES = [
  'PUBLIC_READ',
  'TRANSACTION_SUBMISSION',
  'SUBSCRIPTION',
  'ARCHIVE_QUERY',
  'OPERATOR_AUTHENTICATED',
] as const;
export type RpcRequestClass = (typeof RPC_REQUEST_CLASSES)[number];

export const SUBMISSION_EDGE_STATES = [
  'ACCEPTED_FOR_MEMPOOL',
  'REJECTED',
  'ALREADY_KNOWN',
  'TEMPORARILY_UNAVAILABLE',
] as const;
export type SubmissionEdgeState = (typeof SUBMISSION_EDGE_STATES)[number];

export const FINALITY_STATES = ['UNKNOWN', 'IN_MEMPOOL', 'INCLUDED', 'FINALIZED', 'REJECTED'] as const;
export type FinalityState = (typeof FINALITY_STATES)[number];

export const RPC_NODE_ROLES = ['RPC', 'ARCHIVE', 'SENTRY_READ'] as const;
export type RpcNodeRole = (typeof RPC_NODE_ROLES)[number];

export const RPC_NODE_HEALTH = ['HEALTHY', 'DEGRADED', 'STALE', 'UNSYNCED', 'DOWN'] as const;
export type RpcNodeHealth = (typeof RPC_NODE_HEALTH)[number];

export const EXPLORER_INDEXER_HEALTH = ['HEALTHY', 'LAGGING', 'STALE', 'CORRUPT', 'DOWN'] as const;
export type ExplorerIndexerHealth = (typeof EXPLORER_INDEXER_HEALTH)[number];

export const PUBLIC_NETWORK_ENVIRONMENTS = ['LOCAL_DEVNET', 'TESTNET', 'SIMULATION'] as const;
export type PublicNetworkEnvironment = (typeof PUBLIC_NETWORK_ENVIRONMENTS)[number];

export const SUBSCRIPTION_TOPICS = [
  'NEW_FINALIZED_BLOCK',
  'TRANSACTION_FINALITY',
  'VALIDATOR_SET_CHANGE',
  'GOVERNANCE_EVENT',
  'PUBLIC_ECONOMIC_EVENT',
] as const;
export type SubscriptionTopic = (typeof SUBSCRIPTION_TOPICS)[number];

export const FORBIDDEN_PUBLIC_METHODS = [
  'validator.admin',
  'validator.sign',
  'signer.sign',
  'custody.sign',
  'governance.key',
  'operator.produceBlock',
  'operator.unsafeReset',
] as const;
export type ForbiddenPublicMethod = (typeof FORBIDDEN_PUBLIC_METHODS)[number];

export const FORBIDDEN_PUBLIC_FIELDS = [
  'pdvRaw',
  'kycRecord',
  'providerCredential',
  'privateCase',
  'custodyPrivateMetadata',
  'restrictedSecurityEvidence',
  'privateKey',
  'hsmSecret',
  'validatorAdminToken',
] as const;

export const HUMAN_INFORMATION_PUBLIC_FIELDS = [
  'rightId',
  'attestationHash',
  'publicClassification',
  'disclosureClass',
] as const;

export type RpcEndpoint = {
  readonly endpointId: string;
  readonly url: string;
  readonly zone: typeof PUBLIC_RPC_ZONE;
  readonly role: RpcNodeRole;
  readonly health: RpcNodeHealth;
  readonly synced: boolean;
  readonly finalizedHeight: number;
  readonly networkFinalizedHeight: number;
  readonly load: number;
  readonly archive: boolean;
  readonly canSign: false;
  readonly canReachSigner: false;
  readonly canReachValidatorAdmin: false;
  readonly canReachCustodySigning: false;
  readonly canReachGovernanceKeys: false;
};

export type RpcRequest = {
  readonly requestId: string;
  readonly method: string;
  readonly path: string;
  readonly requestClass: RpcRequestClass;
  readonly identity: RpcClientIdentity;
  readonly payloadBytes: number;
  readonly costUnits: number;
  readonly requiresArchive: boolean;
  readonly mutationEligibility: boolean;
  readonly nowUtc: string;
};

export type RpcClientIdentity = {
  readonly kind: 'ANONYMOUS' | 'API_KEY' | 'OPERATOR';
  readonly networkIdentity: string;
  readonly apiKeyId: string | null;
  readonly grantsFinancialAuthority: false;
};

export type RpcQuotaPolicy = {
  readonly anonymousRequestsPerMinute: number;
  readonly apiKeyRequestsPerMinute: number;
  readonly maxCostUnitsPerMinute: number;
  readonly maxSubscriptionsPerIdentity: number;
  readonly maxConnectionsPerIdentity: number;
};

export type RpcRateLimitPolicy = {
  readonly windowMs: number;
  readonly byNetworkIdentity: boolean;
  readonly byApiKey: boolean;
  readonly byRequestClass: boolean;
  readonly byMethod: boolean;
  readonly byCostUnits: boolean;
  readonly distributedSafe: true;
};

export type RpcCachePolicy = {
  readonly enabled: boolean;
  readonly ttlMs: number;
  readonly cachePrivateUserData: false;
  readonly cacheDeterministicPublicReadsOnly: true;
};

export type RpcRequestPolicy = {
  readonly allowStaleForMutationEligibility: false;
  readonly staleReadExplicitPolicyRequired: true;
  readonly publicGatewayExposesOperatorMethods: false;
  readonly acceptPrivateKeys: false;
  readonly mempoolAcceptanceIsFinality: false;
};

export type RateLimitDecision = {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly retryAfterMs: number;
  readonly costUnitsCharged: number;
  readonly identity: string;
};

export type AbuseDecision = {
  readonly allowed: boolean;
  readonly reason:
    | 'OK'
    | 'REQUEST_FLOOD'
    | 'OVERSIZED_PAYLOAD'
    | 'INVALID_TX_FLOOD'
    | 'SUBSCRIPTION_EXHAUSTED'
    | 'EXPENSIVE_QUERY'
    | 'CONNECTION_EXHAUSTED'
    | 'FORBIDDEN_METHOD'
    | 'PRIVATE_KEY_REJECTED'
    | 'OPERATOR_METHOD_FORBIDDEN';
};

export type SubmissionEdgeResponse = {
  readonly transactionId: string;
  readonly state: SubmissionEdgeState;
  readonly finalized: false;
  readonly mempoolAcceptanceIsFinality: false;
  readonly privateKeyReceived: false;
};

export type FinalityStatus = {
  readonly transactionId: string | null;
  readonly blockId: string | null;
  readonly height: number | null;
  readonly state: FinalityState;
  readonly finalized: boolean;
  readonly source: 'CANONICAL_CHAIN';
};

export type SubscriptionRecord = {
  readonly subscriptionId: string;
  readonly identity: string;
  readonly topic: SubscriptionTopic;
  readonly bound: number;
  readonly delivered: number;
};

export type ExplorerIndexerMember = {
  readonly indexerId: string;
  readonly sourceNode: string;
  readonly finalizedHeight: number;
  readonly indexedHeight: number;
  readonly lag: number;
  readonly projectionVersion: string;
  readonly health: ExplorerIndexerHealth;
  readonly projectionHash: string;
  readonly rebuildable: true;
  readonly authoritative: false;
};

export type ExplorerHighAvailabilityState = {
  readonly activeIndexerId: string | null;
  readonly healthyMembers: number;
  readonly diverged: boolean;
  readonly failoverAvailable: boolean;
  readonly canonicalChainIsSourceOfTruth: true;
};

export type PublicCapabilityPublicStatus = {
  readonly capability: string;
  readonly status: 'UNAVAILABLE' | 'ELIGIBLE' | 'RESTRICTED' | 'ACTIVE';
  readonly public: true;
};

export type PublicNetworkStatus = {
  readonly environment: PublicNetworkEnvironment;
  readonly environmentLabel: string;
  readonly networkId: string;
  readonly chainId: string;
  readonly protocolVersion: string;
  readonly apiVersion: typeof PUBLIC_API_VERSION;
  readonly releaseVersion: string;
  readonly latestFinalizedHeight: number;
  readonly rpcHealth: RpcNodeHealth;
  readonly explorerLag: number;
  readonly activeNetworkPhase: string;
  readonly publicCapabilityStatus: readonly PublicCapabilityPublicStatus[];
  readonly privateOperationalDetails: false;
};

export type PublicDataPlaneReport = {
  readonly schemaVersion: typeof PUBLIC_DATA_PLANE_SCHEMA_VERSION;
  readonly toolVersion: typeof PUBLIC_DATA_PLANE_TOOL_VERSION;
  readonly environment: 'simulation';
  readonly zone: typeof PUBLIC_RPC_ZONE;
  readonly network: PublicNetworkStatus;
  readonly endpoints: readonly RpcEndpoint[];
  readonly explorer: ExplorerHighAvailabilityState;
  readonly metrics: PublicDataPlaneMetrics;
  readonly load: LoadBenchmarkResult;
  readonly secondConsensus: false;
  readonly secondLedger: false;
  readonly explorerAuthoritative: false;
  readonly publicValidatorAdminExposed: false;
  readonly liveFlagsEnabled: false;
};

export type PublicDataPlaneMetrics = {
  readonly requests: number;
  readonly latencyMsTotal: number;
  readonly errors: number;
  readonly rateLimitEvents: number;
  readonly payloadRejections: number;
  readonly subscriptionCount: number;
  readonly syncLag: number;
  readonly indexerLag: number;
  readonly cacheHits: number;
  readonly cacheMisses: number;
};

export type LoadBenchmarkResult = {
  readonly environment: PublicNetworkEnvironment;
  readonly recordedAtUtc: string;
  readonly rpcReadsPerSecond: number;
  readonly submissionsPerSecond: number;
  readonly subscriptionsPerSecond: number;
  readonly explorerQueriesPerSecond: number;
  readonly archiveQueriesPerSecond: number;
};

export type EdgeProtectionPort = {
  readonly vendorNeutral: true;
  readonly provider: 'NONE' | 'CONFIGURED_GENERIC';
  readonly tlsRequired: true;
  readonly maxRequestBytes: number;
  readonly trustedProxyHops: number;
  readonly originPolicy: 'SAME_SITE_OR_ALLOWLIST';
};

export type DeveloperApiKey = {
  readonly apiKeyId: string;
  readonly quotaMultiplier: number;
  readonly grantsFinancialAuthority: false;
  readonly canAuthorizeCustody: false;
  readonly canAuthorizeExchange: false;
};

export type ArchiveNode = {
  readonly nodeId: string;
  readonly retainsHistoricalData: true;
  readonly signingAuthority: false;
  readonly onValidatorCriticalPath: false;
};
