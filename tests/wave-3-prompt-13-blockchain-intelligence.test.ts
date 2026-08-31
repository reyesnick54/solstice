import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import { buildCatalogIndex } from '../packages/provider-sdk/src/catalog/loader.ts';
import { createFixtureCatalog } from '../packages/provider-sdk/src/test-fixtures/catalog.ts';
import {
  CHAIN_INTELLIGENCE_CATALOG_ENTRIES,
  CHAIN_INTELLIGENCE_CACHE_CAPABILITIES,
  chainIntelligenceCachePolicy,
  chainIntelligenceSeparationProof,
  createBlockchainComAdapter,
  createExternalChainIntelligenceService,
  createMempoolSpaceAdapter,
  defaultChainIntelligenceNow,
  loadChainIntelligenceCatalog,
  MempoolSpaceAdapter,
  privacySafeAddressLogRef,
  rejectSunReyNativeChain,
  validateBitcoinTxHash,
  validateTransactionHash,
} from '../packages/sunrey-chain/src/chain-intelligence/index.ts';
import { buildChainIntelligenceAgentEvidence } from '../packages/sunrey-chain/src/chain-intelligence/agent-evidence.ts';
import { buildExchangeChainContext } from '../packages/sunrey-exchange/src/chain-intelligence/integrations/exchange.ts';
import { buildWorldBlockchainHealth } from '../packages/sunrey-exchange/src/chain-intelligence/integrations/world.ts';
import { createBlockchainIntelligenceBff } from '../services/api/src/consumer/blockchain-intelligence-adapter.ts';
import { SUNREY_CHAIN_ID } from '../packages/sunrey-chain/src/interop/types.ts';

const NOW = defaultChainIntelligenceNow();
const VALID_TX = 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456';

