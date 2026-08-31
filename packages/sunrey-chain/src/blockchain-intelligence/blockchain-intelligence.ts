/**
 * Wave 3 blockchain intelligence aggregator — read-only external chain observation.
 */

import type { ChainlinkFeedsFixture } from './adapters/fixture-adapters.ts';
import { createWave3FixtureProviders } from './adapters/fixture-adapters.ts';
import { BlockchainIntelligenceCache } from './cache.ts';
import { CryptoMarketReferenceService } from './crypto-market-reference.ts';
import { ExternalChainIntelligenceService } from './external-chain-intelligence.ts';
import { ExternalChainRpcService } from './external-chain-rpc-service.ts';
import { capabilityMatrix, EXTERNAL_NETWORKS, networkById } from './networks.ts';
import type {
  CryptoMarketQuote,
  ExternalBlockSummary,
  ExternalFeeEstimate,
  ExternalNetwork,
  ExternalNetworkStatusObservation,
  ExternalTransactionSummary,
  OracleReferenceObservation,
  ProviderHealthSnapshot,
  ProviderObservationEnvelope,
} from './types.ts';

export type BlockchainIntelligenceServiceOptions = {
  readonly cache?: BlockchainIntelligenceCache;
  readonly fixtures?: ReturnType<typeof createWave3FixtureProviders>;
};

export class BlockchainIntelligenceService {
  readonly #cache: BlockchainIntelligenceCache;
  readonly #fixtures: ReturnType<typeof createWave3FixtureProviders>;
  readonly #cryptoMarket: CryptoMarketReferenceService;
  readonly #chainIntel: ExternalChainIntelligenceService;
  readonly #rpc: ExternalChainRpcService;
  readonly #chainlink: ChainlinkFeedsFixture;

  constructor(options: BlockchainIntelligenceServiceOptions = {}) {
    this.#cache = options.cache ?? new BlockchainIntelligenceCache();
    this.#fixtures = options.fixtures ?? createWave3FixtureProviders();
    this.#chainlink = this.#fixtures.chainlink;

    this.#cryptoMarket = new CryptoMarketReferenceService({
      primary: this.#fixtures.coingecko,
      cache: this.#cache,
    });

    this.#chainIntel = new ExternalChainIntelligenceService({
      bitcoinProvider: this.#fixtures.mempool,
      cache: this.#cache,
    });

    this.#rpc = new ExternalChainRpcService({
      ethereumProviders: Object.freeze([
        Object.freeze({ tier: 'primary' as const, provider: this.#fixtures.cloudflare }),
        Object.freeze({ tier: 'secondary' as const, provider: this.#fixtures.infura }),
        Object.freeze({ tier: 'fallback' as const, provider: this.#fixtures.alchemy }),
      ]),
      solanaProvider: this.#fixtures.solana,
      cache: this.#cache,
    });
  }

  listNetworks(): readonly ExternalNetwork[] {
    return EXTERNAL_NETWORKS.filter((n) => n.networkId !== 'sunrey-native');
  }

  getNetwork(networkId: string): ExternalNetwork | undefined {
    const network = networkById(networkId);
    if (!network || network.networkId === 'sunrey-native') return undefined;
    return network;
  }

  capabilityMatrix(): Readonly<Record<string, Readonly<Record<string, boolean>>>> {
    return capabilityMatrix();
  }

  allProviderHealth(): readonly ProviderHealthSnapshot[] {
    return Object.freeze([
      ...this.#cryptoMarket.providerHealth(),
      ...this.#chainIntel.providerHealth(),
      ...this.#rpc.providerHealth(),
      this.#chainlink.health(),
    ]);
  }

  cryptoMarketQuotes(): readonly ProviderObservationEnvelope<CryptoMarketQuote>[] {
    return this.#cryptoMarket.marketQuotes();
  }

  networkStatus(networkId: string): ProviderObservationEnvelope<ExternalNetworkStatusObservation> {
    if (networkId === 'bitcoin-mainnet') {
      return this.#chainIntel.bitcoinNetworkStatus();
    }
    return this.#rpc.getNetworkStatus(networkId);
  }

  networkFees(networkId: string): ProviderObservationEnvelope<ExternalFeeEstimate> {
    if (networkId === 'bitcoin-mainnet') {
      return this.#chainIntel.bitcoinFeeEstimate();
    }
    return this.#rpc.getFeeEstimate(networkId);
  }

  transaction(networkId: string, hash: string): ProviderObservationEnvelope<ExternalTransactionSummary> {
    return this.#rpc.getTransaction(networkId, hash);
  }

  oracleReference(feedId: string): ProviderObservationEnvelope<OracleReferenceObservation> {
    return this.#chainlink.getReferenceFeed(feedId);
  }

  /** Evidence-only bundle for Financial Agent — never grants execution authority. */
  agentEvidenceRef(networkId: string): Record<string, unknown> {
    const network = this.getNetwork(networkId);
    return Object.freeze({
      kind: 'external.observation.reference',
      observationId: `wave3-network-${networkId}`,
      providerId: 'blockchain-intelligence',
      capability: 'network.metadata',
      summary: network?.name ?? networkId,
      grantsExecutionAuthority: false,
      treatedAsTradeInstruction: false,
    });
  }

  /** Exchange-safe external network metadata — no deposit/withdraw actions implied. */
  exchangeNetworkMetadata(networkId: string): Record<string, unknown> | null {
    const network = this.getNetwork(networkId);
    if (!network) return null;
    return Object.freeze({
      networkId: network.networkId,
      name: network.name,
      chainFamily: network.chainFamily,
      nativeAsset: network.nativeAsset,
      networkType: network.networkType,
      readSupport: network.readSupport,
      explorerSupport: network.explorerSupport,
      rpcSupport: network.rpcSupport,
      status: network.status,
      capabilities: network.capabilities,
      observationSupport: network.observationSupport,
      custodyEnabled: false,
      withdrawalEnabled: false,
      depositEnabled: false,
    });
  }
}

export function createBlockchainIntelligenceSandbox(): BlockchainIntelligenceService {
  return new BlockchainIntelligenceService();
}
