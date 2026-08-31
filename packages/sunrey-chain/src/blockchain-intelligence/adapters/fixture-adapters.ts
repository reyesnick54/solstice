/**
 * Wave 3 fixture-backed external chain RPC and indexer adapters.
 * Uses simulated transport only — no live provider HTTP.
 */

import {
  FIXTURE_BITCOIN_FEES,
  FIXTURE_BLOCKS,
  FIXTURE_CHAINLINK_ETH_USD,
  FIXTURE_CRYPTO_QUOTES,
  FIXTURE_ETHEREUM_CHAIN_ID,
  FIXTURE_TOKEN_USDC,
  FIXTURE_TRANSACTIONS,
} from '../fixtures/data.ts';
import {
  guardRpcMethod,
  validateChainIdResponse,
  type ExternalChainRpcProvider,
  type ReadOnlyContractCall,
} from '../external-chain-rpc-provider.ts';
import { isAllowedReadContract } from '../limits.ts';
import type {
  CryptoMarketQuote,
  ExternalBalanceObservation,
  ExternalBlockSummary,
  ExternalFeeEstimate,
  ExternalNetworkStatusObservation,
  ExternalTokenIdentity,
  ExternalTransactionSummary,
  OracleReferenceObservation,
  ProviderHealthSnapshot,
  ProviderObservationEnvelope,
} from '../types.ts';
import { chainScopedTokenKey } from '../types.ts';

type Clock = { readonly nowUtc: () => string };

const defaultClock = (): Clock => ({ nowUtc: () => new Date().toISOString() });

function envelope<T>(
  providerId: string,
  capability: string,
  data: T,
  clock: Clock,
  sourceTimestampUtc: string | null = null,
): ProviderObservationEnvelope<T> {
  return Object.freeze({
    providerId,
    capability,
    collectedAtUtc: clock.nowUtc(),
    sourceTimestampUtc,
    stale: false,
    simulation: true as const,
    data,
  });
}

abstract class BaseFixtureRpcProvider implements ExternalChainRpcProvider {
  readonly providerId: string;
  readonly networkId: string;
  readonly expectedChainId: string | null;
  protected readonly clock: Clock;
  private healthy = true;
  private degraded = false;
  private message = 'fixture healthy';

  constructor(
    providerId: string,
    networkId: string,
    expectedChainId: string | null,
    clock: Clock = defaultClock(),
  ) {
    this.providerId = providerId;
    this.networkId = networkId;
    this.expectedChainId = expectedChainId;
    this.clock = clock;
  }

  markUnhealthy(message: string): void {
    this.healthy = false;
    this.degraded = true;
    this.message = message;
  }

  markDegraded(message: string): void {
    this.degraded = true;
    this.message = message;
  }

  health(): ProviderHealthSnapshot {
    return Object.freeze({
      providerId: this.providerId,
      healthy: this.healthy,
      degraded: this.degraded,
      message: this.message,
      checkedAtUtc: this.clock.nowUtc(),
    });
  }

  getChainId(): ProviderObservationEnvelope<string> {
    guardRpcMethod('eth_chainId');
    const chainId = this.expectedChainId ?? '0x0';
    validateChainIdResponse(this.providerId, this.expectedChainId, chainId);
    return envelope(this.providerId, 'rpc.chain_id', chainId, this.clock);
  }

  getLatestBlock(): ProviderObservationEnvelope<ExternalBlockSummary> {
    return this.getBlockFromFixture();
  }

  getBlock(blockNumber: number): ProviderObservationEnvelope<ExternalBlockSummary> {
    const block = this.getBlockFromFixture();
    return envelope(this.providerId, 'rpc.block', { ...block.data, blockNumber }, this.clock);
  }

  protected getBlockFromFixture(): ProviderObservationEnvelope<ExternalBlockSummary> {
    const raw = FIXTURE_BLOCKS[this.networkId as keyof typeof FIXTURE_BLOCKS];
    if (!raw) throw new Error(`no_fixture_block:${this.networkId}`);
    const data: ExternalBlockSummary = Object.freeze({
      networkId: this.networkId,
      blockNumber: raw.blockNumber,
      blockHash: raw.blockHash,
      parentHash: raw.parentHash,
      timestampUtc: raw.timestampUtc,
      transactionCount: raw.transactionCount,
    });
    return envelope(this.providerId, 'rpc.latest_block', data, this.clock, raw.timestampUtc);
  }

