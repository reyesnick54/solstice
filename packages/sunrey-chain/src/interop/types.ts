/**
 * Chunk 50 — SunRey sovereign interoperability types.
 *
 * External chains may interoperate. They are not SunRey's authoritative
 * source of truth. Relayers are untrusted. No trusted-multisig bridge.
 */

export const INTEROP_PROTOCOL_VERSION = 'sunrey.interop.v1' as const;
export const INTEROP_SCHEMA_VERSION = 1 as const;
export const SUNREY_CHAIN_ID = 'chn_sunrey_simulation' as const;
export const EXTERNAL_DEV_CHAIN_ID = 'chn_external_dev_bft' as const;
export const DEV_INTEROP_TEST_ASSET = 'DEV_INTEROP_TEST_ASSET' as const;

export const CHAIN_STATUSES = [
  'DRAFT',
  'DEVELOPMENT_ONLY',
  'ACTIVE_DEVELOPMENT',
  'SUSPENDED',
  'REVOKED',
] as const;
export type ChainStatus = (typeof CHAIN_STATUSES)[number];

export const FINALITY_MODELS = [
  'DETERMINISTIC_BFT',
  'PROBABILISTIC_LONGEST_CHAIN',
  'EXTERNAL_CHECKPOINT_FINALITY',
  'SIMULATED_DETERMINISTIC_BFT_EXTERNAL_CHAIN',
] as const;
export type FinalityModel = (typeof FINALITY_MODELS)[number];

export const CHANNEL_TYPES = [
  'GENERIC_MESSAGE',
  'ECONOMIC_ATTESTATION',
  'ASSET_TRANSFER_RESERVED',
  'ORACLE_FACT',
  'IDENTITY_ATTESTATION_RESERVED',
] as const;
export type ChannelType = (typeof CHANNEL_TYPES)[number];

export const PACKET_LIFECYCLES = ['SENT', 'RECEIVED', 'ACKNOWLEDGED', 'TIMED_OUT'] as const;
export type PacketLifecycle = (typeof PACKET_LIFECYCLES)[number];

export const CONNECTION_STATES = ['INIT', 'TRY', 'ACK', 'CONFIRM', 'OPEN'] as const;
export type ConnectionState = (typeof CONNECTION_STATES)[number];

export const CLIENT_STATUSES = ['UNINITIALIZED', 'ACTIVE', 'EXPIRED', 'FROZEN', 'SUSPENDED'] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export type InteropErrorCode =
  | 'UNREGISTERED_CHAIN'
  | 'WRONG_EXTERNAL_CHAIN_ID'
  | 'WRONG_GENESIS'
  | 'INVALID_HEADER'
  | 'INVALID_FINALITY_PROOF'
  | 'INVALID_MEMBERSHIP_PROOF'
  | 'MODIFIED_PACKET'
  | 'PACKET_REPLAY'
  | 'ACK_REPLAY'
  | 'CLIENT_FROZEN'
  | 'CLIENT_EXPIRED'
  | 'RELAYER_FORBIDDEN'
  | 'AI_CANNOT_ACTIVATE'
  | 'WRAPPED_FIAT_FORBIDDEN'
  | 'PRODUCTION_ASSET_UNAVAILABLE'
  | 'SUPPLY_INVARIANT_VIOLATED'
  | 'FOREIGN_VALUE_NOT_ECONOMIC_TRUTH'
  | 'IDENTITY_NOT_AUTOMATICALLY_TRUSTED'
  | 'FIAT_LEDGER_MUTATION_FORBIDDEN'
  | 'VERIFICATION_NOT_IMPLEMENTED'
  | 'GOVERNANCE_REQUIRED';

export interface ExternalChainDefinition {
  readonly externalChainId: string;
  readonly displayName: string;
  readonly chainFamily: string;
  readonly finalityModel: FinalityModel;
  readonly clientType: string;
  readonly genesisHash: string;
  readonly trustAnchor: string;
  readonly proofSystem: string;
  readonly expectedBlockFormat: string;
  readonly timeoutPolicy: string;
  readonly minimumFinalityRule: string;
  readonly allowedCapabilities: readonly string[];
  status: ChainStatus;
  activationHeight: number;
  readonly schemaVersion: number;
}

export interface InterchainPacket {
  readonly sequence: number;
  readonly sourceChain: string;
  readonly sourceChannel: string;
  readonly destinationChain: string;
  readonly destinationChannel: string;
  readonly packetType: ChannelType;
  readonly payload: string;
  readonly timeoutHeight: number;
  readonly timeoutTimestamp: number;
  readonly sender: string;
  readonly receiver: string;
  readonly protocolVersion: string;
}

export interface InteropSecurityProfile {
  readonly foreignFinalityModel: string;
  readonly verifiedClientType: string;
  readonly proofSystem: string;
  readonly sunreyCryptoClassification: string;
  readonly foreignCryptoClassification: string;
  readonly weakestTrustDomain: string;
  readonly interopCannotExceedWeakestDomain: boolean;
  readonly validatorTrustAssumptions: string;
  readonly clientAgeSeconds: number;
  readonly status: string;
  readonly riskClassification: string;
  readonly absoluteSecurityClaim: false;
  readonly trustedMultisigBridge: false;
  readonly productionReady: false;
}

export interface InteropAssetSnapshot {
  readonly assetId: string;
  circulating: bigint;
  escrowed: bigint;
  authorizedRemote: bigint;
  readonly definedTotal: bigint;
}

export interface InteropMetrics {
  interopClients: number;
  interopVerifiedHeaders: number;
  interopRejectedHeaders: number;
  interopPacketsSent: number;
  interopPacketsReceived: number;
  interopPacketReplays: number;
  interopTimeouts: number;
  interopClientAge: number;
  interopClientFrozen: number;
  interopProofFailures: number;
  relayerSubmissions: number;
}
