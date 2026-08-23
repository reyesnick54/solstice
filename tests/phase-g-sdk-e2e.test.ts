import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createSunReyConsumerBffClient } from '../packages/sunrey-sdk/src/consumer-bff/index.ts';
import { createPhaseGWorld, PHASE_G_TOKEN } from './phase-g-world.ts';

describe('Phase G SDK-only digital-asset E2E', () => {
  it('walks buy, sell, wallet, and economy through the public Consumer BFF client', async () => {
    const world = createPhaseGWorld();
    const server = await world.startHttp();
    const sdk = createSunReyConsumerBffClient({
      baseUrl: server.url,
      getAccessToken: () => PHASE_G_TOKEN,
    });
    try {
      const home = await sdk.getExchangeHome();
      assert.equal((home as { schema: string }).schema, 'sunrey.consumer.exchange.home.v1');
      const markets = await sdk.listExchangeMarkets();
      const marketId = markets.items[0]?.marketId;
      assert.ok(marketId);
      await sdk.fundExchangeSandbox();
      const preview = await sdk.previewExchangeOrder({
        side: 'BUY',
        quantity: '2',
        notionalUsdMinor: '50000',
      });
      assert.match(String(preview.humanReadableIntent), /Review before authorization/);
      const proposal = (await sdk.createExchangeProposal({
        side: 'BUY',
        quantity: '2',
        notionalUsdMinor: '50000',
      })) as { proposalId: string };
      await sdk.approveExchangeProposal(proposal.proposalId, { stepUpSatisfied: true, actor: 'HUMAN' });
      const submitted = (await sdk.submitExchangeProposal(proposal.proposalId, { clientOrderId: 'sdk-buy-1' })) as {
        view: string;
      };
      assert.ok(['OPEN', 'PARTIALLY_FILLED', 'FILLED', 'SUBMITTED'].includes(submitted.view));

      const sellProposal = (await sdk.createExchangeProposal({
        side: 'SELL',
        quantity: '1',
      })) as { proposalId: string };
      await sdk.approveExchangeProposal(sellProposal.proposalId, { stepUpSatisfied: true });
      const sold = (await sdk.submitExchangeProposal(sellProposal.proposalId, { clientOrderId: 'sdk-sell-1' })) as {
        view: string;
      };
      assert.ok(['OPEN', 'PARTIALLY_FILLED', 'FILLED', 'SUBMITTED'].includes(sold.view));

      const wallets = await sdk.listWallets();
      assert.equal((wallets as unknown as { schema: string }).schema, 'sunrey.consumer.wallet.v1');
      const deposit = await sdk.simulateWalletDeposit({ quantity: '3' });
      assert.equal((deposit as { credited: boolean }).credited, true);
      const quote = await sdk.createWithdrawalQuote({
        assetId: 'SUNREY_COIN',
        quantity: '1',
        destination: 'sr1sdk-destination-wallet',
      });
      assert.equal((quote as { ok: boolean }).ok, true);

      const economy = await sdk.getEconomyHome();
      assert.equal((economy as { schema: string }).schema, 'sunrey.consumer.economy.v1');
      const sunrey = await sdk.getSunreyCoinEconomy();
      assert.equal((sunrey as { unauthorizedIssuance: boolean }).unauthorizedIssuance, false);
      const moonrey = await sdk.getMoonreyCoinEconomy();
      assert.equal((moonrey as { testIssuanceIsNotProductionEconomics: boolean }).testIssuanceIsNotProductionEconomics, true);
      const status = await sdk.getEconomyStatus();
      const freshness = (status as { freshnessValues: string[] }).freshnessValues;
      assert.ok(freshness.includes('SANDBOX'));
      assert.ok(freshness.includes('UNAVAILABLE'));
      assert.ok(freshness.includes('LIVE'));
      assert.ok(freshness.includes('DELAYED'));
      assert.ok(freshness.includes('STALE'));
    } finally {
      await server.close();
    }
  });
});
