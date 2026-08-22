import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  createMemoryTokenStore,
  createSunReyConsumerClient,
} from '../packages/sunrey-sdk/src/consumer-platform/index.ts';
import { startConsumerPlatform } from '../services/consumer-platform/src/index.ts';

describe('Phase C SDK-only money E2E', () => {
  it('proves Lovable can consume the sandbox money platform through the public client', async () => {
    const platform = await startConsumerPlatform({
      allowSandboxPersonas: true,
      integrationEnvironment: 'TEST',
    });
    const auth = createMemoryTokenStore();
    const client = createSunReyConsumerClient({
      baseUrl: platform.url,
      auth,
    });
    try {
      const session = await client.loginSandboxPersona('fin-ready');
      auth.setAccessToken(session.access_token);

      const accounts = await client.listAccounts();
      assert.ok(accounts.items.some((row) => row.currency === 'USD'));
      assert.ok(accounts.items.some((row) => row.currency === 'SAR'));
      const usd = accounts.items.find((row) => row.currency === 'USD');
      assert.ok(usd);
      assert.match(usd.balance.minor_units, /^\d+$/);
      assert.ok(BigInt(usd.balance.minor_units) >= 500_000n);

      const recipient = await client.createRecipient({
        legal_name: 'Ahmed Ali',
        destination_country: 'SA',
        currency: 'SAR',
        idempotency_key: 'sdk-recip-1',
      });
      assert.ok(recipient.recipient_id);

      const paymentQuote = await client.createPaymentQuote({
        account_id: usd.account_id,
        source_currency: 'USD',
        destination_currency: 'SAR',
        amount: { minor_units: '100000', currency: 'USD' },
        corridor_id: 'US-SA-USD-SAR',
        idempotency_key: 'sdk-payq-1',
      });
      assert.equal(paymentQuote.rate_source, 'SIMULATION_REF_NOT_LIVE_MARKET');

      const submitted = await client.submitPayment({
        quote_id: paymentQuote.quote_id,
        recipient_id: recipient.recipient_id,
        purpose: 'sdk e2e',
        idempotency_key: 'sdk-pay-1',
      });
      assert.ok(submitted.payment_id);
      const observed = await client.getPayment(submitted.payment_id);
      assert.equal(observed.payment_id, submitted.payment_id);
      assert.ok(observed.status.length > 0);

      const fxQuote = await client.createFxQuote({
        account_id: usd.account_id,
        source_currency: 'USD',
        destination_currency: 'SAR',
        amount: { minor_units: '100000', currency: 'USD' },
        corridor_id: 'US-SA-USD-SAR',
        idempotency_key: 'sdk-fxq-1',
      });
      const accepted = await client.acceptFxQuote(fxQuote.quote_id);
      assert.ok(accepted.status === 'ACCEPTED' || accepted.quote_id === fxQuote.quote_id);
      const executed = await client.executeFxQuote(fxQuote.quote_id);
      assert.equal(executed.quote_id, fxQuote.quote_id);

      const activity = await client.listActivity();
      assert.ok(activity.items.length >= 1);

      const cards = await client.listCards();
      assert.ok(cards.items.length >= 1);
      const card = cards.items[0]!;
      const frozen = await client.freezeCard(card.cardId);
      assert.equal(frozen.status, 'FROZEN');
      const thawed = await client.unfreezeCard(card.cardId);
      assert.equal(thawed.status, 'ACTIVE');
    } finally {
      await platform.close();
    }
  });
});
