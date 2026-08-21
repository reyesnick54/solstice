import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  CONSUMER_ERROR_CODES,
  CONSUMER_FEATURE_IDS,
  INTEGRATION_ENVIRONMENTS,
  SANDBOX_PERSONA_IDS,
  SunReyConsumerClient,
  asConsumerPage,
  consumerError,
  createMemoryTokenStore,
  isRetryableConsumerError,
} from './consumer-platform/index.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('consumer platform SDK', () => {
  it('exposes stable enums and a memory token store', () => {
    assert.ok(INTEGRATION_ENVIRONMENTS.includes('LOCAL'));
    assert.ok(SANDBOX_PERSONA_IDS.includes('alex-ready'));
    assert.ok(CONSUMER_FEATURE_IDS.includes('home'));
    assert.ok(CONSUMER_ERROR_CODES.includes('SESSION_EXPIRED'));
    const store = createMemoryTokenStore();
    store.setAccessToken('tok_example');
    assert.equal(store.getAccessToken(), 'tok_example');
    const page = asConsumerPage({ items: [1], next_cursor: 'c1', page_size: 1 });
    assert.equal(page.hasMore, true);
    const err = consumerError({
      error_code: 'RATE_LIMITED',
      category: 'RATE_LIMIT',
      message: 'slow down',
      retryable: true,
      user_action_required: false,
      safe_to_display: true,
      request_id: 'req_1',
    });
    assert.equal(isRetryableConsumerError({ envelope: err, status: 429, name: 'x', message: 'x' }), false);
  });

  it('builds request URLs and attaches request ids without privileged imports', async () => {
    const calls: Array<{ url: string; headers: Headers }> = [];
    const client = new SunReyConsumerClient({
      baseUrl: 'http://example.test',
      generateRequestId: () => 'req_fixed',
      fetchImpl: async (input, init) => {
        const url = typeof input === 'string' ? input : String(input);
        calls.push({ url, headers: new Headers(init?.headers) });
        return new Response(JSON.stringify({ status: 'ok', api_version: 'v1', surface: 'CONSUMER_PLATFORM', environment: 'simulation', production_active: false }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      },
    });
    await client.health();
    assert.equal(calls[0]?.url, 'http://example.test/health');
    assert.equal(calls[0]?.headers.get('x-request-id'), 'req_fixed');
  });
});

describe('consumer SDK browser boundary', () => {
  it('does not import privileged or Node-only modules', () => {
    const dir = join(here, 'consumer-platform');
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