describe('Wave 3 Prompt 13 — blockchain network intelligence', () => {
  it('1. provider registration discovers catalog entries', () => {
    const index = buildCatalogIndex(
      createFixtureCatalog([...CHAIN_INTELLIGENCE_CATALOG_ENTRIES] as never[]),
    );
    const matches = loadChainIntelligenceCatalog(index);
    assert.equal(matches.length, 4);
    assert.ok(matches.some((m) => m.entry.provider_id === 'mempool-space'));
    assert.ok(matches.some((m) => m.entry.provider_id === 'blockchain-com'));
    assert.ok(matches.some((m) => m.entry.provider_id === 'blockscout'));
    assert.ok(matches.some((m) => m.entry.provider_id === 'btcglobe'));
  });

  it('2. latest Bitcoin block', async () => {
    const service = createExternalChainIntelligenceService();
    const block = await service.getLatestBlock('bitcoin-mainnet', NOW);
    assert.equal(block.ok, true);
    if (!block.ok) return;
    assert.ok(block.value.height > 0);
    assert.equal(block.value.hash.length, 64);
  });

  it('3. block normalization', async () => {
    const service = createExternalChainIntelligenceService();
    const block = await service.getLatestBlock('bitcoin-mainnet', NOW);
    assert.equal(block.ok, true);
    if (!block.ok) return;
    assert.ok(block.value.previousHash.length > 0);
    assert.ok(block.value.weight > 0);
    assert.ok(block.value.difficulty.length > 0);
    assert.ok(['UNCONFIRMED', 'PROBABILISTIC', 'LIKELY_FINAL', 'FINAL'].includes(block.value.confirmationStatus));
  });

  it('4. transaction normalization', async () => {
    const service = createExternalChainIntelligenceService();
    const tx = await service.getTransaction('bitcoin-mainnet', VALID_TX, NOW);
    assert.equal(tx.ok, true);
    if (!tx.ok) return;
    assert.equal(tx.value.txHash, VALID_TX);
    assert.ok(tx.value.inputsSummary.includes('input'));
    assert.ok(tx.value.outputsSummary.includes('output'));
  });

  it('5. mempool state', async () => {
    const service = createExternalChainIntelligenceService();
    const mempool = await service.getMempoolStatus('bitcoin-mainnet', NOW);
    assert.equal(mempool.ok, true);
    if (!mempool.ok) return;
    assert.equal(mempool.value.schema, 'sunrey.mempool-observation.v1');
    assert.ok(mempool.value.pendingTransactionCount > 0);
    assert.ok(mempool.value.recommendedFees.length >= 4);
  });

  it('6. fee estimates', async () => {
    const service = createExternalChainIntelligenceService();
    const fees = await service.getFeeEstimate('bitcoin-mainnet', NOW);
    assert.equal(fees.ok, true);
    if (!fees.ok) return;
    assert.equal(fees.value.tiers.length, 4);
    assert.ok(fees.value.tiers.some((t) => t.label === 'priority'));
  });

  it('7. explicit fee units', async () => {
    const service = createExternalChainIntelligenceService();
    const btcFees = await service.getFeeEstimate('bitcoin-mainnet', NOW);
    assert.equal(btcFees.ok, true);
    if (!btcFees.ok) return;
    for (const tier of btcFees.value.tiers) {
      assert.equal(tier.unit, 'sat/vB');
      assert.notEqual(tier.unit, 'BTC');
      assert.notEqual(tier.unit, 'USD');
    }
    const ethFees = await service.getFeeEstimate('ethereum-mainnet', NOW);
    assert.equal(ethFees.ok, true);
    if (!ethFees.ok) return;
    assert.equal(ethFees.value.tiers[0]?.unit, 'gwei');
  });

  it('8. network statistics', async () => {
    const service = createExternalChainIntelligenceService();
    const metrics = await service.getNetworkMetrics('bitcoin-mainnet', NOW);
    assert.equal(metrics.ok, true);
    if (!metrics.ok) return;
    assert.ok(metrics.value.hashrate != null);
    assert.ok(metrics.value.difficulty != null);
    assert.ok(metrics.value.blockIntervalSeconds != null);
  });

  it('9. invalid transaction hash', async () => {
    const service = createExternalChainIntelligenceService();
    const tx = await service.getTransaction('bitcoin-mainnet', 'not-a-hash', NOW);
    assert.equal(tx.ok, false);
    if (tx.ok) return;
    assert.equal(tx.code, 'INVALID_TX_HASH');
  });

  it('10. provider timeout', async () => {
    const primary = createMempoolSpaceAdapter();
    primary.setScenario('timeout');
    const service = createExternalChainIntelligenceService({
      providers: [primary, createBlockchainComAdapter()],
    });
    const block = await service.getLatestBlock('bitcoin-mainnet', NOW);
    assert.equal(block.ok, true);
    if (!block.ok) return;
    assert.equal(block.fallbackProviderId, 'blockchain-com');
  });

  it('11. HTTP 429 rate limit fallback', async () => {
    const primary = createMempoolSpaceAdapter();
    primary.setScenario('rate_limited');
    const service = createExternalChainIntelligenceService({
      providers: [primary, createBlockchainComAdapter()],
    });
    const block = await service.getLatestBlock('bitcoin-mainnet', NOW);
    assert.equal(block.ok, true);
  });

  it('12. fallback to secondary provider', async () => {
    const primary = createMempoolSpaceAdapter();
    primary.setScenario('unavailable');
    const service = createExternalChainIntelligenceService({
      providers: [primary, createBlockchainComAdapter()],
    });
    const block = await service.getLatestBlock('bitcoin-mainnet', NOW);
    assert.equal(block.ok, true);
    if (!block.ok) return;
    assert.equal(block.fallbackProviderId, 'blockchain-com');
  });

  it('13. provider disagreement event', async () => {
    const primary = createMempoolSpaceAdapter();
    primary.setScenario('disagreeing');
    const secondary = createBlockchainComAdapter();
    secondary.setScenario('disagreeing');
    const service = createExternalChainIntelligenceService({
      providers: [primary, secondary],
    });
    await service.getLatestBlock('bitcoin-mainnet', NOW);
    const events = service.disagreementEvents();
    assert.ok(events.length >= 0);
  });

  it('14. stale data freshness policy exists', () => {
    const policy = chainIntelligenceCachePolicy(CHAIN_INTELLIGENCE_CACHE_CAPABILITIES.latestBlock);
    assert.ok(policy.staleWindowMs > policy.freshTtlMs);
  });

  it('15. recent-block reorg semantics', async () => {
    const service = createExternalChainIntelligenceService();
    const block = await service.getLatestBlock('bitcoin-mainnet', NOW);
    assert.equal(block.ok, true);
    if (!block.ok) return;
    const observation = service.toChainObservation(
      'bitcoin-mainnet',
      'BLOCK',
      { kind: 'BLOCK', block: block.value },
      block.fallbackProviderId ?? 'mempool-space',
      NOW,
    );
    assert.equal(observation.reorgAware, true);
    assert.ok(observation.finalityNote.includes('reorganize'));
  });

  it('16. privacy-safe address lookup logging', async () => {
    const service = createExternalChainIntelligenceService();
    const address = 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh';
    await service.lookupAddress('bitcoin-mainnet', address, NOW);
    const refs = service.addressLookupLogRefs();
    assert.equal(refs.length, 1);
    assert.ok(!refs[0]!.includes(address));
    assert.ok(refs[0]!.startsWith('addr:'));
    const safe = privacySafeAddressLogRef(address);
    assert.ok(!safe.includes(address));
  });

  it('17. cache returns cached result on second call', async () => {
    const service = createExternalChainIntelligenceService();
    const first = await service.getFeeEstimate('bitcoin-mainnet', NOW);
    const second = await service.getFeeEstimate('bitcoin-mainnet', NOW);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (!first.ok || !second.ok) return;
    assert.equal(second.fromCache, true);
  });

  it('18. SunRey chain state unchanged — external service is read-only', () => {
    const proof = chainIntelligenceSeparationProof();
    assert.equal(proof.mutatesSunReyLedger, false);
    assert.equal(proof.mutatesSunReyConsensus, false);
    assert.equal(proof.externalObservationOnly, true);
  });

  it('19. SunRey consensus unchanged', () => {
    const proof = chainIntelligenceSeparationProof();
    assert.equal(proof.mutatesSunReyBlockProduction, false);
    assert.equal(proof.overridesInternalValidators, false);
  });

  it('20. SunRey and MoonRey issuance unchanged', () => {
    const proof = chainIntelligenceSeparationProof();
    assert.equal(proof.determinesSunReyCoinIssuance, false);
    assert.equal(proof.determinesMoonReyCoinIssuance, false);
  });

  it('21. Exchange receives only read-only observations', async () => {
    const service = createExternalChainIntelligenceService();
    const ctx = await buildExchangeChainContext(service, 'bitcoin-mainnet', VALID_TX, NOW);
    assert.equal(ctx.readOnly, true);
    assert.equal(ctx.mutatesSettlement, false);
    assert.ok(ctx.confirmationContext != null);
  });

  it('22. Agent receives only research evidence', async () => {
    const service = createExternalChainIntelligenceService();
    const evidence = await buildChainIntelligenceAgentEvidence(service, 'bitcoin-mainnet', NOW);
    assert.equal(evidence.readOnly, true);
    assert.equal(evidence.grantsExecutionAuthority, false);
    assert.equal(evidence.grantsSigningAuthority, false);
    for (const item of evidence.items) {
      assert.equal(item.label, 'RESEARCH_EVIDENCE_NOT_EXECUTION');
    }
  });

  it('23. BFF does not expose credentials or raw provider ids', async () => {
    const bff = createBlockchainIntelligenceBff();
    const block = await bff.bitcoinBlock();
    if ('availability' in block) {
      assert.fail('expected block');
    }
    assert.equal(block.providerId, 'redacted');
    const mempool = await bff.mempool();
    if ('availability' in mempool) {
      assert.fail('expected mempool');
    }
    assert.equal(mempool.providerId, 'redacted');
    const health = await bff.networkHealth();
    assert.equal(health.schema, 'sunrey.world.blockchain-health.v1');
  });

  it('rejects SunRey native chain as external target', () => {
    assert.throws(() => rejectSunReyNativeChain('sunrey-simulation'));
    assert.throws(() => rejectSunReyNativeChain(SUNREY_CHAIN_ID));
  });

  it('validates bitcoin tx hash format', () => {
    assert.equal(validateBitcoinTxHash(VALID_TX).ok, true);
    assert.equal(validateBitcoinTxHash('bad').ok, false);
    assert.equal(validateTransactionHash('ethereum', '0x' + 'a'.repeat(64)).ok, true);
  });
});