  getTransaction(hash: string): ProviderObservationEnvelope<ExternalTransactionSummary> {
    const tx = FIXTURE_TRANSACTIONS.eth_tx;
    const data: ExternalTransactionSummary = Object.freeze({
      networkId: this.networkId,
      hash,
      blockNumber: tx.blockNumber,
      from: tx.from,
      to: tx.to,
      valueMinor: tx.valueMinor,
      status: tx.status,
    });
    return envelope(this.providerId, 'rpc.transaction', data, this.clock);
  }

  getBalance(address: string): ProviderObservationEnvelope<ExternalBalanceObservation> {
    const data: ExternalBalanceObservation = Object.freeze({
      networkId: this.networkId,
      address,
      asset: this.networkId.startsWith('bitcoin') ? 'BTC' : 'ETH',
      balanceMinor: '5000000000000000000',
    });
    return envelope(this.providerId, 'rpc.balance', data, this.clock);
  }

  getTokenMetadata(
    contractAddress: string,
  ): ProviderObservationEnvelope<ExternalTokenIdentity> {
    const data: ExternalTokenIdentity = Object.freeze({
      ...FIXTURE_TOKEN_USDC,
      contractAddress,
      providerNativeId: chainScopedTokenKey(FIXTURE_ETHEREUM_CHAIN_ID, contractAddress),
    });
    return envelope(this.providerId, 'rpc.token_metadata', data, this.clock);
  }

  callReadOnlyContract(call: ReadOnlyContractCall): ProviderObservationEnvelope<string> {
    guardRpcMethod('eth_call');
    if (!isAllowedReadContract(call.networkId, call.contractAddress)) {
      throw new Error(`unauthorized_contract_read:${call.contractAddress}`);
    }
    return envelope(this.providerId, 'rpc.read_contract', '0x0000000000000000000000000000000000000000000000000de0b6b3a7640000', this.clock);
  }

  getNetworkStatus(): ProviderObservationEnvelope<ExternalNetworkStatusObservation> {
    const block = FIXTURE_BLOCKS[this.networkId as keyof typeof FIXTURE_BLOCKS];
    const data: ExternalNetworkStatusObservation = Object.freeze({
      networkId: this.networkId,
      healthy: this.healthy,
      latestBlockNumber: block?.blockNumber ?? null,
      chainId: this.expectedChainId,
      peerCount: 25,
      synced: this.healthy,
      message: this.message,
    });
    return envelope(this.providerId, 'rpc.network_status', data, this.clock);
  }

  getFeeEstimate(): ProviderObservationEnvelope<ExternalFeeEstimate> {
    const data: ExternalFeeEstimate = Object.freeze({
      networkId: this.networkId,
      gasPriceMinor: '25000000000',
      baseFeeMinor: '20000000000',
      priorityFeeMinor: '5000000000',
      estimatedConfirmationBlocks: 2,
      unit: 'wei',
    });
    return envelope(this.providerId, 'rpc.fee_estimate', data, this.clock);
  }
}

export class CloudflareEthRpcFixture extends BaseFixtureRpcProvider {
  constructor(clock?: Clock) {
    super('cloudflare-eth-rpc', 'ethereum-mainnet', FIXTURE_ETHEREUM_CHAIN_ID, clock);
  }
}

export class InfuraEthRpcFixture extends BaseFixtureRpcProvider {
  constructor(clock?: Clock) {
    super('infura-ethereum', 'ethereum-mainnet', FIXTURE_ETHEREUM_CHAIN_ID, clock);
  }
}

export class AlchemyEthRpcFixture extends BaseFixtureRpcProvider {
  constructor(clock?: Clock) {
    super('alchemy-ethereum', 'ethereum-mainnet', FIXTURE_ETHEREUM_CHAIN_ID, clock);
  }
}

export class SolanaPublicRpcFixture extends BaseFixtureRpcProvider {
  constructor(clock?: Clock) {
    super('solana-public-rpc', 'solana-mainnet', null, clock);
  }

  override getChainId(): ProviderObservationEnvelope<string> {
    return envelope(this.providerId, 'rpc.chain_id', 'mainnet-beta', this.clock);
  }

  override getFeeEstimate(): ProviderObservationEnvelope<ExternalFeeEstimate> {
    const data: ExternalFeeEstimate = Object.freeze({
      networkId: this.networkId,
      gasPriceMinor: '5000',
      baseFeeMinor: null,
      priorityFeeMinor: null,
      estimatedConfirmationBlocks: 1,
      unit: 'lamports',
    });
    return envelope(this.providerId, 'rpc.fee_estimate', data, this.clock);
  }
}

export class MempoolSpaceFixture {
  readonly providerId = 'mempool-space';
  readonly networkId = 'bitcoin-mainnet';
  private readonly clock: Clock;
  private healthy = true;
  private degraded = false;
  private message = 'fixture healthy';

