// @ts-nocheck
/**
 * Wave 3 Prompt 14 — external chain interoperability regression tests.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { BlockchainIntelligenceCache } from './cache.ts';
import { validateChainIdResponse } from './external-chain-rpc-provider.ts';
import {
  BlockchainIntelligenceService,
  createBlockchainIntelligenceSandbox,
  createWave3FixtureProviders,
  EXTERNAL_NETWORKS,
  MALFORMED_RPC_PAYLOADS,
  validateBlockRange,
  validateHex,
  isAllowedReadContract,
  assertReadOnlyRpcOperation,
  chainScopedTokenKey,
} from './index.ts';

describe('Wave 3 Prompt 14 — blockchain intelligence', () => {
  it('lists external networks without SunRey native in consumer surface', () => {
    const svc = createBlockchainIntelligenceSandbox();
    const networks = svc.listNetworks();
    assert.ok(networks.length >= 3);
    assert.equal(networks.some((n) => n.networkId === 'sunrey-native'), false);
    assert.equal(networks.some((n) => n.networkId === 'ethereum-mainnet'), true);
  });

  it('capability matrix marks execution false for external chains', () => {
    const matrix = createBlockchainIntelligenceSandbox().capabilityMatrix();
    const eth = matrix['ethereum-mainnet'];
    assert.equal(eth.EXECUTION, false);
    assert.equal(eth.CUSTODY, false);
    assert.equal(eth.READ_BLOCKS, true);
  });

  it('crypto market reference returns fixture quotes', () => {
    const quotes = createBlockchainIntelligenceSandbox().cryptoMarketQuotes();
    assert.ok(quotes.length >= 2);
    assert.equal(quotes[0].providerId, 'coingecko');
    assert.match(quotes[0].data.priceUsdMinor, /^\d+$/);
  });

  it('ethereum RPC path returns network status and fees', () => {
    const svc = createBlockchainIntelligenceSandbox();
    const status = svc.networkStatus('ethereum-mainnet');
    assert.equal(status.data.networkId, 'ethereum-mainnet');
    assert.equal(status.data.healthy, true);
    const fees = svc.networkFees('ethereum-mainnet');
    assert.equal(fees.data.unit, 'wei');
  });

  it('bitcoin intelligence via mempool-space fixture', () => {
    const svc = createBlockchainIntelligenceSandbox();
    const fees = svc.networkFees('bitcoin-mainnet');
    assert.equal(fees.data.unit, 'sat/vB');
    const status = svc.networkStatus('bitcoin-mainnet');
    assert.equal(status.providerId, 'mempool-space');
  });

  it('chain-scoped token identity', () => {
    const key = chainScopedTokenKey('0x1', '0xAbC');
    assert.equal(key, '0x1:0xabc');
  });

  it('prohibits signing RPC operations', () => {
    assert.throws(() => assertReadOnlyRpcOperation('sendRawTransaction'));
    assert.throws(() => assertReadOnlyRpcOperation('eth_sign'));
  });

  it('validates chain ID and rejects mismatch', () => {
    validateChainIdResponse('test', '0x1', '0x01');
    assert.throws(() => validateChainIdResponse('test', '0x1', '0x89'));
  });

  it('wrong-chain provider marked unhealthy', () => {
    const fixtures = createWave3FixtureProviders();
    fixtures.cloudflare.markUnhealthy('chain_id_mismatch');
    assert.equal(fixtures.cloudflare.health().healthy, false);
  });

  it('multi-provider fallback uses secondary when primary unhealthy', () => {
    const fixtures = createWave3FixtureProviders();
    fixtures.cloudflare.markUnhealthy('simulated_failure');
    const svc = new BlockchainIntelligenceService({ fixtures });
    const status = svc.networkStatus('ethereum-mainnet');
    assert.ok(['infura-ethereum', 'alchemy-ethereum'].includes(status.providerId));
  });

  it('multi-provider failure isolation — stale cache when coingecko unavailable', () => {
    const fixtures = createWave3FixtureProviders();
    const cache = new BlockchainIntelligenceCache();
    const svc1 = new BlockchainIntelligenceService({ fixtures, cache });
    const first = svc1.cryptoMarketQuotes();
    fixtures.coingecko.markUnavailable();
    const svc2 = new BlockchainIntelligenceService({ fixtures, cache });
    const second = svc2.cryptoMarketQuotes();
    assert.equal(second.length, first.length);
  });

  it('coingecko unavailable without cache throws', () => {
    const fixtures = createWave3FixtureProviders();
    fixtures.coingecko.markUnavailable();
    const svc = new BlockchainIntelligenceService({ fixtures });
    assert.throws(() => svc.cryptoMarketQuotes());
  });

  it('exchange metadata does not enable custody or withdrawals', () => {
    const meta = createBlockchainIntelligenceSandbox().exchangeNetworkMetadata('ethereum-mainnet');
    assert.ok(meta);
    assert.equal(meta!.custodyEnabled, false);
    assert.equal(meta!.depositEnabled, false);
    assert.equal(meta!.withdrawalEnabled, false);
  });

  it('agent evidence ref never grants execution authority', () => {
    const ref = createBlockchainIntelligenceSandbox().agentEvidenceRef('ethereum-mainnet');
    assert.equal(ref.grantsExecutionAuthority, false);
    assert.equal(ref.treatedAsTradeInstruction, false);
  });

  it('oracle reference observation is normalized', () => {
    const obs = createBlockchainIntelligenceSandbox().oracleReference('eth-usd-mainnet');
    assert.equal(obs.data.assetPair, 'ETH/USD');
    assert.equal(obs.data.providerId, 'chainlink-feeds');
  });

  it('query limits reject oversized block range', () => {
    const rejection = validateBlockRange(0, 500);
    assert.ok(rejection);
    assert.equal(rejection!.code, 'QUERY_LIMIT_EXCEEDED');
  });

  it('query limits reject malformed hex', () => {
    const rejection = validateHex('0xNOTHEX', 'hash');
    assert.ok(rejection);
  });

  it('read-only contract calls require allowlist', () => {
    assert.equal(
      isAllowedReadContract('ethereum-mainnet', '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419'),
      true,
    );
    assert.equal(isAllowedReadContract('ethereum-mainnet', '0xdead'), false);
  });

  it('malformed RPC fixture payloads exist for security regression', () => {
    assert.ok(MALFORMED_RPC_PAYLOADS.wrongChainId);
    assert.ok(MALFORMED_RPC_PAYLOADS.malformedHex);
    assert.ok(MALFORMED_RPC_PAYLOADS.hostileString);
  });

  it('native SunRey network retains execution capabilities in registry only', () => {
    const native = EXTERNAL_NETWORKS.find((n) => n.networkId === 'sunrey-native');
    assert.ok(native);
    assert.equal(native!.capabilities.EXECUTION, true);
    assert.equal(native!.observationSupport.custody, true);
  });
});
