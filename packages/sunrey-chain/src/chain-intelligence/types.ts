/**
 * Wave 3 Prompt 13 — external blockchain network intelligence types.
 *
 * Read-only observations of external chains. Does not mutate SunRey chain state,
 * consensus, ledger, or issuance.
 */

import type { UtcInstant } from '../../../domain/src/time.ts';
import type { AuthorityClass } from '../../../provider-sdk/src/types.ts';

export const CHAIN_INTELLIGENCE_SCHEMA = 'sunrey.chain-intelligence.v1' as const;
export const CHAIN_INTELLIGENCE_AUTHORITY = 'OBSERVATION_ONLY' as const;

export const EXTERNAL_BLOCKCHAIN_IDS = [
  'bitcoin-mainnet',
  'bitcoin-testnet',
  'ethereum-mainnet',
  'solana-mainnet',
] as const;
export type ExternalBlockchainId = (typeof EXTERNAL_BLOCKCHAIN_IDS)[number];

export const SUNREY_NATIVE_CHAIN_ID = 'sunrey-simulation' as const;

export const CHAIN_OBSERVATION_TYPES = [
  'BLOCK',
  'TRANSACTION',
  'MEMPOOL',
  'FEE',
  'NETWORK_STATE',
  'HASHRATE',
  'DIFFICULTY',
  'SUPPLY_REFERENCE',
  'NODE_STATUS',
] as const;
export type ChainObservationType = (typeof CHAIN_OBSERVATION_TYPES)[number];

export const BLOCK_CONFIRMATION_STATUSES = [
  'UNCONFIRMED',
  'PROBABILISTIC',
  'LIKELY_FINAL',
  'FINAL',
] as const;
export type BlockConfirmationStatus = (typeof BLOCK_CONFIRMATION_STATUSES)[number];

export const FEE_UNITS = ['sat/vB', 'gwei', 'lamports'] as const;
export type FeeUnit = (typeof FEE_UNITS)[number];

export type ChainObservationFreshness = {
  readonly status: 'fresh' | 'aging' | 'stale' | 'expired' | 'unknown';
  readonly ageMs: bigint;
  readonly assessedAt: UtcInstant;
};

export type ChainObservationProvenance = {
  readonly providerId: string;
  readonly authorityClass: AuthorityClass;
  readonly sourceUrl: string | null;
  readonly rawPayloadHash: string | null;
  readonly observationId: string;
  readonly capability: string;
};

export type NormalizedBitcoinBlock = {
  readonly height: number;
  readonly hash: string;
  readonly previousHash: string;
  readonly timestamp: UtcInstant;
  readonly transactionCount: number;
  readonly sizeBytes: number;
  readonly weight: number;
  readonly difficulty: string;
  readonly feeTotalSat: bigint | null;
  readonly confirmationStatus: BlockConfirmationStatus;
  readonly observedAt: UtcInstant;
};

export type NormalizedTransaction = {
  readonly txHash: string;
  readonly blockHeight: number | null;
  readonly blockHash: string | null;
  readonly confirmationCount: number;
  readonly status: BlockConfirmationStatus;
  readonly feeSat: bigint | null;
  readonly feeUnit: 'sat' | null;
  readonly sizeBytes: number;
  readonly timestamp: UtcInstant | null;
  readonly inputsSummary: string;
  readonly outputsSummary: string;
  readonly observedAt: UtcInstant;
};

export type FeeEstimateTier = {
  readonly label: 'minimum' | 'economy' | 'normal' | 'priority';
  readonly rate: bigint;
  readonly unit: FeeUnit;
};

export type NormalizedFeeEstimate = {
  readonly chainId: ExternalBlockchainId;
  readonly tiers: readonly FeeEstimateTier[];
  readonly timestamp: UtcInstant;
  readonly providerId: string;
  readonly freshness: ChainObservationFreshness;
};

