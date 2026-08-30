/**
 * Wave 3 Prompt 13 — external blockchain network intelligence public exports.
 */

export {
  CHAIN_INTELLIGENCE_SCHEMA,
  CHAIN_INTELLIGENCE_AUTHORITY,
  EXTERNAL_BLOCKCHAIN_IDS,
  SUNREY_NATIVE_CHAIN_ID,
  CHAIN_OBSERVATION_TYPES,
  BLOCK_CONFIRMATION_STATUSES,
  FEE_UNITS,
} from './types.ts';
export type {
  ExternalBlockchainId,
  ChainObservationType,
  BlockConfirmationStatus,
  FeeUnit,
  ChainObservationFreshness,
  ChainObservationProvenance,
  NormalizedBitcoinBlock,
  NormalizedTransaction,
  FeeEstimateTier,
  NormalizedFeeEstimate,
  MempoolObservation,
  NetworkMetrics,
  NetworkStatus,
  ChainObservationData,
  ChainObservation,
  ChainIntelligenceResult,
  ProviderDisagreementEvent,
  AddressLookupResult,
} from './types.ts';

export {
  isExternalBlockchainId,
  assertExternalBlockchainId,
  isSunReyNativeChainId,
  rejectSunReyNativeChain,
  networkLabel,
  finalityNoteFor,
  minConfirmationsForLikelyFinal,
} from './identity.ts';

export {
  validateBitcoinTxHash,
  validateBitcoinBlockHash,
  validateEthereumTxHash,
  validateTransactionHash,
  validateBitcoinAddress,
  privacySafeAddressLogRef,
} from './hash.ts';

export { chainIntelligenceSeparationProof, assertExternalChainTarget } from './separation.ts';
export type { SunReyChainSeparationProof } from './separation.ts';

export {
  CHAIN_INTELLIGENCE_CATALOG_ENTRIES,
  CHAIN_INTELLIGENCE_CATALOG_PROVIDER_IDS,
  type ChainIntelligenceCatalogProviderId,
} from './catalog-entries.ts';

export {
  CHAIN_INTELLIGENCE_CACHE_CAPABILITIES,
  chainIntelligenceCachePolicy,
  transactionCacheCapability,
  blockCacheCapability,
} from './cache-policies.ts';

export { CHAIN_INTELLIGENCE_REFRESH_SCHEDULES } from './refresh-schedules.ts';

export { ChainIntelligenceEventBus, defaultChainIntelligenceEventBus } from './events.ts';
export type { DisagreementListener } from './events.ts';

export type {
  BlockchainIntelligenceCapability,
  BlockchainIntelligenceProviderHealth,
  BlockchainIntelligenceProvider,
} from './provider.ts';

export {
  CHAIN_INTELLIGENCE_CATEGORIES,
  CHAIN_INTELLIGENCE_CAPABILITIES,
  isChainIntelligenceCategory,
  chainIntelligenceCapabilitiesOf,
  listEligibleChainIntelligenceProviders,
  loadChainIntelligenceCatalog,
  providerPriorityOf,
  createChainIntelligenceAdapterFactory,
} from './registry.ts';
export type { ChainIntelligenceCatalogMatch, ChainIntelligenceAdapterFactory } from './registry.ts';

export {
  createMempoolSpaceAdapter,
  createBlockchainComAdapter,
  createBlockscoutAdapter,
  createBtcGlobeAdapter,
  MempoolSpaceAdapter,
  BlockchainComAdapter,
  BlockscoutAdapter,
  BtcGlobeAdapter,
} from './adapters/index.ts';

export {
  ExternalChainIntelligenceService,
  createExternalChainIntelligenceService,
  defaultChainIntelligenceNow,
} from './service.ts';
export type { ExternalChainIntelligenceServiceOptions } from './service.ts';

export {
  EXTERNAL_OBSERVATION_EVIDENCE_KIND,
  toAgentEvidenceRef,
  chainObservationToExternalObservation,
  buildChainIntelligenceAgentEvidence,
  mempoolToAgentEvidence,
  networkMetricsToAgentEvidence,
} from './agent-evidence.ts';
export type { ChainIntelligenceAgentEvidence } from './agent-evidence.ts';
