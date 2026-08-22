import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  BFF_PAYMENT_STATUSES,
  RECIPIENT_DESTINATION_TYPES,
  createSunReyConsumerBffClient,
  CONSUMER_ACTIVITY_STATUSES,
  FINANCIAL_ACCOUNT_LIFECYCLES,
  FINANCIAL_PRODUCT_TYPES,
} from './consumer-bff/index.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('consumer BFF payments SDK', () => {
  it('exposes typed payment and recipient statuses', () => {
    assert.ok(BFF_PAYMENT_STATUSES.includes('SETTLED'));
    assert.ok(BFF_PAYMENT_STATUSES.includes('AWAITING_STEP_UP_AUTH'));
    assert.ok(RECIPIENT_DESTINATION_TYPES.includes('SUNREY_USER'));
  });

  it('calls Consumer BFF payment routes without privileged imports', async () => {
    const calls: Array<{ url: string; method: string; idempotency?: string | null }> = [];
    const client = createSunReyConsumerBffClient({
      baseUrl: 'http://example.test',
      getAccessToken: () => 'sandbox.basic_verified',
      generateRequestId: () => 'req_pay',
      fetchImpl: async (input, init) => {
        const url = typeof input === 'string' ? input : String(input);
        const headers = new Headers(init?.headers);
        calls.push({
          url,
          method: init?.method ?? 'GET',
          idempotency: headers.get('idempotency-key'),
        });
        if (url.endsWith('/api/v1/payments/quote')) {
          return new Response(
            JSON.stringify({
              quoteId: 'pq_1',
              settlementTimePromise: null,
              productionMoneyMovement: false,
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }
        return new Response(
          JSON.stringify({ paymentId: 'pay_1', status: 'SETTLED', productionMoneyMovement: false }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      },
    });
    const quote = await client.quotePayment({
      sourceAccountId: 'acct_1',
      amountMinorUnits: '1000',
      currency: 'USD',
    });
    assert.equal(quote.quoteId, 'pq_1');
    assert.equal(quote.settlementTimePromise, null);
    const payment = await client.createPayment(
      {
        sourceAccountId: 'acct_1',
        amountMinorUnits: '1000',
        currency: 'USD',
        quoteId: quote.quoteId,
      },
      { idempotencyKey: 'pay_sdk_1' },
    );
    assert.equal(payment.status, 'SETTLED');
    assert.equal(calls[1]?.idempotency, 'pay_sdk_1');
    assert.equal(calls[0]?.url, 'http://example.test/api/v1/payments/quote');
  });
});

describe('consumer BFF SDK models', () => {
  it('exposes typed account, balance, and activity vocabularies', () => {
    assert.ok(FINANCIAL_ACCOUNT_LIFECYCLES.includes('ACTIVE'));
    assert.ok(FINANCIAL_ACCOUNT_LIFECYCLES.includes('RESTRICTED'));
    assert.ok(FINANCIAL_PRODUCT_TYPES.includes('CHECKING_PAYMENT'));
    assert.ok(CONSUMER_ACTIVITY_STATUSES.includes('PENDING'));
    assert.ok(CONSUMER_ACTIVITY_STATUSES.includes('COMPLETED'));
    assert.equal(CONSUMER_ACTIVITY_STATUSES.includes('DONE' as never), false);
  });
});

describe('consumer BFF SDK browser boundary', () => {
  it('does not import privileged or Node-only modules', () => {
    const dir = join(here, 'consumer-bff');
    const files = readdirSync(dir).filter((name) => name.endsWith('.ts'));
    assert.ok(files.includes('index.ts'));
    const forbidden = [
      'node:http',
      'node:fs',
      'node:net',
      'node:crypto',
      '../gateway/server',
      '../developer-platform',
      '../signer',
      '../../ledger',
      '../../kernel',
      '../../permissions/src/execution-authority',
      '../../persistence',
      'createSimulationKeyProvider',
      'AuthorityIssuer',
      'postJournal',
      'ExecutionAuthority',
    ];
    for (const file of files) {
      const source = readFileSync(join(dir, file), 'utf8');
      for (const needle of forbidden) {
        assert.equal(source.includes(needle), false, `${file} leaked ${needle}`);
      }
    }
  });
});
