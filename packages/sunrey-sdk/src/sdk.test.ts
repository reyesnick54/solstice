import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { transactionIdFromCanonicalBytes } from '../../sunrey-chain/src/protocol/index.ts';
import { encodeAddress } from '../../sunrey-chain/src/wallet/address.ts';
import { connectSunRey, connectSunReyPool } from './client.ts';
import { PUBLIC_API_VERSION_STRATEGY, requireVersionedPublicPath } from './versioning.ts';
import { createDevelopmentWallet, publicRegistration } from './development-wallet.ts';
import { startPublicGateway } from './gateway/server.ts';
import {
  CLASSICAL_SUITE_ID,
  PUBLIC_ASSET_IDS,
  PUBLIC_CHAIN_ID,
  PUBLIC_CRYPTO_SUITE_IDS,
  PUBLIC_NETWORK_ID,
} from './ids.ts';
import { decodeCursor, encodeCursor } from './pagination.ts';
import { runQuickstart } from './quickstart.ts';
import { submissionRetrySafe } from './retry.ts';
import { EVENT_TYPES, MARKET_FAMILIES } from './types.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const VECTORS = JSON.parse(readFileSync(join(ROOT, 'api/sunrey-sdk-vectors-v1.json'), 'utf8')) as {
  readonly networkId: string;
  readonly chainId: string;
  readonly assetIds: readonly string[];
  readonly cryptoSuiteIds: readonly string[];
  readonly protocolVector: { readonly transactionIdHex: string };
  readonly address: { readonly networkId: string; readonly descriptorUtf8: string };
};