  constructor(clock: Clock = defaultClock()) {
    this.clock = clock;
  }

  markRateLimited(): void {
    this.healthy = false;
    this.degraded = true;
    this.message = 'rate_limited_429';
  }

  health(): ProviderHealthSnapshot {
    return Object.freeze({
      providerId: this.providerId,
      healthy: this.healthy,
      degraded: this.degraded,
      message: this.message,
      checkedAtUtc: this.clock.nowUtc(),
    });
  }

  getNetworkStatus(): ProviderObservationEnvelope<ExternalNetworkStatusObservation> {
    const block = FIXTURE_BLOCKS['bitcoin-mainnet'];
    return envelope(
      this.providerId,
      'network.status',
      Object.freeze({
        networkId: this.networkId,
        healthy: this.healthy,
        latestBlockNumber: block.blockNumber,
        chainId: null,
        peerCount: null,
        synced: this.healthy,
        message: this.message,
      }),
      this.clock,
    );
  }

  getFeeEstimate(): ProviderObservationEnvelope<ExternalFeeEstimate> {
    return envelope(this.providerId, 'network.fee_estimate', FIXTURE_BITCOIN_FEES, this.clock);
  }

  getLatestBlock(): ProviderObservationEnvelope<ExternalBlockSummary> {
    const raw = FIXTURE_BLOCKS['bitcoin-mainnet'];
    return envelope(
      this.providerId,
      'network.latest_block',
      Object.freeze({
        networkId: this.networkId,
        blockNumber: raw.blockNumber,
        blockHash: raw.blockHash,
        parentHash: raw.parentHash,
        timestampUtc: raw.timestampUtc,
        transactionCount: raw.transactionCount,
      }),
      this.clock,
      raw.timestampUtc,
    );
  }
}

export class CoinGeckoFixture {
  readonly providerId = 'coingecko';
  private readonly clock: Clock;
  private healthy = true;
  private degraded = false;
  private message = 'fixture healthy';

  constructor(clock: Clock = defaultClock()) {
    this.clock = clock;
  }

  markUnavailable(): void {
    this.healthy = false;
    this.message = 'provider_unavailable';
  }

  health(): ProviderHealthSnapshot {
    return Object.freeze({
      providerId: this.providerId,
      healthy: this.healthy,
      degraded: this.degraded,
      message: this.message,
      checkedAtUtc: this.clock.nowUtc(),
    });
  }

  getMarketQuotes(): readonly ProviderObservationEnvelope<CryptoMarketQuote>[] {
    return Object.freeze(
      FIXTURE_CRYPTO_QUOTES.map((q) => envelope(this.providerId, 'crypto.market_quote', q, this.clock, q.updatedAtUtc)),
    );
  }
}

export class ChainlinkFeedsFixture {
  readonly providerId = 'chainlink-feeds';
  private readonly clock: Clock;

  constructor(clock: Clock = defaultClock()) {
    this.clock = clock;
  }

  health(): ProviderHealthSnapshot {
    return Object.freeze({
      providerId: this.providerId,
      healthy: true,
      degraded: false,
      message: 'fixture healthy',
      checkedAtUtc: this.clock.nowUtc(),
    });
  }

  getReferenceFeed(feedId: string): ProviderObservationEnvelope<OracleReferenceObservation> {
    const data: OracleReferenceObservation = Object.freeze({
      ...FIXTURE_CHAINLINK_ETH_USD,
      feedId,
      providerId: this.providerId,
    });
    return envelope(this.providerId, 'oracle.reference_feed', data, this.clock, data.updatedAtUtc);
  }
}

export type Wave3FixtureProviders = {
  readonly cloudflare: CloudflareEthRpcFixture;
  readonly infura: InfuraEthRpcFixture;
  readonly alchemy: AlchemyEthRpcFixture;
  readonly solana: SolanaPublicRpcFixture;
  readonly mempool: MempoolSpaceFixture;
  readonly coingecko: CoinGeckoFixture;
  readonly chainlink: ChainlinkFeedsFixture;
};

export function createWave3FixtureProviders(clock?: Clock): Wave3FixtureProviders {
  return Object.freeze({
    cloudflare: new CloudflareEthRpcFixture(clock),
    infura: new InfuraEthRpcFixture(clock),
    alchemy: new AlchemyEthRpcFixture(clock),
    solana: new SolanaPublicRpcFixture(clock),
    mempool: new MempoolSpaceFixture(clock),
    coingecko: new CoinGeckoFixture(clock),
    chainlink: new ChainlinkFeedsFixture(clock),
  });
}