export type MempoolObservation = {
  readonly schema: 'sunrey.mempool-observation.v1';
  readonly chainId: ExternalBlockchainId;
  readonly pendingTransactionCount: number;
  readonly mempoolSizeBytes: bigint;
  readonly feeDistribution: Readonly<Record<string, number>>;
  readonly recommendedFees: readonly FeeEstimateTier[];
  readonly congestionLevel: 'low' | 'moderate' | 'high' | 'severe' | 'unknown';
  readonly timestamp: UtcInstant;
  readonly retrievedAt: UtcInstant;
  readonly providerId: string;
  readonly freshness: ChainObservationFreshness;
  readonly provenance: ChainObservationProvenance;
};

export type NetworkMetrics = {
  readonly chainId: ExternalBlockchainId;
  readonly hashrate: string | null;
  readonly hashrateUnit: string | null;
  readonly difficulty: string | null;
  readonly blockIntervalSeconds: number | null;
  readonly transactionThroughputTps: number | null;
  readonly activeAddresses: number | null;
  readonly circulatingSupply: string | null;
  readonly supplyUnit: string | null;
  readonly timestamp: UtcInstant;
  readonly providerId: string;
  readonly freshness: ChainObservationFreshness;
};

export type NetworkStatus = {
  readonly chainId: ExternalBlockchainId;
  readonly healthy: boolean;
  readonly latestBlockHeight: number | null;
  readonly latestBlockHash: string | null;
  readonly mempoolCongestion: MempoolObservation['congestionLevel'];
  readonly nodeReachable: boolean;
  readonly timestamp: UtcInstant;
  readonly providerId: string;
};

export type ChainObservationData =
  | { readonly kind: 'BLOCK'; readonly block: NormalizedBitcoinBlock }
  | { readonly kind: 'TRANSACTION'; readonly transaction: NormalizedTransaction }
  | { readonly kind: 'MEMPOOL'; readonly mempool: MempoolObservation }
  | { readonly kind: 'FEE'; readonly fee: NormalizedFeeEstimate }
  | { readonly kind: 'NETWORK_STATE'; readonly status: NetworkStatus }
  | { readonly kind: 'NETWORK_METRICS'; readonly metrics: NetworkMetrics };

export type ChainObservation = {
  readonly schema: typeof CHAIN_INTELLIGENCE_SCHEMA;
  readonly authority: typeof CHAIN_INTELLIGENCE_AUTHORITY;
  readonly chainId: ExternalBlockchainId;
  readonly network: string;
  readonly observationType: ChainObservationType;
  readonly blockHeight: number | null;
  readonly blockHash: string | null;
  readonly transactionHash: string | null;
  readonly timestamp: UtcInstant;
  readonly providerId: string;
  readonly retrievedAt: UtcInstant;
  readonly freshness: ChainObservationFreshness;
  readonly authorityClass: AuthorityClass;
  readonly provenance: ChainObservationProvenance;
  readonly data: ChainObservationData;
  readonly reorgAware: true;
  readonly finalityNote: string;
};

export type ChainIntelligenceResult<T> =
  | {
      readonly ok: true;
      readonly value: T;
      readonly fromCache: boolean;
      readonly fallbackProviderId: string | null;
    }
  | { readonly ok: false; readonly code: string; readonly message: string; readonly providerId: string | null };

export type ProviderDisagreementEvent = {
  readonly schema: 'sunrey.chain-intelligence.disagreement.v1';
  readonly chainId: ExternalBlockchainId;
  readonly observationType: ChainObservationType;
  readonly primaryProviderId: string;
  readonly secondaryProviderId: string;
  readonly field: string;
  readonly primaryValue: string;
  readonly secondaryValue: string;
  readonly detectedAt: UtcInstant;
  readonly severity: 'material' | 'minor';
};

export type AddressLookupResult = {
  readonly chainId: ExternalBlockchainId;
  readonly addressHash: string;
  readonly balanceSat: bigint | null;
  readonly transactionCount: number | null;
  readonly timestamp: UtcInstant;
  readonly providerId: string;
  readonly privacySafeLogRef: string;
};