describe('SunRey TypeScript SDK', () => {
  it('exposes all public namespaces and market families', () => {
    assert.deepEqual([...MARKET_FAMILIES], [
      'DIGITAL_ASSET',
      'HUMAN_INFORMATION_RIGHT',
      'INTELLIGENCE_COMPUTE',
      'PRODUCTIVE_CAPACITY',
    ]);
    assert.ok(EVENT_TYPES.includes('newFinalizedBlock'));
    assert.ok(EVENT_TYPES.includes('moonreyIssuance'));
  });

  it('agrees with checked-in cross-language vectors', () => {
    assert.equal(PUBLIC_NETWORK_ID, VECTORS.networkId);
    assert.equal(PUBLIC_CHAIN_ID, VECTORS.chainId);
    assert.deepEqual([...PUBLIC_ASSET_IDS], [...VECTORS.assetIds]);
    assert.deepEqual([...PUBLIC_CRYPTO_SUITE_IDS], [...VECTORS.cryptoSuiteIds]);
    assert.equal(CLASSICAL_SUITE_ID, 'sunrey-ed25519-v1');
    const proto = JSON.parse(
      readFileSync(join(ROOT, 'packages/sunrey-chain/protocol/test-vectors/v1/vectors.json'), 'utf8'),
    ) as { readonly cases: readonly { readonly name: string; readonly unsignedBytesHex?: string; readonly transactionIdHex?: string }[] };
    const transfer = proto.cases.find((item) => item.name === 'valid-sunrey-coin-transfer-shape');
    assert.ok(transfer?.unsignedBytesHex);
    const recomputed = transactionIdFromCanonicalBytes(
      PUBLIC_NETWORK_ID,
      PUBLIC_CHAIN_ID,
      Buffer.from(transfer.unsignedBytesHex, 'hex'),
    );
    assert.equal(recomputed, VECTORS.protocolVector.transactionIdHex);
    const address = encodeAddress({
      networkId: VECTORS.address.networkId,
      addressClass: 'SINGLE_KEY_ACCOUNT',
      algorithm: 'ED25519_V1',
      descriptorBytes: Buffer.from(VECTORS.address.descriptorUtf8, 'utf8'),
    });
    assert.equal(address.networkId, PUBLIC_NETWORK_ID);
    assert.ok(address.text.startsWith('srdev1'));
  });

  it('runs the beginner quickstart to finality', async () => {
    const result = await runQuickstart();
    assert.equal(result.status, 'FINALIZED');
    assert.equal(result.bobAvailable, '25000');
    assert.ok(result.events > 0);
  });

  it('queries every public namespace through the SDK', async () => {
    const gateway = await startPublicGateway();
    try {
      const client = connectSunRey(gateway.url);
      assert.equal((await client.status()).api_version, 'v1');
      const phase = await client.getNetworkPhase() as { readonly phase: string; readonly realProductionCapabilitiesActivated: boolean };
      assert.equal(phase.phase, 'CHAIN_STABILIZATION');
      assert.equal(phase.realProductionCapabilitiesActivated, false);
      const caps = await client.getCapabilityStatus() as { readonly realProductionCapabilitiesActivated: boolean };
      assert.equal(caps.realProductionCapabilitiesActivated, false);
      assert.ok(await client.getPostGenesisHealth());
      const protocol = await client.getProtocolVersion() as { readonly protocol_version: string };
      assert.equal(protocol.protocol_version, '1');
      assert.ok(await client.validators.list());
      assert.ok(await client.governance.proposals());
      assert.ok(await client.oracles.facts());
      assert.ok(await client.productive.moonreyAttribution());
      assert.ok(await client.productive.getMoonReyPolicy());
      assert.ok(await client.productive.getMoonReySupplyPressure());
      assert.ok(await client.machines.offers());
      assert.ok(await client.interop.packets());
      const markets = await client.exchange.listMarkets() as { readonly markets: readonly { readonly family: string }[] };
      assert.equal(markets.markets.length, 4);
      const md = await client.exchange.marketData(markets.markets[0] ? 'market:sunrey-coin-usd-simulation' : 'm', 'public') as {
        readonly tier: string;
        readonly delayed_ms: number;
      };
      assert.equal(md.tier, 'PUBLIC_DELAYED');
      assert.ok(md.delayed_ms > 0);
      const sandbox = await client.exchange.orderSandbox({
        market_id: 'market:sunrey-coin-usd-simulation',
        signed_order_hex: '00',
        actor: 'sdk-test',
      }) as { readonly environment: string; readonly production_funds: string };
      assert.equal(sandbox.environment, 'SANDBOX');
      assert.equal(sandbox.production_funds, 'false');
      assert.ok(await client.exchange.tradingSession('xses_sdk'));
      const policy = await client.monetary.policy() as { readonly ticker_status: string; readonly production_activation: string };
      assert.equal(policy.ticker_status, 'NOT_ASSIGNED');
      assert.equal(policy.production_activation, 'UNCONFIGURED');
      assert.ok(await client.monetary.supply());
      assert.ok(await client.monetary.genesis());
      const receipt = await client.monetary.issuanceReceipt('iss_dev_1') as { readonly mint_interface: boolean };
      assert.equal(receipt.mint_interface, false);
      assert.ok(await client.monetary.burns());
      const wallet = createDevelopmentWallet({ walletId: 'ns' });
      await client.wallet.register(publicRegistration(wallet));
      assert.equal((await client.wallet.get(wallet.account.accountId)).authorization_policy, 'SINGLE_SIGNATURE');
    } finally {
      await gateway.close();
    }
  });

  it('paginates with opaque cursors', () => {
    const cursor = encodeCursor({ namespace: 'blocks', offset: 2, height: 4 });
    const decoded = decodeCursor(cursor, 'blocks');
    if ('error' in decoded) {
      throw new Error('expected a valid cursor');
    }
    assert.equal(decoded.offset, 2);
    const invalid = decodeCursor('not-a-cursor', 'blocks');
    assert.ok('error' in invalid);
    assert.equal(invalid.error, 'INVALID_PAGINATION_CURSOR');
  });

  it('refuses unsafe submission retries that would mint a new transaction id', () => {
    assert.equal(submissionRetrySafe({ previousTransactionId: 'aa', nextTransactionId: 'aa' }), true);
    assert.equal(submissionRetrySafe({ previousTransactionId: 'aa', nextTransactionId: 'bb' }), false);
  });

  it('supports endpoint pools and preserves /v1 versioning', () => {
    const pool = connectSunReyPool(['http://127.0.0.1:1', 'http://127.0.0.1:2']);
    assert.equal(pool.clients.length, 2);
    assert.equal(PUBLIC_API_VERSION_STRATEGY.current, 'v1');
    assert.equal(PUBLIC_API_VERSION_STRATEGY.breakingChangesRequireVersioning, true);
    assert.equal(requireVersionedPublicPath('/v1/chain/status'), true);
    assert.equal(requireVersionedPublicPath('/v2/chain/status'), false);
  });
});
